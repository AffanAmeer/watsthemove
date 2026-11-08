import type { ReactNode } from "react";

export type IconName =
  | "arrow" | "calendar" | "check" | "clock" | "events" | "food" | "globe" | "gym" | "hang" | "lock"
  | "people" | "pin" | "plus" | "share" | "star" | "study" | "upload" | "x" | "warn" | "link";

const PATHS: Record<IconName, ReactNode> = {
  arrow: (<><path d="M15 18l-6-6 6-6" /><path d="M9 12h10" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  events: (<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>),
  food: <path d="M7 3v7M4 3v4a3 3 0 006 0V3M7 10v11M16 3v18M16 3c3 2 4 5 4 8h-4" />,
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>),
  gym: <path d="M7 9v6M4 8v8M2 10v4M17 9v6M20 8v8M22 10v4M7 12h10" />,
  hang: (<><circle cx="12" cy="12" r="9" /><path d="M8 14c1 1.5 2.5 2.2 4 2.2s3-.7 4-2.2M9 9.5v.01M15 9.5v.01" /></>),
  lock: (<><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>),
  people: (<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.4-4 2.4-6 6-6s5.6 2 6 6M15 15c3-.4 5.4 1.2 6 4" /></>),
  pin: (<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1116 0z" /><circle cx="12" cy="10" r="2.5" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  share: (<><path d="M12 15V4" /><path d="M8 8l4-4 4 4" /><path d="M5 13v6h14v-6" /></>),
  star: <path d="M12 3.5l2.7 5.4 6 .9-4.4 4.2 1 6-5.3-2.8L6.7 20l1-6-4.4-4.2 6-.9L12 3.5z" />,
  study: (<><path d="M4 5.5A3.5 3.5 0 017.5 4H12v16H7.5A3.5 3.5 0 004 21V5.5z" /><path d="M20 5.5A3.5 3.5 0 0016.5 4H12v16h4.5A3.5 3.5 0 0120 21V5.5z" /></>),
  upload: (<><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 14v5h14v-5" /></>),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  warn: (<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.01" /></>),
  link: (<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>),
};

export function Icon({ name, size = 20, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

const TONES = ["lavender", "blue", "mint", "peach", "yellow"];
export function toneFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ id, name, size = "medium" }: { id: string; name: string; size?: "tiny" | "small" | "medium" | "large" }) {
  return (
    <div className={`avatar avatar-${size} avatar-${toneFor(id)}`} title={name} aria-label={name}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Array<{ id: string; name: string }>; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack" aria-label={`${people.length} going`}>
      {shown.map((p) => <Avatar key={p.id} id={p.id} name={p.name} size="tiny" />)}
      {extra > 0 ? <span className="more">+{extra}</span> : null}
    </span>
  );
}

export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="top-bar">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="Back"><Icon name="arrow" size={24} /></button>
      ) : <span className="icon-spacer" />}
      {title ? <h1>{title}</h1> : <span />}
      <div className="top-right">{right ?? <span className="icon-spacer" />}</div>
    </header>
  );
}

export const CATEGORY_ICON = { gym: "gym", food: "food", study: "study", hang: "hang" } as const;
export const CATEGORY_LABEL = { gym: "Gym", food: "Food", study: "Study", hang: "Hang" } as const;
export const AUDIENCE_ICON = { close: "lock", friends: "people", open: "globe" } as const;
export const AUDIENCE_LABEL = { close: "Close", friends: "Friends", open: "Waterloo" } as const;
