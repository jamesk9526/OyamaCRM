/**
 * Auth client — manages access token in memory, refresh via httpOnly cookie.
 * Never store access tokens in localStorage.
 */

// Accept either "https://domain" or "https://domain/api" in env; normalize
// to a root origin-like base so request paths can safely include "/api/...".
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  avatarUrl?: string | null;
}

export interface LoginMfaChallenge {
  mfaRequired: true;
  mfaTicket: string;
  destinationHint: string;
  expiresAt: string;
}

export interface LoginSuccess {
  mfaRequired?: false;
  accessToken: string;
  user: AuthUser;
}

export type LoginResponse = LoginSuccess | LoginMfaChallenge;

// ─── In-memory token store ─────────────────────────────────────────────────

let _accessToken: string | null = null;

// Deduplicate refresh calls so concurrent 401 retries do not race token rotation.
let _refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ─── Login ─────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
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

  if (body?.data?.mfaRequired) {
    return body.data as LoginMfaChallenge;
  }

  setAccessToken(body.data.accessToken);
  return body.data as LoginSuccess;
}

/** Completes one email-based MFA login challenge and returns authenticated user profile. */
export async function verifyEmailMfa(ticket: string, code: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ticket, code }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "MFA verification failed");
  }

  setAccessToken(body.data.accessToken);
  return body.data.user as AuthUser;
}

/** Requests one password reset email. Response is intentionally generic for account privacy. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Failed to request password reset");
  }
}

/** Resets password with one-time token issued by forgot-password flow. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, newPassword }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "Failed to reset password");
  }
}

// ─── Refresh ───────────────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshInFlight) {
    return _refreshInFlight;
  }

  _refreshInFlight = (async () => {
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
      const token = body.data.accessToken as string;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
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
  const res = await apiFetchResponse(path, init);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message ?? `API error ${res.status}`;
    if (res.status === 401) {
      throw new Error("Your session expired. Please sign in again.");
    }
    throw new Error(message);
  }

  // 204/205 and HEAD responses intentionally have no response body.
  if (res.status === 204 || res.status === 205 || init.method?.toUpperCase() === "HEAD") {
    return undefined as T;
  }

  // Some successful endpoints may return an empty body with a 2xx status.
  const contentLength = res.headers.get("content-length");
  if (contentLength === "0") {
    return undefined as T;
  }

  const rawBody = await res.text();
  if (!rawBody.trim()) {
    return undefined as T;
  }

  const body = JSON.parse(rawBody) as { data?: T } | T;
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: T }).data as T;
  }
  return body as T;
}

/**
 * Authenticated request helper that returns the raw Response object.
 * Useful for streaming endpoints where callers need direct access to response.body.
 */
export async function apiFetchResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  const isAbortError = (error: unknown): boolean => {
    if (error instanceof DOMException) {
      return error.name === "AbortError";
    }
    if (error instanceof Error) {
      return error.name === "AbortError";
    }
    return false;
  };

  const makeRequest = async (activeToken: string | null) => {
    try {
      return await fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init.headers as Record<string, string> ?? {}),
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : "Network request failed";
      throw new Error(`Unable to reach API at ${API_BASE}. ${reason}`);
    }
  };

  let response = await makeRequest(token);

  // Auto-refresh once on 401, including first-load cases where access token is not yet hydrated.
  if (response.status === 401 && path !== "/api/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await makeRequest(newToken);
    }
  }

  return response;
}
