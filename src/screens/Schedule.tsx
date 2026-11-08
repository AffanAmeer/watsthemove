import { useRef, useState } from "react";
import type { BusyBlock } from "../types";
import { parseIcs } from "../lib/ics";
import { Header, Icon } from "../ui";

const DAYS = [
  { n: 1, short: "M", full: "Monday" }, { n: 2, short: "T", full: "Tuesday" }, { n: 3, short: "W", full: "Wednesday" },
  { n: 4, short: "Th", full: "Thursday" }, { n: 5, short: "F", full: "Friday" }, { n: 6, short: "S", full: "Saturday" }, { n: 0, short: "Su", full: "Sunday" },
];

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h % 12 || 12}:${mm} ${h >= 12 && h < 24 ? "PM" : "AM"}`;
}

const STEPS = Array.from({ length: 31 }, (_, i) => 7 * 60 + i * 30); // 7:00 .. 22:00

export function Schedule({ initial, onBack, onSave }: { initial: BusyBlock[]; onBack: () => void; onSave: (b: BusyBlock[]) => Promise<void> }) {
  const [blocks, setBlocks] = useState<BusyBlock[]>(initial);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState(9 * 60 + 30);
  const [end, setEnd] = useState(10 * 60 + 30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError("");
    const parsed = parseIcs(await f.text());
    if (parsed.length === 0) return setError("No classes found in that file");
    setBlocks(parsed);
  }

  function addBlock() {
    if (days.length === 0) return setError("Pick a day");
    if (end <= start) return setError("End must be after start");
    setError("");
    const added = days.map((day) => ({ day, start, end }));
    setBlocks((cur) => [...cur, ...added].filter((b, i, a) => a.findIndex((x) => x.day === b.day && x.start === b.start && x.end === b.end) === i));
    setDays([]);
  }

  const sorted = [...blocks].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start - b.start);

  return (
    <>
      <Header title="My classes" onBack={onBack} />
      <div className="stack" style={{ marginTop: 8 }}>
        <input ref={file} type="file" accept=".ics,text/calendar" hidden aria-label="Calendar file" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="pill" style={{ justifyContent: "center", height: 56 }} onClick={() => file.current?.click()}>
          <Icon name="upload" /> Upload .ics
        </button>

        <div className="days" role="group" aria-label="Days">
          {DAYS.map((d) => (
            <button key={d.n} className={`chip ${days.includes(d.n) ? "selected" : ""}`} aria-label={d.full} aria-pressed={days.includes(d.n)}
              onClick={() => setDays((cur) => (cur.includes(d.n) ? cur.filter((x) => x !== d.n) : [...cur, d.n]))}>{d.short}</button>
          ))}
        </div>
        <div className="row2">
          <label className="field"><Icon name="clock" /><select aria-label="Start" value={start} onChange={(e) => setStart(+e.target.value)}>
            {STEPS.map((m) => <option key={m} value={m}>{fmtMin(m)}</option>)}</select></label>
          <label className="field"><Icon name="clock" /><select aria-label="End" value={end} onChange={(e) => setEnd(+e.target.value)}>
            {STEPS.map((m) => <option key={m} value={m}>{fmtMin(m)}</option>)}</select></label>
        </div>
        <button className="pill" style={{ justifyContent: "center", height: 48 }} onClick={addBlock}><Icon name="plus" size={18} /> Add</button>
        <p className="err" role="alert">{error}</p>

        {sorted.length > 0 ? (
          <div className="card">
            {sorted.map((b) => (
              <div className="block-row" key={`${b.day}-${b.start}-${b.end}`}>
                <span>{DAYS.find((d) => d.n === b.day)?.full.slice(0, 3)} · {fmtMin(b.start)} to {fmtMin(b.end)}</span>
                <button className="icon-button" style={{ width: 40, height: 40, border: 0 }} aria-label={`Remove ${DAYS.find((d) => d.n === b.day)?.full} ${fmtMin(b.start)}`}
                  onClick={() => setBlocks((cur) => cur.filter((x) => x !== b))}><Icon name="x" size={18} /></button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}><Icon name="lock" size={18} /> Friends only see free or busy</p>
      </div>
      <div className="bottom-action">
        <button className="primary" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(blocks); } finally { setBusy(false); } }}>Save</button>
      </div>
    </>
  );
}
