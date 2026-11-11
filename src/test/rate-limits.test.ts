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

async function as(who: string, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[who]]);
  await db.exec("set role authenticated");
  try {
    await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

const postMove = (who: string) =>
  as(who, "insert into moves (category, starts_at, place, audience) values ('hang', now() + interval '1 hour', 'DC', 'open')");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/friend_requests.sql", "utf8"));
  await db.exec(readFileSync("supabase/rate_limits.sql", "utf8"));
  await addUser("me", "me@uwaterloo.ca");
  for (let i = 0; i < 31; i++) await addUser(`t${i}`, `t${i}@uwaterloo.ca`);
});

describe("rate limits", () => {
  it("allows 20 moves in an hour and blocks the 21st", async () => {
    for (let i = 0; i < 20; i++) await postMove("me");
    await expect(postMove("me")).rejects.toThrow(/Too many/);
  });

  it("does not let deleting a move reset the count", async () => {
    await as("me", "delete from moves where host_id = (select id from profiles where id = auth.uid())");
    await expect(postMove("me")).rejects.toThrow(/Too many/);
  });

  it("allows 30 friend requests a day and blocks the 31st", async () => {
    for (let i = 0; i < 30; i++) await as("me", "select send_friend_request($1)", [`t${i}@uwaterloo.ca`]);
    await expect(as("me", "select send_friend_request($1)", ["t30@uwaterloo.ca"])).rejects.toThrow(/Too many/);
  });
});
