import { canSeeMove, type VisibilityContext } from "./visibility";

const ctx = (over: Partial<VisibilityContext> = {}): VisibilityContext => ({
  viewerId: "me",
  friendIds: new Set(["maya", "jordan"]),
  closeByHost: new Map([["maya", new Set(["me"])], ["jordan", new Set<string>()]]),
  ...over,
});

describe("canSeeMove", () => {
  it("always shows your own moves", () => {
    for (const audience of ["close", "friends", "open"] as const) {
      expect(canSeeMove({ hostId: "me", audience }, ctx())).toBe(true);
    }
  });

  it("shows open moves to any signed-in student, even strangers", () => {
    expect(canSeeMove({ hostId: "stranger", audience: "open" }, ctx())).toBe(true);
  });

  it("shows friends-only moves to friends but not strangers", () => {
    expect(canSeeMove({ hostId: "jordan", audience: "friends" }, ctx())).toBe(true);
    expect(canSeeMove({ hostId: "stranger", audience: "friends" }, ctx())).toBe(false);
  });

  it("shows close-friends moves only when the host marked you close", () => {
    expect(canSeeMove({ hostId: "maya", audience: "close" }, ctx())).toBe(true);
    expect(canSeeMove({ hostId: "jordan", audience: "close" }, ctx())).toBe(false);
  });

  it("hides close moves from a stranger even if the host list somehow contains them", () => {
    const c = ctx({ friendIds: new Set(), closeByHost: new Map([["maya", new Set(["me"])]]) });
    expect(canSeeMove({ hostId: "maya", audience: "close" }, c)).toBe(false);
  });
});
