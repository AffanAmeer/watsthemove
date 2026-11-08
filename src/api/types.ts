import type { BusyBlock, CampusEvent, Friend, Me, Move, NewMove } from "../types";

export const UW_EMAIL = /^[^@\s]+@uwaterloo\.ca$/i;

/** Everything the UI needs from a backend. There is a demo version (browser only) and a Supabase version. */
export interface Api {
  mode: "demo" | "live";
  getMe(): Promise<Me | null>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Me>;
  signOut(): Promise<void>;
  saveName(name: string): Promise<Me>;
  listFriends(): Promise<Friend[]>;
  setClose(friendId: string, close: boolean): Promise<void>;
  acceptInvite(inviterId: string): Promise<void>;
  listMoves(now: Date): Promise<Move[]>;
  postMove(move: NewMove): Promise<void>;
  deleteMove(moveId: string): Promise<void>;
  joinMove(moveId: string): Promise<void>;
  leaveMove(moveId: string): Promise<void>;
  listEvents(now: Date): Promise<CampusEvent[]>;
  joinEvent(eventId: string): Promise<void>;
  leaveEvent(eventId: string): Promise<void>;
  getBusy(): Promise<BusyBlock[]>;
  saveBusy(blocks: BusyBlock[]): Promise<void>;
  /** ids of friends who shared a schedule and are free at this moment */
  friendsFreeNow(at: Date): Promise<string[]>;
}

export class AppError extends Error {}
