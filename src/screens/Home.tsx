import { useState } from "react";
import type { BusyBlock, CampusEvent, Category, Friend, Me, Move } from "../types";
import { buildIcs } from "../lib/ics";
import { CATEGORIES, clashes, dayOffset, formatTime } from "../lib/time";
import { AUDIENCE_ICON, AUDIENCE_LABEL, Avatar, AvatarStack, CATEGORY_ICON, CATEGORY_LABEL, Icon } from "../ui";

export type HomeProps = {
  me: Me;
  now: Date;
  friends: Friend[];
  moves: Move[];
  events: CampusEvent[];
  freeIds: string[];
  busy: BusyBlock[];
  highlightId?: string;
  scheduleSet: boolean;
  onPost: () => void;
  onFriends: () => void;
  onSchedule: () => void;
  onToggleMove: (move: Move, joined: boolean) => void;
  onToggleEvent: (event: CampusEvent, joined: boolean) => void;
  onDelete: (move: Move) => void;
  onShare: (move: Move) => void;
};

function downloadIcs(e: { id: string; title: string; startsAt: string; place: string }) {
  const url = URL.createObjectURL(new Blob([buildIcs(e)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function dayLabel(iso: string, now: Date): string {
  return dayOffset(new Date(iso), now) <= 0 ? "Today" : "Tomorrow";
}

function groupByDay<T extends { startsAt: string }>(items: T[], now: Date): Array<[string, T[]]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = dayLabel(it.startsAt, now);
    out.set(k, [...(out.get(k) ?? []), it]);
  }
  return ["Today", "Tomorrow"].filter((k) => out.has(k)).map((k) => [k, out.get(k)!]);
}

export function Home(p: HomeProps) {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const moves = p.moves.filter((m) => filter === "all" || m.category === filter);
  const events = filter === "all" ? p.events : [];
  const free = p.friends.filter((f) => p.freeIds.includes(f.id));
  const nothingYet = p.moves.length === 0 && p.events.length === 0;

  return (
    <>
      <div className="home-title">
        <div>
          <h1>Today</h1>
          <p>{p.now.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</p>
        </div>
        <div className="top-right">
          <button className="icon-button" onClick={p.onSchedule} aria-label="My schedule"><Icon name="calendar" size={21} /></button>
          <button className="icon-button" onClick={p.onFriends} aria-label="Friends"><Icon name="people" size={21} /></button>
        </div>
      </div>

      <div className="chip-row" role="group" aria-label="Filter">
        <button className={`chip ${filter === "all" ? "selected" : ""}`} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${filter === c ? "selected" : ""}`} onClick={() => setFilter(c)} aria-label={CATEGORY_LABEL[c]} aria-pressed={filter === c}>
            <Icon name={CATEGORY_ICON[c]} size={22} />
          </button>
        ))}
      </div>

      {!p.scheduleSet ? (
        <button className="nudge" onClick={p.onSchedule}>
          <span className="bubble"><Icon name="calendar" /></span>
          <span>Add your classes</span>
        </button>
      ) : null}

      {free.length > 0 ? (
        <section aria-label="Free now">
          <h2 className="section-title">Free now</h2>
          <div className="free-row">
            {free.map((f) => (
              <div className="free-person" key={f.id}>
                <Avatar id={f.id} name={f.name} size="large" />
                <span className="dot" />
                {f.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {p.friends.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <Icon name="people" size={32} />
          <strong>Moves show up when friends join</strong>
          <button className="pill" onClick={p.onFriends}><Icon name="link" /> Invite a friend</button>
        </div>
      ) : null}

      {groupByDay(moves, p.now).map(([label, list]) => (
        <section key={label} aria-label={`${label} moves`}>
          <h2 className="section-title">{label}</h2>
          {list.map((m) => {
            const joined = m.goingIds.includes(p.me.id);
            const isHost = m.hostId === p.me.id;
            const open = openId === m.id;
            const clash = !joined && clashes(p.busy, new Date(m.startsAt));
            return (
              <article key={m.id} className={`card ${p.highlightId === m.id ? "highlight" : ""}`} data-testid={`move-${m.category}`}>
                <button className="card-main" onClick={() => setOpenId(open ? null : m.id)} aria-expanded={open}
                  aria-label={`${CATEGORY_LABEL[m.category]} with ${isHost ? "you" : m.hostName}, ${formatTime(m.startsAt)} at ${m.place}`}>
                  <span className="bubble"><Icon name={CATEGORY_ICON[m.category]} size={26} /></span>
                  <span>
                    <span className="card-title">{CATEGORY_LABEL[m.category]}</span>
                    <span className="card-sub" style={{ display: "block" }}>{isHost ? "You" : m.hostName}</span>
                    <span className="meta">
                      <span><Icon name="clock" size={15} />{formatTime(m.startsAt)}</span>
                      <span><Icon name="pin" size={15} />{m.place}</span>
                    </span>
                  </span>
                  <span className="aud" title={AUDIENCE_LABEL[m.audience]}><Icon name={AUDIENCE_ICON[m.audience]} size={18} /></span>
                </button>
                <div className="card-foot">
                  <span style={{ display: "grid", gap: 4 }}>
                    <AvatarStack people={m.goingIds.map((id, i) => ({ id, name: m.goingNames[i] ?? "?" }))} />
                    {clash ? <span className="clash"><Icon name="warn" size={15} />Class</span> : null}
                  </span>
                  {isHost ? (
                    <span className="join own">{m.goingIds.length} going</span>
                  ) : (
                    <button className={`join ${joined ? "in" : ""}`} onClick={() => p.onToggleMove(m, joined)}
                      aria-label={joined ? `You're in. Tap to leave ${CATEGORY_LABEL[m.category]}` : `I'm in for ${CATEGORY_LABEL[m.category]}`}>
                      {joined ? <><Icon name="check" size={18} stroke={2.4} />You're in</> : "I'm in"}
                    </button>
                  )}
                </div>
                {open ? (
                  <div className="details">
                    <div className="going-list">
                      {m.goingIds.map((id, i) => (
                        <div key={id}><Avatar id={id} name={m.goingNames[i] ?? "?"} size="medium" />{id === p.me.id ? "You" : m.goingNames[i]}</div>
                      ))}
                    </div>
                    <div className="actions">
                      <button className="pill" onClick={() => downloadIcs({ id: m.id, title: CATEGORY_LABEL[m.category], startsAt: m.startsAt, place: m.place })}>
                        <Icon name="calendar" size={18} />Add
                      </button>
                      <button className="pill" onClick={() => p.onShare(m)}><Icon name="share" size={18} />Share</button>
                      {isHost ? <button className="pill danger" onClick={() => p.onDelete(m)}><Icon name="x" size={18} />Cancel</button> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}

      {events.length > 0 ? (
        <section aria-label="On campus">
          <h2 className="section-title">On campus</h2>
          {events.map((e) => {
            const joined = e.goingIds.includes(p.me.id);
            return (
              <article key={e.id} className="card" data-testid="event">
                <div className="card-main" style={{ cursor: "default" }}>
                  <span className="bubble event"><Icon name="events" size={26} /></span>
                  <span>
                    <span className="card-title">{e.title}</span>
                    <span className="meta">
                      <span><Icon name="clock" size={15} />{formatTime(e.startsAt)}</span>
                      <span><Icon name="pin" size={15} />{e.place}</span>
                    </span>
                  </span>
                  <span />
                </div>
                <div className="card-foot">
                  <AvatarStack people={e.goingIds.map((id) => ({ id, name: p.friends.find((f) => f.id === id)?.name ?? (id === p.me.id ? p.me.name : "?") }))} />
                  <button className={`join ${joined ? "in" : ""}`} onClick={() => p.onToggleEvent(e, joined)}
                    aria-label={joined ? `You're in. Tap to leave ${e.title}` : `I'm in for ${e.title}`}>
                    {joined ? <><Icon name="check" size={18} stroke={2.4} />You're in</> : "I'm in"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {nothingYet || (moves.length === 0 && events.length === 0 && filter !== "all") ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <Icon name="plus" size={32} />
          <strong>No moves yet</strong>
          <span>Be the first. Friends will see it.</span>
        </div>
      ) : null}

      <div className="bottom-action">
        <button className="primary" onClick={p.onPost}><Icon name="plus" size={22} stroke={2.4} />Post a move</button>
      </div>
    </>
  );
}
