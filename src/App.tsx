import { useCallback, useEffect, useRef, useState } from "react";
import type { Api } from "./api/types";
import type { BusyBlock, CampusEvent, Friend, Me, Move, NewMove } from "./types";
import { Auth, NameStep } from "./screens/Auth";
import { Home } from "./screens/Home";
import { Post } from "./screens/Post";
import { Friends, inviteUrl } from "./screens/Friends";
import { Schedule } from "./screens/Schedule";

type View = "home" | "post" | "friends" | "schedule";
type Data = { friends: Friend[]; moves: Move[]; events: CampusEvent[]; freeIds: string[]; busy: BusyBlock[] };
type Toast = { text: string; undo?: () => void };

const EMPTY: Data = { friends: [], moves: [], events: [], freeIds: [], busy: [] };
const namedKey = (id: string) => `wtm-named-${id}`;

/** Invite and move links arrive as ?add=<id> / ?move=<id>. Keep them through sign-in, then clean the address bar. */
function captureLinkParams() {
  const q = new URLSearchParams(window.location.search);
  const add = q.get("add");
  const move = q.get("move");
  if (add) sessionStorage.setItem("wtm-add", add);
  if (move) sessionStorage.setItem("wtm-move", move);
  if (add || move) window.history.replaceState(null, "", window.location.pathname);
}

async function shareOrCopy(url: string, title: string): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title });
      return "shared";
    } catch {
      /* user closed the share sheet; fall back to copying */
    }
  }
  await navigator.clipboard?.writeText(url);
  return "copied";
}

export default function App({ api, clock = () => new Date() }: { api: Api; clock?: () => Date }) {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [named, setNamed] = useState(false);
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<Data>(EMPTY);
  const [now, setNow] = useState<Date>(clock);
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const say = useCallback((text: string, undo?: () => void) => setToast({ text, undo }), []);
  const fail = useCallback((e: unknown) => say(e instanceof Error ? e.message : "Something went wrong"), [say]);

  useEffect(() => {
    captureLinkParams();
    api.getMe().then((m) => {
      setMe(m);
      if (m) setNamed(!!m.name && !!localStorage.getItem(namedKey(m.id)));
    }).catch(fail).finally(() => setBooting(false));
  }, [api, fail]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    const at = clockRef.current();
    setNow(at);
    const [friends, moves, events, freeIds, busy] = await Promise.all([
      api.listFriends(), api.listMoves(at), api.listEvents(at), api.friendsFreeNow(at), api.getBusy(),
    ]);
    setData({ friends, moves, events, freeIds, busy });
  }, [api]);

  const ready = !!me && named;

  // Load data once signed in; apply any invite link; keep fresh while the app is open.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      const add = sessionStorage.getItem("wtm-add");
      if (add) {
        sessionStorage.removeItem("wtm-add");
        try {
          await api.acceptInvite(add);
          say("Friend added");
        } catch (e) {
          fail(e);
        }
      }
      try {
        await refresh();
      } catch (e) {
        if (alive) fail(e);
      }
      const mv = sessionStorage.getItem("wtm-move");
      if (mv) {
        sessionStorage.removeItem("wtm-move");
        setHighlightId(mv);
      }
    })();
    const tick = setInterval(() => refresh().catch(() => {}), 20_000);
    const onVisible = () => document.visibilityState === "visible" && refresh().catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, api, refresh, say, fail]);

  async function toggleMove(m: Move, joined: boolean) {
    if (!me) return;
    const flip = (on: boolean) =>
      setData((d) => ({
        ...d,
        moves: d.moves.map((x) =>
          x.id !== m.id ? x : {
            ...x,
            goingIds: on ? [...x.goingIds, me.id] : x.goingIds.filter((g) => g !== me.id),
            goingNames: on ? [...x.goingNames, me.name] : x.goingNames.filter((_, i) => x.goingIds[i] !== me.id),
          }),
      }));
    flip(!joined);
    try {
      if (joined) await api.leaveMove(m.id);
      else {
        await api.joinMove(m.id);
        say("You're in", () => toggleMove({ ...m, goingIds: [...m.goingIds, me.id] }, true));
      }
    } catch (e) {
      fail(e);
    }
    refresh().catch(() => {});
  }

  async function toggleEvent(ev: CampusEvent, joined: boolean) {
    try {
      if (joined) await api.leaveEvent(ev.id);
      else {
        await api.joinEvent(ev.id);
        say("You're in");
      }
      await refresh();
    } catch (e) {
      fail(e);
    }
  }

  async function post(m: NewMove) {
    try {
      await api.postMove(m);
      await refresh();
      setView("home");
      say("Posted");
    } catch (e) {
      fail(e);
    }
  }

  async function shareMove(m: Move) {
    const how = await shareOrCopy(`${window.location.origin}/?move=${m.id}`, "WatsTheMove");
    if (how === "copied") say("Link copied");
  }

  if (booting) return <div className="app"><p className="loading">…</p></div>;

  const body = (() => {
    if (!me) return <Auth api={api} onDone={(m) => { setMe(m); setNamed(!!m.name && !!localStorage.getItem(namedKey(m.id))); }} />;
    if (!named) {
      return (
        <NameStep initial={me.name} onSave={async (name) => {
          const updated = await api.saveName(name);
          localStorage.setItem(namedKey(updated.id), "1");
          setMe(updated);
          setNamed(true);
        }} />
      );
    }
    if (view === "post") return <Post now={now} onBack={() => setView("home")} onPost={post} />;
    if (view === "friends") {
      return (
        <Friends me={me} friends={data.friends} onBack={() => setView("home")}
          onInvite={async () => { if ((await shareOrCopy(inviteUrl(me), "Join me on WatsTheMove")) === "copied") say("Link copied"); }}
          onToggleClose={async (f) => {
            try { await api.setClose(f.id, !f.isClose); await refresh(); } catch (e) { fail(e); }
          }}
          onSignOut={async () => { await api.signOut(); setMe(null); setData(EMPTY); setView("home"); }} />
      );
    }
    if (view === "schedule") {
      return (
        <Schedule initial={data.busy} onBack={() => setView("home")}
          onSave={async (blocks) => {
            try { await api.saveBusy(blocks); await refresh(); setView("home"); say("Saved"); } catch (e) { fail(e); }
          }} />
      );
    }
    return (
      <Home me={me} now={now} friends={data.friends} moves={data.moves} events={data.events} freeIds={data.freeIds}
        busy={data.busy} highlightId={highlightId} scheduleSet={data.busy.length > 0}
        onPost={() => setView("post")} onFriends={() => setView("friends")} onSchedule={() => setView("schedule")}
        onToggleMove={toggleMove} onToggleEvent={toggleEvent}
        onDelete={async (m) => { try { await api.deleteMove(m.id); await refresh(); say("Cancelled"); } catch (e) { fail(e); } }}
        onShare={shareMove} />
    );
  })();

  return (
    <div className="app">
      {body}
      {toast ? (
        <div className="toast" role="status">
          {toast.text}
          {toast.undo ? <button onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button> : null}
        </div>
      ) : null}
    </div>
  );
}
