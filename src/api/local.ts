import type { BusyBlock, CampusEvent, Friend, Me, Move, NewMove } from "../types";
import { canSeeMove } from "../lib/visibility";
import { isBusyAt, startOfDay } from "../lib/time";
import { type Api, AppError, UW_EMAIL } from "./types";

export const DEMO_CODE = "123456";

type Store = {
  meId: string | null;
  email: string;
  names: Record<string, { name: string; program: string }>;
  friends: string[];
  close: Record<string, string[]>; // owner -> friend ids marked close
  moves: Array<Omit<Move, "goingNames" | "hostName">>;
  events: CampusEvent[];
  busy: Record<string, BusyBlock[]>;
  seededOn: string;
  counter: number;
};

const KEY = "wtm-demo-v1";
const ME = "me";

const PEOPLE: Record<string, { name: string; program: string }> = {
  maya: { name: "Maya", program: "Kinesiology" },
  jordan: { name: "Jordan", program: "Mathematics" },
  sam: { name: "Sam", program: "Systems Design Eng" },
  priya: { name: "Priya", program: "Management Eng" },
  stranger: { name: "Alex", program: "Computer Science" },
};

const CLASSES_MWF_MORNING: BusyBlock[] = [1, 3, 5].map((day) => ({ day, start: 9 * 60 + 30, end: 11 * 60 + 20 }));

function at(base: Date, h: number, m = 0): string {
  const d = startOfDay(base);
  d.setHours(h, m);
  return d.toISOString();
}

function seed(s: Store, now: Date) {
  const hour = now.getHours();
  const t = (plus: number) => at(now, Math.min(22, hour + plus), now.getMinutes() < 30 ? 30 : 0);
  s.moves = s.moves.filter((m) => m.hostId === ME);
  s.moves.push(
    { id: "seed-gym", hostId: "maya", category: "gym", startsAt: t(2), place: "PAC", audience: "close", goingIds: ["maya", "priya"] },
    { id: "seed-food", hostId: "jordan", category: "food", startsAt: t(3), place: "Student Life Centre", audience: "friends", goingIds: ["jordan", "priya", "maya"] },
    { id: "seed-study", hostId: "sam", category: "study", startsAt: t(4), place: "DC Library", audience: "open", goingIds: ["sam"] },
    { id: "seed-hidden", hostId: "jordan", category: "hang", startsAt: t(2), place: "Dana Porter Library", audience: "close", goingIds: ["jordan"] },
  );
  const noon = new Date(now);
  s.events = [
    { id: "seed-ev1", title: "Drop-in Volleyball", startsAt: at(noon, 17, 30), place: "PAC", goingIds: ["jordan", "sam"] },
    { id: "seed-ev2", title: "Trip Around the World at Village 1", startsAt: at(noon, 18, 0), place: "Village 1", goingIds: [] },
  ];
  s.seededOn = startOfDay(now).toDateString();
}

function fresh(now: Date): Store {
  const s: Store = {
    meId: null,
    email: "",
    names: { ...PEOPLE, [ME]: { name: "", program: "" } },
    friends: ["maya", "jordan", "sam", "priya"],
    close: { maya: [ME], jordan: [] },
    moves: [],
    events: [],
    busy: { maya: CLASSES_MWF_MORNING, jordan: CLASSES_MWF_MORNING, sam: [{ day: 2, start: 600, end: 680 }], [ME]: [] },
    seededOn: "",
    counter: 0,
  };
  seed(s, now);
  return s;
}

