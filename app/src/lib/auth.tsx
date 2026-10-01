import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Backend, User } from "./types";

interface AuthState {
  backend: Backend;
  user: User | null;
  /** False until the stored session has been checked. */
  ready: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    backend.getUser().then((u) => {
      if (!live) return;
      setUser(u);
      setReady(true);
    });
    const off = backend.onAuthChange((u) => live && setUser(u));
    return () => {
      live = false;
      off();
    };
  }, [backend]);

  return <AuthContext.Provider value={{ backend, user, ready }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
