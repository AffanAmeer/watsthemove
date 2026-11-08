import { parseIcs, buildIcs } from "./ics";

const sample = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20261102T103000",
  "DTEND:20261102T112000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261204T000000",
  "SUMMARY:MATH 115 LEC 001",
  "LOCATION:RCH 101",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Toronto:20261103T140000",
  "DTEND;TZID=America/Toronto:20261103T153000",
  "SUMMARY:One-off lab",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261105",
  "DTEND;VALUE=DATE:20261106",
  "SUMMARY:All day thing",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  const blocks = parseIcs(sample);
  it("expands BYDAY into one block per day", () => {
    const lec = blocks.filter((b) => b.start === 10 * 60 + 30);
    expect(lec.map((b) => b.day).sort()).toEqual([1, 3, 5]);
    expect(lec[0].end).toBe(11 * 60 + 20);
  });
  it("uses the start weekday for non-repeating events", () => {
    expect(blocks).toContainEqual({ day: 2, start: 14 * 60, end: 15 * 60 + 30 });
  });
  it("ignores all-day events", () => {
    expect(blocks).toHaveLength(4);
  });
  it("never keeps course names or rooms", () => {
    expect(JSON.stringify(blocks)).not.toMatch(/MATH|RCH|lab/i);
  });
  it("handles folded lines and junk input", () => {
    expect(parseIcs("not a calendar")).toEqual([]);
    const folded = "BEGIN:VEVENT\r\nDTSTART:20261102T0900\r\n 00\r\nDTEND:20261102T100000\r\nEND:VEVENT";
    expect(parseIcs(folded)).toEqual([{ day: 1, start: 540, end: 600 }]);
  });
});

describe("buildIcs", () => {
  it("makes a valid one-event calendar", () => {
    const out = buildIcs({ id: "abc", title: "Gym", startsAt: "2026-11-09T21:00:00.000Z", place: "PAC, main floor" });
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out).toContain("DTSTART:20261109T210000Z");
    expect(out).toContain("DTEND:20261109T220000Z");
    expect(out).toContain("LOCATION:PAC\\, main floor");
    expect(out.endsWith("\r\n")).toBe(true);
  });
});
