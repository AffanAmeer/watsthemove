import { useState } from "react";
import type { NewEvent } from "../types";
import { Header, Icon } from "../ui";

export function AddEvent({ onBack, onSave }: { onBack: () => void; onSave: (e: NewEvent) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || !date || !time || !place.trim()) return setError("Fill in the title, date, time and place");
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime())) return setError("Check the date and time");
    setError("");
    setBusy(true);
    try {
      await onSave({ title: title.trim(), startsAt: startsAt.toISOString(), place: place.trim(), url: url.trim() || null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Add event" onBack={onBack} />
      <form className="stack" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field"><Icon name="events" /><input aria-label="Title" placeholder="Event name" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="row2">
          <label className="field"><Icon name="calendar" /><input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><Icon name="clock" /><input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <label className="field"><Icon name="pin" /><input aria-label="Place" placeholder="Where" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
        <label className="field"><Icon name="link" /><input aria-label="Link" placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <p className="err" role="alert">{error}</p>
        <button className="pill" type="submit" disabled={busy} style={{ justifyContent: "center", height: 56 }}>
          <Icon name="plus" /> {busy ? "Adding…" : "Add event"}
        </button>
      </form>
    </>
  );
}