/** A backend that lives entirely in this browser. Used for demos, tests, and when no Supabase keys are set. */
export function createLocalApi(storage: Storage = localStorage, clock: () => Date = () => new Date()): Api {
  const load = (): Store => {
    const raw = storage.getItem(KEY);
    const s: Store = raw ? JSON.parse(raw) : fresh(clock());
    if (s.seededOn !== startOfDay(clock()).toDateString()) seed(s, clock());
    return s;
  };
  const save = (s: Store) => storage.setItem(KEY, JSON.stringify(s));
  const mutate = <T,>(fn: (s: Store) => T): T => {
    const s = load();
    const out = fn(s);
    save(s);
    return out;
  };
  const me = (s: Store): Me | null =>
    s.meId ? { id: s.meId, email: s.email, name: s.names[s.meId].name, program: s.names[s.meId].program } : null;
  const needMe = (s: Store): string => {
    if (!s.meId) throw new AppError("Not signed in");
    return s.meId;
  };
  const nameOf = (s: Store, id: string) => s.names[id]?.name || "Someone";

  return {
    mode: "demo",
    async getMe() {
      return me(load());
    },
    async addEvent() {
      throw new AppError("Adding events needs the live backend");
    },
    async listIncomingRequests() {
      return [];
    },
    async sendFriendRequest() {
      throw new AppError("Friend requests need the live backend");
    },
    async respondToRequest() {
      throw new AppError("Friend requests need the live backend");
    },
    async sendCode(email) {
      if (!UW_EMAIL.test(email.trim())) throw new AppError("Use your @uwaterloo.ca email");
    },
    async verifyCode(email, code) {
      if (!UW_EMAIL.test(email.trim())) throw new AppError("Use your @uwaterloo.ca email");
      if (code.trim() !== DEMO_CODE) throw new AppError("That code isn't right");
      return mutate((s) => {
        s.meId = ME;
        s.email = email.trim().toLowerCase();
        if (!s.names[ME].name) s.names[ME].name = "";
        return me(s)!;
      });
    },
    async signOut() {
      mutate((s) => {
        s.meId = null;
      });
    },
    async deleteAccount() {
      mutate((s) => {
        const id = needMe(s);
        s.moves = s.moves
          .filter((m) => m.hostId !== id)
          .map((m) => ({ ...m, goingIds: m.goingIds.filter((g) => g !== id) }));
        s.events = s.events.map((e) => ({ ...e, goingIds: e.goingIds.filter((g) => g !== id) }));
        s.close[id] = [];
        s.busy[id] = [];
        s.names[id] = { name: "", program: "" };
        s.meId = null;
        s.email = "";
      });
    },
    async saveName(name) {
      return mutate((s) => {
        const id = needMe(s);
        s.names[id].name = name.trim().slice(0, 40);
        return me(s)!;
      });
    },
    async listFriends(): Promise<Friend[]> {
      const s = load();
      const id = needMe(s);
      return s.friends.map((f) => ({
        id: f,
        name: s.names[f].name,
        program: s.names[f].program,
        isClose: (s.close[id] ?? []).includes(f),
      }));
    },
    async setClose(friendId, close) {
      mutate((s) => {
        const id = needMe(s);
        const set = new Set(s.close[id] ?? []);
        if (close) set.add(friendId);
        else set.delete(friendId);
        s.close[id] = [...set];
      });
    },
    async acceptInvite(inviterId) {
      mutate((s) => {
        const id = needMe(s);
        if (inviterId === id) throw new AppError("That's your own link");
        if (!s.names[inviterId]) s.names[inviterId] = { name: "New friend", program: "" };
        if (!s.friends.includes(inviterId)) s.friends.push(inviterId);
      });
    },
    async listMoves(now) {
      const s = load();
      const viewerId = needMe(s);
      const ctx = {
        viewerId,
        friendIds: new Set(s.friends),
        closeByHost: new Map(Object.entries(s.close).map(([k, v]) => [k, new Set(v)])),
      };
      const from = now.getTime() - 60 * 60_000;
      const to = startOfDay(now).getTime() + 2 * 86_400_000;
      return s.moves
        .filter((m) => canSeeMove(m, ctx))
        .filter((m) => {
          const t = new Date(m.startsAt).getTime();
          return t >= from && t < to;
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((m) => ({ ...m, hostName: nameOf(s, m.hostId), goingNames: m.goingIds.map((g) => nameOf(s, g)) }));
    },
    async postMove(input: NewMove) {
      mutate((s) => {
        const id = needMe(s);
        s.counter += 1;
        s.moves.push({ id: `mine-${s.counter}`, hostId: id, ...input, goingIds: [id] });
      });
    },
    async deleteMove(moveId) {
      mutate((s) => {
        const id = needMe(s);
        s.moves = s.moves.filter((m) => !(m.id === moveId && m.hostId === id));
      });
    },
    async joinMove(moveId) {
      mutate((s) => {
        const id = needMe(s);
        const m = s.moves.find((x) => x.id === moveId);
        if (!m) throw new AppError("That move is gone");
        if (!m.goingIds.includes(id)) m.goingIds.push(id);
      });
    },
    async leaveMove(moveId) {
      mutate((s) => {
        const id = needMe(s);
        const m = s.moves.find((x) => x.id === moveId);
        if (m) m.goingIds = m.goingIds.filter((g) => g !== id);
      });
    },
    async listEvents(now) {
      const s = load();
      const from = now.getTime() - 60 * 60_000;
      const to = startOfDay(now).getTime() + 2 * 86_400_000;
      return s.events.filter((e) => {
        const t = new Date(e.startsAt).getTime();
        return t >= from && t < to;
      });
    },
    async joinEvent(eventId) {
      mutate((s) => {
        const id = needMe(s);
        const e = s.events.find((x) => x.id === eventId);
        if (e && !e.goingIds.includes(id)) e.goingIds.push(id);
      });
    },
    async leaveEvent(eventId) {
      mutate((s) => {
        const id = needMe(s);
        const e = s.events.find((x) => x.id === eventId);
        if (e) e.goingIds = e.goingIds.filter((g) => g !== id);
      });
    },
    async getBusy() {
      const s = load();
      return s.busy[needMe(s)] ?? [];
    },
    async saveBusy(blocks) {
      mutate((s) => {
        s.busy[needMe(s)] = blocks;
      });
    },
    async friendsFreeNow(when) {
      const s = load();
      return s.friends.filter((f) => (s.busy[f]?.length ?? 0) > 0 && !isBusyAt(s.busy[f], when));
    },
  };
}
