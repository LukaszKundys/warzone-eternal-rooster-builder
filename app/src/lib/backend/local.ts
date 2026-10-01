import { AuthError, type Backend, type ListDraft, type SavedList, type User } from "../types";

/**
 * Browser-only backend for development and offline demos. Accounts and lists live in
 * localStorage on this device; nothing is sent anywhere. Not a security boundary.
 */

interface StoredUser extends User {
  pwHash: string;
}

const USERS = "wze.local.users";
const SESSION = "wze.local.session";
const listsKey = (userId: string) => `wze.local.lists.${userId}`;

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "Demo1234!";

function read<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(storage: Storage, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value));
}

async function hash(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase() + "\u0000" + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const toUser = ({ id, email, name }: StoredUser): User => ({ id, email, name });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function demoLists(): SavedList[] {
  const h = 3_600_000;
  const base = { roster: null };
  return [
    { ...base, id: crypto.randomUUID(), name: "Iron Fist Vanguard", faction: "Bauhaus", allegiance: "Loyalist", gameSize: "Standard", points: 148, limit: 150, unitCount: 9, updatedAt: ago(2 * h) },
    { ...base, id: crypto.randomUUID(), name: "Boardroom Coup", faction: "Capitol", allegiance: "Loyalist", gameSize: "Skirmish", points: 71, limit: 75, unitCount: 5, updatedAt: ago(26 * h) },
    { ...base, id: crypto.randomUUID(), name: "Silent Circuit", faction: "Cybertronic", allegiance: "Loyalist", gameSize: "Standard", points: 162, limit: 150, unitCount: 11, updatedAt: ago(72 * h) },
    { ...base, id: crypto.randomUUID(), name: "Test roster", faction: "Bauhaus", allegiance: "Loyalist", gameSize: "Patrol", points: 0, limit: 100, unitCount: 0, updatedAt: ago(8 * 24 * h) },
  ];
}

export function createLocalBackend(): Backend {
  const listeners = new Set<(u: User | null) => void>();
  const emit = (u: User | null) => listeners.forEach((cb) => cb(u));

  const users = (): StoredUser[] => read(localStorage, USERS, [] as StoredUser[]);
  const sessionId = (): string | null =>
    read<string | null>(sessionStorage, SESSION, null) ?? read<string | null>(localStorage, SESSION, null);

  const startSession = (u: StoredUser, remember: boolean) => {
    localStorage.removeItem(SESSION);
    sessionStorage.removeItem(SESSION);
    write(remember ? localStorage : sessionStorage, SESSION, u.id);
    emit(toUser(u));
    return toUser(u);
  };

  // Seed a demo account the first time this backend runs on a device.
  const ready = (async () => {
    if (localStorage.getItem(USERS)) return;
    const demo: StoredUser = { id: crypto.randomUUID(), email: DEMO_EMAIL, name: "Commander Vale", pwHash: await hash(DEMO_EMAIL, DEMO_PASSWORD) };
    write(localStorage, USERS, [demo]);
    write(localStorage, listsKey(demo.id), demoLists());
  })();

  const current = (): StoredUser | null => {
    const id = sessionId();
    return (id && users().find((u) => u.id === id)) || null;
  };

  return {
    kind: "local",

    async getUser() {
      await ready;
      const u = current();
      return u && toUser(u);
    },

    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signIn(email, password, remember) {
      await ready;
      const e = email.trim().toLowerCase();
      const u = users().find((x) => x.email === e);
      if (!u || u.pwHash !== (await hash(e, password))) throw new AuthError("invalid_credentials");
      return startSession(u, remember);
    },

    async signUp(name, email, password) {
      await ready;
      const e = email.trim().toLowerCase();
      const all = users();
      if (all.some((x) => x.email === e)) throw new AuthError("email_taken");
      const u: StoredUser = { id: crypto.randomUUID(), email: e, name: name.trim(), pwHash: await hash(e, password) };
      write(localStorage, USERS, [...all, u]);
      return { user: startSession(u, true), needsConfirmation: false };
    },

    async signInWithGoogle() {
      throw new AuthError("provider_unavailable");
    },

    async requestPasswordReset() {
      // No email in local mode; the UI shows the same neutral notice either way.
    },

    async updatePassword(password) {
      const u = current();
      if (!u) throw new AuthError("link_expired");
      const pwHash = await hash(u.email, password);
      write(localStorage, USERS, users().map((x) => (x.id === u.id ? { ...x, pwHash } : x)));
    },

    async signOut() {
      localStorage.removeItem(SESSION);
      sessionStorage.removeItem(SESSION);
      emit(null);
    },

    async listLists(userId) {
      await ready;
      const lists = read(localStorage, listsKey(userId), [] as SavedList[]);
      return lists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async createList(userId, draft: ListDraft) {
      const list: SavedList = { ...draft, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      write(localStorage, listsKey(userId), [list, ...read(localStorage, listsKey(userId), [] as SavedList[])]);
      return list;
    },

    async deleteList(userId, id) {
      write(localStorage, listsKey(userId), read(localStorage, listsKey(userId), [] as SavedList[]).filter((l) => l.id !== id));
    },
  };
}
