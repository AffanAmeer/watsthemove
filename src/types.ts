export type Audience = "close" | "friends" | "open";
export type Category = "gym" | "food" | "study" | "hang";
export type Day = "today" | "tomorrow";

export type Me = { id: string; email: string; name: string; program: string };

export type Person = { id: string; name: string; program: string };
export type Friend = Person & { isClose: boolean };

export type Move = {
  id: string;
  hostId: string;
  hostName: string;
  category: Category;
  startsAt: string; // ISO timestamp
  place: string;
  audience: Audience;
  goingIds: string[];
  goingNames: string[];
};

export type CampusEvent = {
  id: string;
  title: string;
  startsAt: string;
  place: string;
  url?: string;
  goingIds: string[];
};

/** A weekly repeating busy block. day: 0 = Sunday ... 6 = Saturday. Minutes since local midnight. */
export type BusyBlock = { day: number; start: number; end: number };

export type NewMove = {
  category: Category;
  startsAt: string;
  place: string;
  audience: Audience;
};
