import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Audience, BusyBlock, CampusEvent, Category, Friend, Me, Move, NewMove } from "../types";
import { minutesOfDay, startOfDay } from "../lib/time";
import { type Api, AppError, UW_EMAIL } from "./types";

type Row<T> = T & Record<string, unknown>;

function fail(error: { message: string } | null): void {
  if (error) throw new AppError(error.message);
}

/** The real backend. Needs the tables and policies from supabase/schema.sql. */
export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  async function profile(id: string, email: string): Promise<Me> {
    const { data, error } = await sb.from("profiles").select("id, name, program, is_admin").eq("id", id).single();
    fail(error);
    const row = data as { id: string; name: string; program: string; is_admin: boolean };
    return { id: row.id, email, name: row.name, program: row.program, isAdmin: row.is_admin };
  }

  async function names(ids: string[]): Promise<Map<string, { name: string; program: string }>> {
    const out = new Map<string, { name: string; program: string }>();
    if (ids.length === 0) return out;
    const { data, error } = await sb.from("profiles").select("id, name, program").in("id", [...new Set(ids)]);
    fail(error);
    for (const r of (data ?? []) as Array<{ id: string; name: string; program: string }>) out.set(r.id, r);
    return out;
  }

  const uid = async (): Promise<string> => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new AppError("Not signed in");
    return data.user.id;
  };

  const windowFor = (now: Date) => ({
    from: new Date(now.getTime() - 60 * 60_000).toISOString(),
    to: new Date(startOfDay(now).getTime() + 2 * 86_400_000).toISOString(),
  });

  return {
    mode: "live",
    async getMe() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? profile(u.id, u.email ?? "") : null;
    },
    async sendCode(email) {
      if (!UW_EMAIL.test(email.trim())) throw new AppError("Use your @uwaterloo.ca email");
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      fail(error);
    },
    async verifyCode(email, code) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
      fail(error);
      if (!data.user) throw new AppError("Could not sign in");
      return profile(data.user.id, data.user.email ?? email);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async saveName(name) {
      const id = await uid();
      const { error } = await sb.from("profiles").update({ name: name.trim().slice(0, 40) }).eq("id", id);
      fail(error);
      const { data } = await sb.auth.getUser();
      return profile(id, data.user?.email ?? "");
    },
    async listFriends(): Promise<Friend[]> {
      const id = await uid();
      const { data, error } = await sb.from("friendships").select("user_a, user_b");
      fail(error);
      const friendIds = ((data ?? []) as Array<{ user_a: string; user_b: string }>).map((r) => (r.user_a === id ? r.user_b : r.user_a));
      const [people, close] = await Promise.all([names(friendIds), sb.from("close_friends").select("friend").eq("owner", id)]);
      fail(close.error);
      const closeSet = new Set(((close.data ?? []) as Array<{ friend: string }>).map((r) => r.friend));
      return friendIds.map((f) => ({ id: f, name: people.get(f)?.name ?? "Someone", program: people.get(f)?.program ?? "", isClose: closeSet.has(f) }));
    },
    async setClose(friendId, close) {
      const id = await uid();
      const q = close
        ? sb.from("close_friends").upsert({ owner: id, friend: friendId })
        : sb.from("close_friends").delete().eq("owner", id).eq("friend", friendId);
      fail((await q).error);
    },
    async acceptInvite(inviterId) {
      fail((await sb.rpc("accept_invite", { inviter: inviterId })).error);
    },
    async listIncomingRequests() {
      const id = await uid();
      const { data, error } = await sb.from("friend_requests").select("from_id").eq("to_id", id);
      fail(error);
      const fromIds = ((data ?? []) as Array<{ from_id: string }>).map((r) => r.from_id);
      const people = await names(fromIds);
      return fromIds.map((fromId) => ({ id: fromId, name: people.get(fromId)?.name ?? "", program: people.get(fromId)?.program ?? "" }));
    },
    async sendFriendRequest(email) {
      if (!UW_EMAIL.test(email.trim())) throw new AppError("Use a @uwaterloo.ca email");
      fail((await sb.rpc("send_friend_request", { target_email: email.trim().toLowerCase() })).error);
    },
    async respondToRequest(fromId, accept) {
      fail((await sb.rpc("respond_friend_request", { from_user: fromId, accept })).error);
    },
    async listMoves(now) {
      const { from, to } = windowFor(now);
      const { data, error } = await sb
        .from("moves")
        .select("id, host_id, category, starts_at, place, audience")
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at");
      fail(error);
      const moves = (data ?? []) as Array<Row<{ id: string; host_id: string; category: Category; starts_at: string; place: string; audience: Audience }>>;
      if (moves.length === 0) return [];
      const joins = await sb.from("move_joins").select("move_id, user_id").in("move_id", moves.map((m) => m.id));
      fail(joins.error);
      const joinRows = (joins.data ?? []) as Array<{ move_id: string; user_id: string }>;
      const people = await names([...moves.map((m) => m.host_id), ...joinRows.map((j) => j.user_id)]);
      return moves.map<Move>((m) => {
        const going = joinRows.filter((j) => j.move_id === m.id).map((j) => j.user_id);
        return {
          id: m.id,
          hostId: m.host_id,
          hostName: people.get(m.host_id)?.name ?? "Someone",
          category: m.category,
          startsAt: m.starts_at,
          place: m.place,
          audience: m.audience,
          goingIds: going,
          goingNames: going.map((g) => people.get(g)?.name ?? "Someone"),
        };
      });
    },
    async postMove(input: NewMove) {
      const { data, error } = await sb
        .from("moves")
        .insert({ category: input.category, starts_at: input.startsAt, place: input.place, audience: input.audience })
        .select("id")
        .single();
      fail(error);
      // The host is going to their own move.
      fail((await sb.from("move_joins").insert({ move_id: (data as { id: string }).id })).error);
    },
    async deleteMove(moveId) {
      fail((await sb.from("moves").delete().eq("id", moveId)).error);
    },
    async joinMove(moveId) {
      const { error } = await sb.from("move_joins").upsert({ move_id: moveId, user_id: await uid() });
      fail(error);
    },
    async leaveMove(moveId) {
      fail((await sb.from("move_joins").delete().eq("move_id", moveId).eq("user_id", await uid())).error);
    },
    async listEvents(now) {
      const { from, to } = windowFor(now);
      const { data, error } = await sb.from("campus_events").select("id, title, starts_at, place, url").gte("starts_at", from).lt("starts_at", to).order("starts_at");
      fail(error);
      const events = (data ?? []) as Array<{ id: string; title: string; starts_at: string; place: string; url: string | null }>;
      if (events.length === 0) return [];
      const joins = await sb.from("event_joins").select("event_id, user_id").in("event_id", events.map((e) => e.id));
      fail(joins.error);
      const rows = (joins.data ?? []) as Array<{ event_id: string; user_id: string }>;
      return events.map<CampusEvent>((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.starts_at,
        place: e.place,
        url: e.url ?? undefined,
        goingIds: rows.filter((r) => r.event_id === e.id).map((r) => r.user_id),
      }));
    },
    async joinEvent(eventId) {
      fail((await sb.from("event_joins").upsert({ event_id: eventId, user_id: await uid() })).error);
    },
    async addEvent(event) {
      fail((await sb.rpc("add_campus_event", {
        p_title: event.title,
        p_starts_at: event.startsAt,
        p_place: event.place,
        p_url: event.url,
      })).error);
    },
    async leaveEvent(eventId) {
      fail((await sb.from("event_joins").delete().eq("event_id", eventId).eq("user_id", await uid())).error);
    },
    async getBusy() {
      const { data, error } = await sb.from("busy_blocks").select("day, start_min, end_min");
      fail(error);
      return ((data ?? []) as Array<{ day: number; start_min: number; end_min: number }>).map((r) => ({ day: r.day, start: r.start_min, end: r.end_min }));
    },
    async saveBusy(blocks: BusyBlock[]) {
      const id = await uid();
      fail((await sb.from("busy_blocks").delete().eq("user_id", id)).error);
      if (blocks.length) {
        fail((await sb.from("busy_blocks").insert(blocks.map((b) => ({ user_id: id, day: b.day, start_min: b.start, end_min: b.end })))).error);
      }
    },
    async friendsFreeNow(when) {
      const { data, error } = await sb.rpc("friends_free_now", { dow: when.getDay(), minute: minutesOfDay(when) });
      fail(error);
      return ((data ?? []) as Array<{ friend_id: string }>).map((r) => r.friend_id);
    },
  };
}
