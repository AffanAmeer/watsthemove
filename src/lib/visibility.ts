import type { Audience } from "../types";

/** What the database (row level security) enforces, mirrored here so it can be tested and used in demo mode. */
export type VisibilityContext = {
  viewerId: string;
  /** user ids that have an accepted friendship with the viewer */
  friendIds: ReadonlySet<string>;
  /** hostId -> set of friend ids that host has marked as close */
  closeByHost: ReadonlyMap<string, ReadonlySet<string>>;
};

export function canSeeMove(
  move: { hostId: string; audience: Audience },
  ctx: VisibilityContext,
): boolean {
  if (move.hostId === ctx.viewerId) return true;
  switch (move.audience) {
    case "open":
      return true; // every signed-in user is a verified UW email
    case "friends":
      return ctx.friendIds.has(move.hostId);
    case "close":
      return ctx.friendIds.has(move.hostId) && !!ctx.closeByHost.get(move.hostId)?.has(ctx.viewerId);
  }
}
