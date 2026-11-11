import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

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

const incoming = (who: string) =>
  as<{ from_id: string }>(who, "select from_id from friend_requests");

const friendsOf = (who: string) =>
  as<{ n: number }>(who, "select count(*)::int as n from friendships");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/friend_requests.sql", "utf8"));
  await addUser("me", "me@uwaterloo.ca");
  await addUser("maya", "maya@uwaterloo.ca");
  await addUser("jordan", "jordan@uwaterloo.ca");
});

describe("friend requests by UW email", () => {
  it("creates a request the target can see, and the sender cannot see it", async () => {
    await as("me", "select send_friend_request($1)", ["maya@uwaterloo.ca"]);
    expect((await incoming("maya")).map((r) => r.from_id)).toEqual([ids.me]);
    expect(await incoming("me")).toEqual([]);
  });

  it("says nothing useful for an unknown email, and creates nothing", async () => {
    await expect(as("me", "select send_friend_request($1)", ["nobody@uwaterloo.ca"])).resolves.toBeDefined();
    expect(await incoming("me")).toEqual([]);
  });

  it("does not create a request to yourself", async () => {
    await as("me", "select send_friend_request($1)", ["me@uwaterloo.ca"]);
    expect(await incoming("me")).toEqual([]);
  });

  it("accepting creates a friendship and clears the request", async () => {
    await as("maya", "select respond_friend_request($1, true)", [ids.me]);
    expect((await friendsOf("me"))[0].n).toBe(1);
    expect((await friendsOf("maya"))[0].n).toBe(1);
    expect(await incoming("maya")).toEqual([]);
  });

  it("declining clears the request without a friendship", async () => {
    await as("me", "select send_friend_request($1)", ["jordan@uwaterloo.ca"]);
    await as("jordan", "select respond_friend_request($1, false)", [ids.me]);
    expect(await incoming("jordan")).toEqual([]);
    expect((await friendsOf("jordan"))[0].n).toBe(0);
  });

  it("a request in both directions becomes a friendship straight away", async () => {
    await as("jordan", "select send_friend_request($1)", ["me@uwaterloo.ca"]);
    await as("me", "select send_friend_request($1)", ["jordan@uwaterloo.ca"]);
    expect(await incoming("me")).toEqual([]);
    expect(await incoming("jordan")).toEqual([]);
  });
});
