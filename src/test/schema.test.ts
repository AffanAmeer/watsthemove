import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// Minimal stand-ins for what Supabase provides, so the real schema.sql runs unmodified.
const SHIM = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;
const ids: Record<string, string> = {};

async function addUser(key: string, email: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  ids[key] = r.rows[0].id;
}

/** Run a statement as a signed-in student (row level security applies). */
async function as<T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[who]]);
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

const move = (host: string, audience: string, place = "PAC") =>
  as<{ id: string }>(host, "insert into moves (category, starts_at, place, audience) values ('gym', now() + interval '2 hours', $1, $2) returning id", [place, audience]);

const visibleTo = async (who: string) =>
  (await as<{ place: string }>(who, "select place from moves order by place")).map((r) => r.place);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await addUser("me", "me@uwaterloo.ca");
  await addUser("maya", "maya@uwaterloo.ca");
  await addUser("jordan", "jordan@uwaterloo.ca");
  await addUser("stranger", "stranger@uwaterloo.ca");
  await as("me", "select accept_invite($1)", [ids.maya]);
  await as("me", "select accept_invite($1)", [ids.jordan]);
  // Maya marks me as a close friend; Jordan does not.
  await as("maya", "insert into close_friends (owner, friend) values ($1, $2)", [ids.maya, ids.me]);
});

describe("sign-up gate", () => {
  it("rejects non-UW emails", async () => {
    await expect(db.query("insert into auth.users (email) values ('x@gmail.com')")).rejects.toThrow(/uwaterloo/);
    await expect(db.query("insert into auth.users (email) values ('x@uwaterloo.ca.evil.com')")).rejects.toThrow(/uwaterloo/);
    await expect(db.query("insert into auth.users (email) values ('x@mail.uwaterloo.ca')")).rejects.toThrow(/uwaterloo/);
  });
  it("accepts UW emails and creates a profile without storing the email", async () => {
    const rows = await as<{ name: string }>("me", "select name from profiles where id = $1", [ids.me]);
    expect(rows[0].name).toBe("Me");
    const cols = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'profiles'");
    expect(cols.rows.map((c) => c.column_name)).not.toContain("email");
  });
});

describe("who can see a move", () => {
  beforeAll(async () => {
    await move("maya", "close", "Maya-close");
    await move("maya", "friends", "Maya-friends");
    await move("maya", "open", "Maya-open");
    await move("jordan", "close", "Jordan-close");
    await move("jordan", "friends", "Jordan-friends");
  });

  it("friends see friends moves, and close moves only if marked close", async () => {
    expect(await visibleTo("me")).toEqual(["Jordan-friends", "Maya-close", "Maya-friends", "Maya-open"]);
  });
  it("strangers only see open moves", async () => {
    expect(await visibleTo("stranger")).toEqual(["Maya-open"]);
  });
  it("hosts always see their own", async () => {
    // Jordan is not friends with Maya, so only her open move shows up besides his own.
    expect(await visibleTo("jordan")).toEqual(["Jordan-close", "Jordan-friends", "Maya-open"]);
  });
});

describe("joining", () => {
  it("lets you join a move you can see", async () => {
    const [m] = await move("maya", "friends", "Join-me");
    await as("me", "insert into move_joins (move_id) values ($1)", [m.id]);
    const joins = await as("maya", "select user_id from move_joins where move_id = $1", [m.id]);
    expect(joins.map((j) => (j as { user_id: string }).user_id)).toEqual([ids.me]);
  });
  it("blocks joining a move you cannot see", async () => {
    // Me and Jordan are friends, but Jordan did not mark me as close.
    const [m] = await move("jordan", "close", "Hidden");
    await expect(as("me", "insert into move_joins (move_id) values ($1)", [m.id])).rejects.toThrow();
  });
  it("blocks joining as someone else", async () => {
    const [m] = await move("maya", "open", "Open-join");
    await expect(as("me", "insert into move_joins (move_id, user_id) values ($1, $2)", [m.id, ids.maya])).rejects.toThrow();
  });
  it("hides who joined a move from people who cannot see the move", async () => {
    const [m] = await move("maya", "close", "Secret-gym");
    await as("me", "insert into move_joins (move_id) values ($1)", [m.id]);
    expect(await as("stranger", "select * from move_joins where move_id = $1", [m.id])).toHaveLength(0);
  });
});

describe("posting", () => {
  it("cannot post a move as someone else", async () => {
    await expect(
      as("me", "insert into moves (host_id, category, starts_at, place, audience) values ($1, 'gym', now(), 'PAC', 'open')", [ids.maya]),
    ).rejects.toThrow();
  });
  it("only the host can delete a move", async () => {
    const [m] = await move("maya", "open", "Keep-me");
    await as("me", "delete from moves where id = $1", [m.id]);
    expect(await as("maya", "select 1 from moves where id = $1", [m.id])).toHaveLength(1);
    await as("maya", "delete from moves where id = $1", [m.id]);
    expect(await as("maya", "select 1 from moves where id = $1", [m.id])).toHaveLength(0);
  });
});

describe("friends and invites", () => {
  it("cannot invite yourself", async () => {
    await expect(as("me", "select accept_invite($1)", [ids.me])).rejects.toThrow(/yourself/);
  });
  it("inviting twice is harmless", async () => {
    await as("me", "select accept_invite($1)", [ids.maya]);
    expect(await as("me", "select * from friendships")).toHaveLength(2);
  });
  it("cannot create a friendship directly", async () => {
    await expect(as("stranger", "insert into friendships (user_a, user_b) values ($1, $2)", [ids.me < ids.stranger ? ids.me : ids.stranger, ids.me < ids.stranger ? ids.stranger : ids.me])).rejects.toThrow();
  });
  it("cannot mark a non-friend as close", async () => {
    await expect(as("me", "insert into close_friends (owner, friend) values ($1, $2)", [ids.me, ids.stranger])).rejects.toThrow();
  });
});

describe("schedules stay private", () => {
  beforeAll(async () => {
    await as("maya", "insert into busy_blocks (day, start_min, end_min) values (1, 600, 680), (3, 600, 680)");
  });
  it("friends cannot read someone's busy blocks", async () => {
    expect(await as("me", "select * from busy_blocks where user_id = $1", [ids.maya])).toHaveLength(0);
  });
  it("friends_free_now says free or busy without revealing blocks", async () => {
    const busy = await as<{ friend_id: string }>("me", "select * from friends_free_now(1, 620)");
    expect(busy.map((r) => r.friend_id)).not.toContain(ids.maya);
    const free = await as<{ friend_id: string }>("me", "select * from friends_free_now(1, 700)");
    expect(free.map((r) => r.friend_id)).toContain(ids.maya);
  });
  it("friends with no schedule are not reported as free", async () => {
    const free = await as<{ friend_id: string }>("me", "select * from friends_free_now(1, 700)");
    expect(free.map((r) => r.friend_id)).not.toContain(ids.jordan);
  });
  it("strangers get nobody", async () => {
    expect(await as("stranger", "select * from friends_free_now(1, 700)")).toHaveLength(0);
  });
});

describe("campus events", () => {
  it("students can read but not write events", async () => {
    await db.exec("insert into campus_events (title, starts_at) values ('Drop-in Volleyball', now())");
    expect(await as("me", "select * from campus_events")).toHaveLength(1);
    await expect(as("me", "insert into campus_events (title, starts_at) values ('Fake', now())")).rejects.toThrow();
  });
});
