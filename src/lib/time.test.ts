import { clashes, isBusyAt, timeSlots, nextHalfHour, dayOffset } from "./time";
import type { BusyBlock } from "../types";

// Mon Nov 9 2026
const mon = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
const blocks: BusyBlock[] = [{ day: 1, start: 10 * 60, end: 11 * 60 + 20 }];

describe("clashes", () => {
  it("detects overlap with a class", () => {
    expect(clashes(blocks, mon(10, 30))).toBe(true);
    expect(clashes(blocks, mon(9, 30))).toBe(true); // 9:30-10:30 runs into the 10:00 class
  });
  it("allows back-to-back and other days", () => {
    expect(clashes(blocks, mon(9, 0))).toBe(false); // ends exactly when class starts
    expect(clashes(blocks, mon(11, 20))).toBe(false);
    expect(clashes(blocks, new Date(2026, 10, 10, 10, 30))).toBe(false); // Tuesday
  });
});

describe("isBusyAt", () => {
  it("is half-open on the end", () => {
    expect(isBusyAt(blocks, mon(10, 0))).toBe(true);
    expect(isBusyAt(blocks, mon(11, 19))).toBe(true);
    expect(isBusyAt(blocks, mon(11, 20))).toBe(false);
  });
});

describe("timeSlots", () => {
  it("today only offers future slots", () => {
    const slots = timeSlots("today", mon(15, 5));
    expect(slots[0].getHours()).toBe(15);
    expect(slots[0].getMinutes()).toBe(15);
    expect(slots.every((s) => s.getTime() > mon(15, 5).getTime())).toBe(true);
  });
  it("tomorrow offers the whole day from 7:00", () => {
    const slots = timeSlots("tomorrow", mon(15, 5));
    expect(slots[0].getDate()).toBe(10);
    expect(slots[0].getHours()).toBe(7);
    expect(slots.at(-1)!.getHours()).toBe(23);
  });
  it("is empty late at night for today", () => {
    expect(timeSlots("today", mon(23, 50))).toHaveLength(0);
  });
});

describe("nextHalfHour / dayOffset", () => {
  it("rounds up", () => {
    expect(nextHalfHour(mon(15, 5)).getMinutes()).toBe(30);
    const d = nextHalfHour(mon(15, 40));
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(0);
  });
  it("counts calendar days", () => {
    expect(dayOffset(new Date(2026, 10, 10, 1), mon(23, 59))).toBe(1);
    expect(dayOffset(mon(8), mon(23, 59))).toBe(0);
  });
});
