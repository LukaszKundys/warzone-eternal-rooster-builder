import {
  createClient,
  isAuthApiError,
  isAuthRetryableFetchError,
  type SupportedStorage,
  type User as SbUser,
} from "@supabase/supabase-js";
import { AuthError, type Allegiance, type AuthErrorCode, type Backend, type ListDraft, type SavedList } from "../types";

/**
 * Supabase backend. Tables and access rules: supabase/migrations/0001_lists.sql.
 * Lists are cached per user in localStorage so My Lists still opens without a connection.
 */

const REMEMBER = "wze.remember";
const cacheKey = (userId: string) => `wze.lists.cache.${userId}`;

/** "Keep me signed in" off → session lives in sessionStorage and ends with the tab. */
const rememberAwareStorage: SupportedStorage = {
  getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
  setItem: (k, v) => {
    const remember = localStorage.getItem(REMEMBER) !== "false";
    (remember ? localStorage : sessionStorage).setItem(k, v);
    (remember ? sessionStorage : localStorage).removeItem(k);
  },
  removeItem: (k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  },
};

const codeMap: Partial<Record<string, AuthErrorCode>> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  otp_expired: "link_expired",
  session_not_found: "link_expired",
  flow_state_expired: "link_expired",
  provider_disabled: "provider_unavailable",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
};

function toAuthError(err: unknown): AuthError {
  if (isAuthRetryableFetchError(err) || (err instanceof TypeError && /fetch/i.test(err.message))) return new AuthError("network");
  if (isAuthApiError(err)) {
    const code = (err.code && codeMap[err.code]) || (err.status === 429 ? "rate_limited" : "unknown");
    return new AuthError(code, err.message);
  }
  return new AuthError("unknown", err instanceof Error ? err.message : String(err));
}

interface ListRow {
  id: string;
  name: string;
  faction: string;
  allegiance: Allegiance;
  game_size: string;
  points: number;
  points_limit: number;
  unit_count: number;
  roster: unknown;
  updated_at: string;
}

const fromRow = (r: ListRow): SavedList => ({
  id: r.id,
  name: r.name,
  faction: r.faction,
  allegiance: r.allegiance,
  gameSize: r.game_size,
  points: r.points,
  limit: r.points_limit,
  unitCount: r.unit_count,
  roster: r.roster,
  updatedAt: r.updated_at,
});

const COLUMNS = "id,name,faction,allegiance,game_size,points,points_limit,unit_count,roster,updated_at";

const toRow = (d: ListDraft) => ({
  name: d.name,
  faction: d.faction,
  allegiance: d.allegiance,
  game_size: d.gameSize,
  points: d.points,
  points_limit: d.limit,
  unit_count: d.unitCount,
  roster: d.roster ?? {},
});

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: rememberAwareStorage },
  });

  const toUser = (u: SbUser) => {
    const meta = u.user_metadata ?? {};
    const email = u.email ?? "";
    return { id: u.id, email, name: meta.display_name || meta.full_name || meta.name || email.split("@")[0] };
  };
  const redirect = (path: string) => new URL(path, window.location.origin + import.meta.env.BASE_URL).toString();

  const readCache = (userId: string): SavedList[] | null => {
    try {
      const raw = localStorage.getItem(cacheKey(userId));
      return raw ? (JSON.parse(raw) as SavedList[]) : null;
    } catch {
      return null;
    }
  };
  const writeCache = (userId: string, lists: SavedList[]) => {
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(lists));
    } catch {
      // Storage full or blocked; the cache is only a convenience.
    }
  };

  return {
    kind: "supabase",

    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session ? toUser(data.session.user) : null;
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session ? toUser(session.user) : null));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password, remember) {
      localStorage.setItem(REMEMBER, String(remember));
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw toAuthError(error);
      return toUser(data.user);
    },

    async signUp(name, email, password) {
      localStorage.setItem(REMEMBER, "true");
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: redirect("lists") },
      });
      if (error) throw toAuthError(error);
      // With email confirmation on, an existing address comes back as a user with no identities.
      if (data.user && data.user.identities?.length === 0) throw new AuthError("email_taken");
      return { user: data.user && data.session ? toUser(data.user) : null, needsConfirmation: !data.session };
    },

    async signInWithGoogle() {
      localStorage.setItem(REMEMBER, "true");
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect("lists") } });
      if (error) throw toAuthError(error);
    },

    async requestPasswordReset(email) {
      // The PKCE verifier for the emailed link must outlive this tab, because the link opens a new one.
      localStorage.setItem(REMEMBER, "true");
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect("reset-password") });
      // Don't reveal whether the address has an account; only surface transport problems.
      if (error && (isAuthRetryableFetchError(error) || error.status === 429)) throw toAuthError(error);
    },

    async updatePassword(password) {
      const { data } = await sb.auth.getSession();
      if (!data.session) throw new AuthError("link_expired");
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw toAuthError(error);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async listLists(userId) {
      const { data, error } = await sb.from("lists").select(COLUMNS).order("updated_at", { ascending: false });
      if (error) {
        const cached = readCache(userId);
        if (cached) return cached;
        throw new AuthError("network", error.message);
      }
      const lists = (data as ListRow[]).map(fromRow);
      writeCache(userId, lists);
      return lists;
    },

    async getList(userId, id) {
      const { data, error } = await sb.from("lists").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) {
        const cached = readCache(userId)?.find((l) => l.id === id);
        if (cached) return cached;
        throw new AuthError("network", error.message);
      }
      return data ? fromRow(data as ListRow) : null;
    },

    async createList(userId, d) {
      const { data, error } = await sb.from("lists").insert(toRow(d)).select(COLUMNS).single();
      if (error) throw new AuthError("network", error.message);
      const list = fromRow(data as ListRow);
      writeCache(userId, [list, ...(readCache(userId) ?? [])]);
      return list;
    },

    async updateList(userId, id, d) {
      const { data, error } = await sb.from("lists").update(toRow(d)).eq("id", id).select(COLUMNS).single();
      if (error) throw new AuthError("network", error.message);
      const list = fromRow(data as ListRow);
      writeCache(userId, [list, ...(readCache(userId) ?? []).filter((l) => l.id !== id)]);
      return list;
    },

    async deleteList(userId, id) {
      const { error } = await sb.from("lists").delete().eq("id", id);
      if (error) throw new AuthError("network", error.message);
      writeCache(userId, (readCache(userId) ?? []).filter((l) => l.id !== id));
    },
  };
}
