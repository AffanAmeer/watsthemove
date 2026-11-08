import type { BusyBlock } from "../types";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

/** Parses 20261102T103000 (optionally with trailing Z) into a local-time Date. Z times are treated as UTC. */
function parseIcsDate(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  return z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

function dedupe(blocks: BusyBlock[]): BusyBlock[] {
  const seen = new Set<string>();
  return blocks.filter((b) => {
    const k = `${b.day}-${b.start}-${b.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Turns a calendar export into weekly busy blocks. Only the day of week and time of day are kept,
 * so the app never stores course names, rooms or dates. Repeating events with BYDAY make one
 * block per listed day. All-day events are ignored.
 */
export function parseIcs(text: string): BusyBlock[] {
  const lines = unfold(text);
  const blocks: BusyBlock[] = [];
  let cur: { start?: Date; end?: Date; byDay: number[]; allDay: boolean } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = { byDay: [], allDay: false };
    else if (line === "END:VEVENT" && cur) {
      if (cur.start && cur.end && !cur.allDay) {
        const start = cur.start.getHours() * 60 + cur.start.getMinutes();
        let end = cur.end.getHours() * 60 + cur.end.getMinutes();
        if (end <= start) end = 24 * 60;
        const days = cur.byDay.length ? cur.byDay : [cur.start.getDay()];
        for (const day of days) blocks.push({ day, start, end });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const name = line.slice(0, idx);
      const value = line.slice(idx + 1);
      if (name.startsWith("DTSTART")) {
        cur.allDay = name.includes("VALUE=DATE") && !name.includes("DATE-TIME");
        cur.start = parseIcsDate(value) ?? undefined;
      } else if (name.startsWith("DTEND")) cur.end = parseIcsDate(value) ?? undefined;
      else if (name === "RRULE") {
        const by = value.match(/BYDAY=([^;]+)/)?.[1];
        if (by) {
          cur.byDay = by
            .split(",")
            .map((d) => DAY_CODES.indexOf(d.replace(/^[-+]?\d+/, "")))
            .filter((i) => i >= 0);
        }
      }
    }
  }
  return dedupe(blocks);
}

function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}

/** A one-event calendar file for "Add to calendar". */
export function buildIcs(e: { id: string; title: string; startsAt: string; place: string; minutes?: number }): string {
  const start = new Date(e.startsAt);
  const end = new Date(start.getTime() + (e.minutes ?? 60) * 60_000);
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WatsTheMove//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@watsthemove`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.place)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
