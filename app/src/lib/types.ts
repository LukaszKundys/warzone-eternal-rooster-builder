export type Allegiance = "Loyalist" | "Rebel";

export interface User {
  id: string;
  email: string;
  name: string;
}

/** A saved roster as shown on My Lists. `roster` is owned by the builder and opaque here. */
export interface SavedList {
  id: string;
  name: string;
  faction: string;
  allegiance: Allegiance;
  gameSize: string;
  points: number;
  limit: number;
  unitCount: number;
  roster: unknown;
  updatedAt: string; // ISO timestamp
}

export type ListDraft = Omit<SavedList, "id" | "updatedAt">;

export type AuthErrorCode =
  | "invalid_credentials"
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

  listLists(userId: string): Promise<SavedList[]>;
  createList(userId: string, draft: ListDraft): Promise<SavedList>;
  deleteList(userId: string, id: string): Promise<void>;
}
