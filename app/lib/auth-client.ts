/**
 * Auth client — manages access token in memory, refresh via httpOnly cookie.
 * Never store access tokens in localStorage.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  avatarUrl?: string | null;
}

// ─── In-memory token store ─────────────────────────────────────────────────

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ─── Login ─────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "Login failed");
  }

  setAccessToken(body.data.accessToken);
  return body.data.user as AuthUser;
}

// ─── Refresh ───────────────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      setAccessToken(null);
      return null;
    }

    const body = await res.json();
    setAccessToken(body.data.accessToken);
    return body.data.accessToken as string;
  } catch {
    setAccessToken(null);
    return null;
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  } finally {
    setAccessToken(null);
  }
}

// ─── Me ────────────────────────────────────────────────────────────────────

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch<AuthUser>("/api/auth/me");
    return data;
  } catch {
    return null;
  }
}

// ─── Authenticated fetch wrapper ──────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let token = getAccessToken();

  const makeRequest = async (t: string | null) => {
    return fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> ?? {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });
  };

  let res = await makeRequest(token);

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `API error ${res.status}`);
  }

  const body = await res.json();
  return (body.data ?? body) as T;
}
