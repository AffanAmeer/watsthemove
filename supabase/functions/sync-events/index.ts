// Supabase Edge Function: pulls the Explore Waterloo Region iCalendar feed,
// keeps campus-area events, and upserts them into public.campus_events.
//
// Deploy:  supabase functions deploy sync-events --no-verify-jwt
// Secret:  supabase secrets set SYNC_SECRET=<a long random string>
// Call:    curl -X POST https://<project>.supabase.co/functions/v1/sync-events -H "x-sync-secret: <same string>"

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseFeed } from "./feed.ts";

const FEED_URL = "https://explorewaterloo.ca/events/list/?ical=1";
const KEEP_PAST_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "use POST" }, 405);
  }

  const expected = Deno.env.get("SYNC_SECRET");
  if (!expected || req.headers.get("x-sync-secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const feedRes = await fetch(FEED_URL, {
    headers: { "User-Agent": "WatsTheMove event sync (student project)" },
  });
  if (!feedRes.ok) {
    return json({ error: "feed unavailable", status: feedRes.status }, 502);
  }

  const events = parseFeed(await feedRes.text());

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (events.length > 0) {
    const rows = events.map((e) => ({
      source_uid: e.uid,
      title: e.title,
      starts_at: e.startsAt,
      place: e.place,
      url: e.url,
    }));
    const { error } = await supabase
      .from("campus_events")
      .upsert(rows, { onConflict: "source_uid" });
    if (error) {
      return json({ error: "upsert failed", detail: error.message }, 500);
    }
  }

  // Drop synced events that ended a while ago. Hand-added events have no source_uid and are kept.
  const cutoff = new Date(Date.now() - KEEP_PAST_HOURS * 3600_000).toISOString();
  const { error: pruneError } = await supabase
    .from("campus_events")
    .delete()
    .not("source_uid", "is", null)
    .lt("starts_at", cutoff);
  if (pruneError) {
    return json({ synced: events.length, pruneError: pruneError.message }, 200);
  }

  return json({ synced: events.length }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
