import { useMemo, useState } from "react";
import type { Audience, Category, Day, NewMove } from "../types";
import { CATEGORIES, PLACES, formatTime, nextHalfHour, timeSlots } from "../lib/time";
import { AUDIENCE_ICON, AUDIENCE_LABEL, CATEGORY_ICON, CATEGORY_LABEL, Header, Icon } from "../ui";

function defaultSlot(day: Day, now: Date, slots: Date[]): string {
  const target = day === "today" ? nextHalfHour(now).getTime() : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12).getTime();
  return (slots.find((s) => s.getTime() >= target) ?? slots[0])?.toISOString() ?? "";
}

export function Post({ now, onBack, onPost }: { now: Date; onBack: () => void; onPost: (m: NewMove) => Promise<void> }) {
  const todaySlots = useMemo(() => timeSlots("today", now), [now]);
  const [day, setDay] = useState<Day>(todaySlots.length ? "today" : "tomorrow");
  const slots = useMemo(() => timeSlots(day, now), [day, now]);
  const [category, setCategory] = useState<Category>("gym");
  const [time, setTime] = useState(() => defaultSlot(day, now, slots));
  const [place, setPlace] = useState<string>(PLACES[0]);
  const [audience, setAudience] = useState<Audience>("friends");
  const [busy, setBusy] = useState(false);

  function pickDay(d: Day) {
    setDay(d);
    setTime(defaultSlot(d, now, timeSlots(d, now)));
  }

  return (
    <>
      <Header title="What's the move?" onBack={onBack} />
      <div className="stack" style={{ marginTop: 8 }}>
        <div className="grid4" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c} role="radio" aria-checked={category === c} className={`tile ${category === c ? "selected" : ""}`} onClick={() => setCategory(c)}>
              <Icon name={CATEGORY_ICON[c]} size={26} />{CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="segmented" role="radiogroup" aria-label="Day">
          {(["today", "tomorrow"] as const).map((d) => (
            <button key={d} role="radio" aria-checked={day === d} className={day === d ? "selected" : ""} disabled={d === "today" && todaySlots.length === 0} onClick={() => pickDay(d)}>
              {d === "today" ? "Today" : "Tomorrow"}
            </button>
          ))}
        </div>

        <label className="field">
          <Icon name="clock" />
          <select aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)}>
            {slots.map((s) => <option key={s.toISOString()} value={s.toISOString()}>{formatTime(s)}</option>)}
          </select>
        </label>

        <label className="field">
          <Icon name="pin" />
          <select aria-label="Place" value={place} onChange={(e) => setPlace(e.target.value)}>
            {PLACES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>

        <div className="grid3" role="radiogroup" aria-label="Who can join">
          {(["close", "friends", "open"] as const).map((a) => (
            <button key={a} role="radio" aria-checked={audience === a} className={`tile ${audience === a ? "selected" : ""}`} onClick={() => setAudience(a)}>
              <Icon name={AUDIENCE_ICON[a]} size={24} />{AUDIENCE_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="bottom-action">
        <button className="primary" disabled={busy || !time}
          onClick={async () => { setBusy(true); try { await onPost({ category, startsAt: time, place, audience }); } finally { setBusy(false); } }}>
          Post move
        </button>
      </div>
    </>
  );
}
