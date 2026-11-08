import type { BusyBlock, Category, Day } from "../types";

export const MOVE_LENGTH_MIN = 60;

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayOffset(startsAt: Date, now: Date): number {
  const ms = startOfDay(startsAt).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

/** True if a one-hour move starting at `startsAt` overlaps any weekly busy block. */
export function clashes(blocks: readonly BusyBlock[], startsAt: Date, lengthMin = MOVE_LENGTH_MIN): boolean {
  const start = minutesOfDay(startsAt);
  const end = start + lengthMin;
  return blocks.some((b) => b.day === startsAt.getDay() && b.start < end && start < b.end);
}

export function isBusyAt(blocks: readonly BusyBlock[], at: Date): boolean {
  const m = minutesOfDay(at);
  return blocks.some((b) => b.day === at.getDay() && b.start <= m && m < b.end);
}

/** 15-minute slots for the chosen day. Today only offers slots that have not passed. */
export function timeSlots(day: Day, now: Date): Date[] {
  const base = startOfDay(day === "today" ? now : addDays(now, 1));
  const slots: Date[] = [];
  for (let m = 7 * 60; m <= 23 * 60 + 45; m += 15) {
    const d = new Date(base);
    d.setMinutes(m);
    if (day === "tomorrow" || d.getTime() > now.getTime()) slots.push(d);
  }
  return slots;
}

/** A sensible default start: the next half hour. */
export function nextHalfHour(now: Date): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export const CATEGORIES: readonly Category[] = ["gym", "food", "study", "hang"];

export const PLACES = [
  "PAC",
  "Student Life Centre",
  "DC Library",
  "Dana Porter Library",
  "Engineering 7",
  "Quantum-Nano Centre",
] as const;
