import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { task: db } }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "donor-org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => {
  req.user = { sub: "operator", role: req.get("x-test-role") ?? "staff", email: "test@example.invalid", orgId: "donor-org" };
  next();
} }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock("@/server/src/services/notifications", () => ({ createTaskAssignmentNotification: vi.fn(), createTaskOverdueNotification: vi.fn() }));
import tasks from "@/server/src/routes/tasks";
const app = express();
app.use("/api/tasks", tasks);

describe("overdue task queue access and scope", () => {
  beforeEach(() => { db.findMany.mockResolvedValue([]); db.count.mockResolvedValue(0); });
  it("lets administrators review all organization overdue tasks", async () => {
    expect((await request(app).get("/api/tasks?queue=overdue&scope=all&status=PENDING").set("x-test-role", "admin")).status).toBe(200);
    const where = db.findMany.mock.lastCall?.[0].where;
    expect(where.assigneeId).toBeUndefined();
    expect(where.dueDate.lt).toBeInstanceOf(Date);
    expect(where.AND[0].OR).toContainEqual({ organizationId: "donor-org" });
    expect(where.AND).toContainEqual({ status: "PENDING" });
    expect(db.count).toHaveBeenLastCalledWith({ where });
  });
  it("keeps personal and tenant restrictions together for staff requesting all scope", async () => {
    expect((await request(app).get("/api/tasks?queue=overdue&scope=all")).status).toBe(200);
    const where = db.findMany.mock.lastCall?.[0].where;
    expect(where.assigneeId).toBe("operator");
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toContainEqual({ organizationId: "donor-org" });
    expect(where.AND[1]).toEqual({ OR: [{ createdById: "operator" }, { assigneeId: "operator" }] });
  });
});
