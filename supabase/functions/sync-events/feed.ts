// Parses an iCalendar (.ics) events feed into campus-area events.
// Pure functions only, so the same code runs in the Supabase Edge Function (Deno)
// and in the Vitest suite (Node).

export type FeedEvent = {
  uid: string;
  title: string;
  startsAt: string; // ISO 8601, UTC
  place: string;
  url: string | null;
};

export type ParseOptions = {
  /** When true (default), keep only events whose location matches CAMPUS_AREA. */
  campusOnly?: boolean;
  /** Time zone for floating or unqualified times. */
  defaultTimeZone?: string;
};

/**
 * Keywords that mark a location as campus-area. This is an approximation:
 * the feed gives free-text locations, not coordinates. Edit this list to tune it.
 */
export const CAMPUS_AREA = [
  "university of waterloo",
  "wilfrid laurier",
  "uptown waterloo",
  "waterloo public square",
  "public square",
  "waterloo, on",
];

export function isCampusArea(location: string): boolean {
  const lower = location.toLowerCase();
  return CAMPUS_AREA.some((keyword) => lower.includes(keyword));
}

/** Undo RFC 5545 line folding: a line starting with a space or tab continues the previous line. */
function unfold(text: string): string[] {
  const joined = text.replace(/\r?\n[ \t]/g, "");
  return joined.split(/\r?\n/).filter((line) => line.length > 0);
}

/** Undo RFC 5545 text escaping. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type Property = { name: string; params: Record<string, string>; value: string };

function parseProperty(line: string): Property {
  const colon = line.indexOf(":");
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

/** Offset of `timeZone` from UTC, in ms, at the given instant. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallClockAsUtc - instantMs;
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC ISO string.
 * `naiveMs` is the wall-clock time written as if it were UTC.
 */
function wallClockToUtcIso(naiveMs: number, timeZone: string): string {
  const firstGuess = naiveMs - zoneOffsetMs(naiveMs, timeZone);
  const corrected = naiveMs - zoneOffsetMs(firstGuess, timeZone);
  return new Date(corrected).toISOString();
}

/** Parse a DTSTART value. Returns null for all-day or unparseable values. */
function parseDateTime(value: string, tzid: string | undefined, defaultTz: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, zulu] = match;
  const naiveMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (zulu === "Z") return new Date(naiveMs).toISOString();
  return wallClockToUtcIso(naiveMs, tzid ?? defaultTz);
}

export function parseFeed(text: string, options: ParseOptions = {}): FeedEvent[] {
  const campusOnly = options.campusOnly ?? true;
  const defaultTz = options.defaultTimeZone ?? "America/Toronto";

  const events: FeedEvent[] = [];
  const seen = new Set<string>();
  let current: Record<string, Property> | null = null;

  for (const line of unfold(text)) {
    const prop = parseProperty(line);

    if (prop.name === "BEGIN" && prop.value === "VEVENT") {
      current = {};
      continue;
    }
    if (prop.name === "END" && prop.value === "VEVENT") {
      if (current) {
        const built = buildEvent(current, defaultTz);
        if (built && !seen.has(built.uid) && (!campusOnly || isCampusArea(built.place))) {
          seen.add(built.uid);
          events.push(built);
        }
      }
      current = null;
      continue;
    }
    if (current) current[prop.name] = prop;
  }

  return events;
}

function buildEvent(fields: Record<string, Property>, defaultTz: string): FeedEvent | null {
  const uid = fields["UID"]?.value;
  const title = fields["SUMMARY"] ? unescapeText(fields["SUMMARY"].value) : null;
  const dtstart = fields["DTSTART"];
  if (!uid || !title || !dtstart) return null;
  if (fields["STATUS"]?.value.toUpperCase() === "CANCELLED") return null;

  const startsAt = parseDateTime(dtstart.value, dtstart.params["TZID"], defaultTz);
  if (!startsAt) return null;

  const place = fields["LOCATION"] ? unescapeText(fields["LOCATION"].value).slice(0, 120) : "Campus";
  const url = fields["URL"]?.value ?? null;

  return { uid, title, startsAt, place, url };
}
