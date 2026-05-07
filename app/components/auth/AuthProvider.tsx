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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, try to restore session via refresh cookie
    refreshAccessToken().then(async (token) => {
      if (token) {
        const me = await fetchMe();
        setUser(me);
      }
      setLoading(false);
    });
  }, []);

  async function signIn(email: string, password: string) {
    const u = await login(email, password);
    setUser(u);
  }

  async function signOut() {
    await logout();
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
