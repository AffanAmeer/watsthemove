import { useState, type FormEvent } from "react";
import type { Friend, Me, Person } from "../types";
import { Avatar, Header, Icon } from "../ui";

export function inviteUrl(me: Me): string {
  return `${window.location.origin}/?add=${me.id}`;
}

export function Friends({ me, friends, requests, onBack, onInvite, onToggleClose, onSignOut, onPrivacy, onSendRequest, onRespond }: {
  me: Me; friends: Friend[]; requests: Person[]; onBack: () => void; onInvite: () => void;
  onToggleClose: (f: Friend) => void; onSignOut: () => void; onPrivacy?: () => void;
  onSendRequest: (email: string) => Promise<void>; onRespond: (p: Person, accept: boolean) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await onSendRequest(email);
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Friends" onBack={onBack} />

      <form className="stack" style={{ marginTop: 8 }} onSubmit={send}>
        <label className="field"><Icon name="people" /><input type="email" aria-label="UW email" placeholder="friend@uwaterloo.ca" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="pill" type="submit" disabled={busy} style={{ justifyContent: "center", height: 48 }}>
          {busy ? "Sending…" : "Send request"}
        </button>
      </form>

      {requests.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          {requests.map((p) => (
            <div className="friend-row" key={p.id}>
              <Avatar id={p.id} name={p.name || "?"} />
              <div className="name"><strong>{p.name || "Someone"}</strong><span>wants to connect</span></div>
              <button className="pill" onClick={() => onRespond(p, true)} aria-label={`Accept ${p.name || "request"}`}>Accept</button>
              <button className="icon-button" style={{ width: 40, height: 40, border: 0 }} onClick={() => onRespond(p, false)} aria-label={`Decline ${p.name || "request"}`}>
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {friends.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <Icon name="people" size={32} />
          <strong>No friends yet</strong>
          <span>Send a request by UW email, or share your link.</span>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          {friends.map((f) => (
            <div className="friend-row" key={f.id}>
              <Avatar id={f.id} name={f.name} />
              <div className="name"><strong>{f.name}</strong>{f.program ? <span>{f.program}</span> : null}</div>
              <button className={`star ${f.isClose ? "on" : ""}`} onClick={() => onToggleClose(f)} aria-pressed={f.isClose}
                aria-label={`${f.isClose ? "Remove" : "Mark"} ${f.name} as close friend`}>
                <Icon name="star" size={24} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="hint" style={{ margin: "16px 4px", display: "flex", gap: 6, alignItems: "center" }}>
        <Icon name="star" size={16} /> Close friends see your close-only moves
      </p>
      <p className="hint" style={{ margin: "0 4px" }}>{me.email}</p>
      <button className="secondary" style={{ marginTop: 8 }} onClick={onSignOut}>Sign out</button>
      {onPrivacy ? (
        <button className="secondary" style={{ marginTop: 8 }} onClick={onPrivacy}>Privacy and delete account</button>
      ) : null}
      <div className="bottom-action">
        <button className="primary" onClick={onInvite}><Icon name="share" size={20} />Invite a friend</button>
      </div>
    </>
  );
}
