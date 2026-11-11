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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/friend_requests.sql", "utf8"));
  await db.exec(readFileSync("supabase/delete_account.sql", "utf8"));
  await addUser("me", "me@uwaterloo.ca");
  await addUser("maya", "maya@uwaterloo.ca");
  await as("me", "select accept_invite($1)", [ids.maya]);
  await as("maya", "select send_friend_request($1)", ["me@uwaterloo.ca"]);
  await as("me", "insert into moves (category, starts_at, place, audience) values ('gym', now() + interval '2 hours', 'PAC', 'open')");
});

describe("delete_my_account", () => {
  it("removes the account and everything tied to it", async () => {
    await as("me", "select delete_my_account()");

    const users = (await db.query<{ n: number }>("select count(*)::int as n from auth.users where id = $1", [ids.me])).rows[0].n;
    const profiles = (await db.query<{ n: number }>("select count(*)::int as n from profiles where id = $1", [ids.me])).rows[0].n;
    const friendships = (await db.query<{ n: number }>("select count(*)::int as n from friendships where user_a = $1 or user_b = $1", [ids.me])).rows[0].n;
    const moves = (await db.query<{ n: number }>("select count(*)::int as n from moves where host_id = $1", [ids.me])).rows[0].n;

    expect(users + profiles + friendships + moves).toBe(0);
  });

  it("leaves other people's accounts alone", async () => {
    const rows = await db.query<{ n: number }>("select count(*)::int as n from profiles where id = $1", [ids.maya]);
    expect(rows.rows[0].n).toBe(1);
  });
});
