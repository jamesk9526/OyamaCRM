/**
 * Unit tests for `app/lib/auth-client.ts`.
 *
 * These tests stub `globalThis.fetch` so we can exercise the in-memory
 * token store, login/refresh/logout flows, and the auto-refresh behavior
 * inside `apiFetch` without standing up the API server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  fetchMe,
  getAccessToken,
  login,
  logout,
  refreshAccessToken,
  setAccessToken,
} from "@/app/lib/auth-client";

/** Build a minimal Response-like object understood by auth-client. */
function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("auth-client", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it("setAccessToken / getAccessToken round-trip", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("abc.def.ghi");
    expect(getAccessToken()).toBe("abc.def.ghi");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  describe("login", () => {
    it("stores the access token and returns the user on success", async () => {
      const user = {
        id: "u1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        role: "ADMIN",
        organizationId: "org_demo",
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({ data: { accessToken: "tok-1", user } }),
        ),
      );

      const result = await login("a@b.com", "pw");
      expect(result).toEqual(user);
      expect(getAccessToken()).toBe("tok-1");
    });

    it("throws the server-supplied error message on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(
            { error: { message: "Invalid creds" } },
            { status: 401 },
          ),
        ),
      );

      await expect(login("a@b.com", "wrong")).rejects.toThrow("Invalid creds");
      expect(getAccessToken()).toBeNull();
    });

    it("throws a default message when server omits an error message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })),
      );
      await expect(login("a@b.com", "pw")).rejects.toThrow("Login failed");
    });
  });

  describe("refreshAccessToken", () => {
    it("returns the new token and stores it on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({ data: { accessToken: "tok-refresh" } }),
        ),
      );
      const tok = await refreshAccessToken();
      expect(tok).toBe("tok-refresh");
      expect(getAccessToken()).toBe("tok-refresh");
    });

    it("clears the stored token and returns null on non-OK response", async () => {
      setAccessToken("stale");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({}, { status: 401 })),
      );
      const tok = await refreshAccessToken();
      expect(tok).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it("clears the stored token and returns null when fetch throws", async () => {
      setAccessToken("stale");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      const tok = await refreshAccessToken();
      expect(tok).toBeNull();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("logout", () => {
    it("clears the stored token even if the API call fails", async () => {
      setAccessToken("tok");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      await logout();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("apiFetch", () => {
    it("returns body.data when present, otherwise the body itself", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ data: { hello: "world" } })),
      );
      const out = await apiFetch<{ hello: string }>("/api/anything");
      expect(out).toEqual({ hello: "world" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ raw: 1 })),
      );
      const out2 = await apiFetch<{ raw: number }>("/api/anything");
      expect(out2).toEqual({ raw: 1 });
    });

    it("auto-refreshes once on 401 and retries the original request", async () => {
      setAccessToken("expired");
      const fetchMock = vi
        .fn()
        // 1) original call → 401
        .mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
        // 2) refresh → new token
        .mockResolvedValueOnce(
          jsonResponse({ data: { accessToken: "fresh" } }),
        )
        // 3) retried call → 200
        .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
      vi.stubGlobal("fetch", fetchMock);

      const result = await apiFetch<{ ok: boolean }>("/api/protected");
      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(getAccessToken()).toBe("fresh");
    });

    it("throws using the server-supplied message on non-OK responses", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(
            { error: { message: "boom" } },
            { status: 500 },
          ),
        ),
      );
      await expect(apiFetch("/api/x")).rejects.toThrow("boom");
    });

    it("throws a generic 'API error <status>' when no message is provided", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({}, { status: 503 })),
      );
      await expect(apiFetch("/api/x")).rejects.toThrow("API error 503");
    });
  });

  describe("fetchMe", () => {
    it("returns the user payload when the API succeeds", async () => {
      const user = {
        id: "u1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        role: "ADMIN",
        organizationId: "org_demo",
      };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ data: user })),
      );
      const result = await fetchMe();
      expect(result).toEqual(user);
    });

    it("returns null when the API throws or returns an error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("nope")));
      expect(await fetchMe()).toBeNull();
    });
  });
});
