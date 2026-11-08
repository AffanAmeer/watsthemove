import type { Friend, Me } from "../types";
import { Avatar, Header, Icon } from "../ui";

export function inviteUrl(me: Me): string {
  return `${window.location.origin}/?add=${me.id}`;
}

export function Friends({ me, friends, onBack, onInvite, onToggleClose, onSignOut }: {
  me: Me; friends: Friend[]; onBack: () => void; onInvite: () => void;
  onToggleClose: (f: Friend) => void; onSignOut: () => void;
}) {
  return (
    <>
      <Header title="Friends" onBack={onBack} />
      {friends.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <Icon name="people" size={32} />
          <strong>No friends yet</strong>
          <span>Send your link. Opening it adds you both.</span>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8 }}>
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
      <div className="bottom-action">
        <button className="primary" onClick={onInvite}><Icon name="share" size={20} />Invite a friend</button>
      </div>
    </>
  );
}
