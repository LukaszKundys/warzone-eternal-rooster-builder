import { emptyForce, forceReducer, toDraft, type ForceAction } from "../../builder/force";
import { AuthError, type Allegiance, type Backend, type ListDraft, type SavedList, type User } from "../types";

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

/** Build a demo list by replaying builder actions, so its roster and summary columns agree. */
function demoList(name: string, hoursAgo: number, setup: ForceAction[], units: [string, number][], assets: string[] = []): SavedList {
  let f = setup.reduce(forceReducer, emptyForce());
  units.forEach(([u, n]) => {
    for (let i = 0; i < n; i++) f = forceReducer(f, { type: "add", unit: u });
  });
  assets.forEach((a) => (f = forceReducer(f, { type: "addForceAsset", asset: a })));
  return { ...toDraft(name, f), id: crypto.randomUUID(), updatedAt: ago(hoursAgo * 3_600_000) };
}

function demoLists(): SavedList[] {
  return [
    demoList("Iron Fist Vanguard", 2, [{ type: "setFaction", faction: "bauhaus" }], [
      ["bauhaus_blitzer_leader", 1], ["bauhaus_blitzer_base", 3], ["bauhaus_blitzer_operator", 1], ["bauhaus_blitzer_flamethrower", 1],
      ["bauhaus_venusian_ranger_leader", 1], ["bauhaus_venusian_ranger_base", 2],
    ], ["fire_support"]),
    demoList("Boardroom Coup", 26, [{ type: "setFaction", faction: "capitol" }, { type: "setGameSize", gameSize: 30 }], [
      ["capitol_free_marine_leader", 1], ["capitol_free_marine_base", 3], ["capitol_free_marine_medic", 1], ["capitol_free_marine_rpg", 1],
    ], ["supply_drop"]),
    demoList("Silent Circuit", 72, [{ type: "setFaction", faction: "cybertronic" }], [
      ["cybertronic_chasseur_leader", 1], ["cybertronic_chasseur_base", 4], ["cybertronic_chasseur_operator", 1], ["cybertronic_chasseur_hmg", 1],
      ["cybertronic_attila_base", 1], ["cybertronic_attila_hmg", 1],
    ]),
    demoList("Test roster", 8 * 24, [
      { type: "setFaction", faction: "algeroth" }, { type: "setGameSize", gameSize: 20 }, { type: "setAllegiance", allegiance: "servants_of_darkness" },
    ], []),
  ];
}

// Lists saved on this device before the builder used the game's allegiance names.
const LEGACY_ALLEGIANCE: Record<string, Allegiance> = { Loyalist: "agents_of_light", Rebel: "servants_of_darkness" };
const normalize = (l: SavedList): SavedList => (LEGACY_ALLEGIANCE[l.allegiance] ? { ...l, allegiance: LEGACY_ALLEGIANCE[l.allegiance] } : l);

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

  const stored = (userId: string) => read(localStorage, listsKey(userId), [] as SavedList[]).map(normalize);

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
      return stored(userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getList(userId, id) {
      await ready;
      return stored(userId).find((l) => l.id === id) ?? null;
    },

    async createList(userId, draft: ListDraft) {
      const list: SavedList = { ...draft, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      write(localStorage, listsKey(userId), [list, ...stored(userId)]);
      return list;
    },

    async updateList(userId, id, draft: ListDraft) {
      const all = stored(userId);
      if (!all.some((l) => l.id === id)) throw new Error("List not found");
      const list: SavedList = { ...draft, id, updatedAt: new Date().toISOString() };
      write(localStorage, listsKey(userId), all.map((l) => (l.id === id ? list : l)));
      return list;
    },

    async deleteList(userId, id) {
      write(localStorage, listsKey(userId), stored(userId).filter((l) => l.id !== id));
    },
  };
}
