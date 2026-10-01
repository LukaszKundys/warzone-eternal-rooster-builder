export type Allegiance = "agents_of_light" | "servants_of_darkness";

export const ALLEGIANCE_LABEL: Record<Allegiance, string> = {
  agents_of_light: "Agents of Light",
  servants_of_darkness: "Servants of Darkness",
};

export interface User {
  id: string;
  email: string;
  name: string;
}

/** A saved roster as shown on My Lists. `roster` is owned by the builder (src/builder/force.ts) and opaque here. */
export interface SavedList {
  id: string;
  name: string;
  faction: string;
  allegiance: Allegiance;
  gameSize: string; // size name, e.g. "Standard"
  points: number; // DP used
  limit: number; // DP limit
  unitCount: number;
  roster: unknown;
  updatedAt: string; // ISO timestamp
  /** Set while the list is shared by link; null otherwise. */
  shareId: string | null;
}

/** What the builder saves. Sharing is changed separately (setSharing), so saving never touches it. */
export type ListDraft = Omit<SavedList, "id" | "updatedAt" | "shareId">;

/** A list opened from a share link: read-only, without its owner's id. */
export interface SharedList extends ListDraft {
  updatedAt: string;
  ownerName: string;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "wrong_password"
  | "same_password"
  | "email_taken"
  | "email_not_confirmed"
  | "weak_password"
  | "link_expired"
  | "provider_unavailable"
  | "rate_limited"
  | "network"
  | "unknown";

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, detail?: string) {
    super(detail ?? code);
  }
}

export interface SignUpResult {
  user: User | null;
  /** True when the account exists but the email address must be confirmed before signing in. */
  needsConfirmation: boolean;
}

/** Everything the UI needs from a backend. Implemented by `local` (browser only) and `supabase`. */
export interface Backend {
  kind: "local" | "supabase";
  getUser(): Promise<User | null>;
  onAuthChange(cb: (user: User | null) => void): () => void;
  signIn(email: string, password: string, remember: boolean): Promise<User>;
  signUp(name: string, email: string, password: string): Promise<SignUpResult>;
  signInWithGoogle(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;

  /** Account settings. Each acts on the signed-in player. */
  updateName(name: string): Promise<User>;
  /** Resolves with needsConfirmation when the change waits on a link sent to the new address. */
  changeEmail(email: string): Promise<{ needsConfirmation: boolean }>;
  /** Throws wrong_password when `current` doesn't match. */
  changePassword(current: string, next: string): Promise<void>;
  /** Deletes the account and every list it owns, then signs out. Throws wrong_password when `password` doesn't match. */
  deleteAccount(password: string): Promise<void>;

  listLists(userId: string): Promise<SavedList[]>;
  /** Resolves to null when the list doesn't exist or belongs to someone else. */
  getList(userId: string, id: string): Promise<SavedList | null>;
  createList(userId: string, draft: ListDraft): Promise<SavedList>;
  updateList(userId: string, id: string, draft: ListDraft): Promise<SavedList>;
  deleteList(userId: string, id: string): Promise<void>;
  /** Turn a list's share link on (returns the new share id) or off (returns null). */
  setSharing(userId: string, id: string, on: boolean): Promise<string | null>;
  /** Open a shared list. Works signed out. Null when the link is unknown or sharing was turned off. */
  getSharedList(shareId: string): Promise<SharedList | null>;
}
