"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, login, logout, refreshAccessToken, fetchMe } from "@/app/lib/auth-client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Reuse one bootstrap request across Strict Mode remounts so auth/session refresh is not duplicated.
let restoreSessionPromise: Promise<AuthUser | null> | null = null;

/** Restores the authenticated user once per app boot using refresh cookie + /me. */
async function restoreSession(): Promise<AuthUser | null> {
  if (!restoreSessionPromise) {
    restoreSessionPromise = (async () => {
      const token = await refreshAccessToken();
      if (!token) return null;
      return fetchMe();
    })();
  }
  return restoreSessionPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // On mount, restore session from refresh cookie and current /me payload.
    restoreSession().then((me) => {
      if (!active) return;
      setUser(me);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function signIn(email: string, password: string) {
    const u = await login(email, password);
    restoreSessionPromise = Promise.resolve(u);
    setUser(u);
  }

  async function signOut() {
    await logout();
    restoreSessionPromise = null;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
