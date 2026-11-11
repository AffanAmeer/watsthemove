import { describe, expect, it } from "vitest";
import { isCampusArea, parseFeed } from "../../supabase/functions/sync-events/feed";

const SAMPLE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:ayr-1@explorewaterloo.ca",
  "SUMMARY:Teen Studio\\, Ceramic Workshop",
  "DTSTART;TZID=America/Toronto:20261111T163000",
  "LOCATION:Region of Waterloo Library – Ayr Branch\\, 137 Stanley St.\\, Ayr\\, ON",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:trivia-1@explorewaterloo.ca",
  "SUMMARY:Wednesday Trivia",
  "DTSTART;TZID=America/Toronto:20261111T190000",
  "LOCATION:Uptown Waterloo, 35 King St N, Waterloo, ON",
  "URL:https://example.com/trivia",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled-1@explorewaterloo.ca",
  "SUMMARY:Cancelled thing",
  "STATUS:CANCELLED",
  "DTSTART:20261112T100000Z",
  "LOCATION:Waterloo, ON",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:folded-1@explorewaterloo.ca",
  "SUMMARY:A very long title that the feed ",
  " folds onto a second line",
  "DTSTART:20261112T150000Z",
  "LOCATION:University of Waterloo, Student Life Centre",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseFeed", () => {
  it("keeps only campus-area events by default and drops cancelled ones", () => {
    const events = parseFeed(SAMPLE);
    expect(events.map((e) => e.uid)).toEqual(["trivia-1@explorewaterloo.ca", "folded-1@explorewaterloo.ca"]);
  });

  it("converts Toronto wall-clock times to UTC (EST, UTC-5 in November)", () => {
    const trivia = parseFeed(SAMPLE).find((e) => e.uid.startsWith("trivia"));
    // 19:00 Toronto on Nov 11 is 00:00 UTC on Nov 12.
    expect(trivia?.startsAt).toBe("2026-11-12T00:00:00.000Z");
  });

  it("unescapes commas and keeps the URL", () => {
    const all = parseFeed(SAMPLE, { campusOnly: false });
    const ayr = all.find((e) => e.uid.startsWith("ayr"));
    expect(ayr?.title).toBe("Teen Studio, Ceramic Workshop");
    expect(ayr?.startsAt).toBe("2026-11-11T21:30:00.000Z");
    const trivia = all.find((e) => e.uid.startsWith("trivia"));
    expect(trivia?.url).toBe("https://example.com/trivia");
  });

  it("unfolds continued lines", () => {
    const folded = parseFeed(SAMPLE).find((e) => e.uid.startsWith("folded"));
    expect(folded?.title).toBe("A very long title that the feed folds onto a second line");
  });

  it("reads UTC (Z) times directly", () => {
    const folded = parseFeed(SAMPLE).find((e) => e.uid.startsWith("folded"));
    expect(folded?.startsAt).toBe("2026-11-12T15:00:00.000Z");
  });

  it("returns nothing for an empty or non-calendar input", () => {
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("hello world")).toEqual([]);
  });
});

describe("isCampusArea", () => {
  it("matches campus and uptown locations and rejects other towns", () => {
    expect(isCampusArea("University of Waterloo, Student Life Centre")).toBe(true);
    expect(isCampusArea("Uptown Waterloo, 35 King St N, Waterloo, ON")).toBe(true);
    expect(isCampusArea("Region of Waterloo Library – Ayr Branch, Ayr, ON")).toBe(false);
    expect(isCampusArea("EVO Kitchen & Bar, 31 Water Street S., Cambridge, ON")).toBe(false);
  });
});
