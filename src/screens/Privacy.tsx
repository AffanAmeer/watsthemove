import { useState } from "react";
import { Header } from "../ui";

export const PRIVACY_CONTACT = "https://github.com/AffanAmeer/watsthemove/issues";

export function Privacy({ onBack, onDelete }: { onBack: () => void; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Delete your account and everything on it? This can't be undone.")) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Privacy" onBack={onBack} />

      <section className="card" style={{ marginTop: 8, padding: 16 }}>
        <strong>What we store</strong>
        <p className="hint">
          Your UW email (only to sign you in), your name, your optional program, the moves you post and who joins them,
          your event RSVPs, your friendships and close-friend marks, and any friend requests. If you add a class schedule,
          we store only the day and time of each block, never course names.
        </p>
      </section>

      <section className="card" style={{ marginTop: 12, padding: 16 }}>
        <strong>Who sees what</strong>
        <p className="hint">
          Other signed-in UW students see your name and program. Moves are shown only to the audience you pick (close friends,
          friends, or open). Friends learn that you are free, never what your busy times are.
        </p>
      </section>

      <section className="card" style={{ marginTop: 12, padding: 16 }}>
        <strong>Where it lives</strong>
        <p className="hint">
          Data is kept in Supabase, a hosted Postgres database with sign-in built in. The website runs on Vercel.
          Campus events come from a public events calendar and contain no personal data.
        </p>
      </section>

      <section className="card" style={{ marginTop: 12, padding: 16 }}>
        <strong>What we don't do</strong>
        <p className="hint">No ads, no third-party tracking code, and no selling or sharing your data with anyone.</p>
      </section>

      <section className="card" style={{ marginTop: 12, padding: 16 }}>
        <strong>Delete your account</strong>
        <p className="hint">
          Deleting removes your profile, friendships, friend requests, moves you posted, event RSVPs, busy times and
          close-friend marks. You will be signed out. This can't be undone.
        </p>
        <button
          className="secondary"
          style={{ marginTop: 8, width: "100%", color: "#b42318" }}
          onClick={remove}
          disabled={busy}
        >
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </section>

      <p className="hint" style={{ margin: "16px 4px" }}>
        Questions? Open an issue at <a href={PRIVACY_CONTACT} target="_blank" rel="noreferrer">github.com/AffanAmeer/watsthemove</a>.
      </p>
    </>
  );
}
