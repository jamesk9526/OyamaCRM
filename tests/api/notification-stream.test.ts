import express, { type Request, type Response, type NextFunction } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), user: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { notification: { findMany: db.findMany, count: db.count }, user: { findFirst: db.user } } }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "stream-org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => { req.user = { sub: "stream-user", role: "staff", email: "test@example.invalid", orgId: "stream-org" }; next(); } }));
import router from "@/server/src/routes/notifications";
const app = express(); app.use("/api/notifications", router);
beforeEach(() => { vi.resetAllMocks(); db.findMany.mockResolvedValue([]); db.count.mockResolvedValue(0); db.user.mockResolvedValue({ id: "stream-user" }); });
afterEach(() => vi.restoreAllMocks());

describe("notification live stream", () => {
  it("disables Nginx buffering, keeps the response open, and publishes scoped changes without message contents", async () => {
    let poll: (() => void) | undefined;
    const timer = { unref: vi.fn() };
    vi.spyOn(globalThis, "setInterval").mockImplementation(((callback: () => void) => { poll = callback; return timer; }) as unknown as typeof setInterval);
    vi.spyOn(globalThis, "clearInterval").mockImplementation(() => {});
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    const port = (server.address() as { port: number }).port; const controller = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/notifications/sse?module=donor`, { signal: controller.signal });
      expect(response.status).toBe(200); expect(response.headers.get("x-accel-buffering")).toBe("no");
      const reader = response.body!.getReader(); expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: ready");
      db.findMany.mockResolvedValue([{ id: "new", status: "UNREAD", readAt: null, snoozedUntil: null }]); db.count.mockResolvedValue(1);
      poll!(); const next = new TextDecoder().decode((await reader.read()).value);
      expect(next).toBe("event: changed\ndata: {}\n\n");
      expect(db.findMany.mock.lastCall?.[0].where).toMatchObject({ organizationId: "stream-org", userId: "stream-user", module: "donor", status: { in: ["UNREAD", "READ"] } });
      expect(db.user).toHaveBeenCalledWith({ where: { id: "stream-user", organizationId: "stream-org", active: true }, select: { id: true } });
      controller.abort(); await reader.cancel().catch(() => {});
    } finally { controller.abort(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  });
  it("reports schema failures before emitting an apparently healthy event stream", async () => {
    db.findMany.mockRejectedValue({ code: "P2021" });
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const port = (server.address() as { port: number }).port;
    try { const response = await fetch(`http://127.0.0.1:${port}/api/notifications/sse`); expect(response.status).toBe(503); expect((await response.json()).error.code).toBe("MIGRATION_REQUIRED"); }
    finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  });
});
