import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  task: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  constituent: { findFirst: vi.fn() },
  meeting: { findFirst: vi.fn() },
  activity: { create: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/lib/organization", () => ({
  resolveOrganizationId: async () => "org",
}));
vi.mock("@/server/src/middleware/requireAuth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      sub: "operator",
      role: req.get("x-role") || "staff",
      email: "qa@example.invalid",
      orgId: "org",
    };
    next();
  },
}));
vi.mock("@/server/src/middleware/requirePermission", () => ({
  requirePermission:
    (permission: string) =>
    (req: Request, res: Response, next: NextFunction) =>
      req.get("x-denied") === permission
        ? res.status(403).json({ error: { message: "Permission denied" } })
        : next(),
}));
vi.mock("@/server/src/services/notifications", () => ({
  createTaskAssignmentNotification: vi.fn(),
  createTaskOverdueNotification: vi.fn(),
  resolveTaskNotifications: vi.fn(),
}));
import {
  createTaskAssignmentNotification,
  resolveTaskNotifications,
} from "@/server/src/services/notifications";
import router from "@/server/src/routes/tasks";
const app = express();
app.use(express.json());
app.use("/api/tasks", router);
app.use((_error: Error, _req: Request, res: Response, _next: NextFunction) =>
  res.status(500).json({ error: { message: "Unhandled failure" } }),
);
const baseTask = {
  id: "task",
  organizationId: "org",
  title: "Follow up",
  createdById: "operator",
  assigneeId: "operator",
  constituentId: null,
  status: "PENDING",
  priority: "MEDIUM",
  type: "FOLLOW_UP",
  dueDate: null,
  completedAt: null,
  completedById: null,
  archivedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (work) => work(db));
  db.task.findFirst.mockResolvedValue({ ...baseTask });
  db.task.findMany.mockResolvedValue([{ ...baseTask }]);
  db.task.count.mockResolvedValue(26);
  db.task.create.mockImplementation(async ({ data }) => ({
    ...baseTask,
    ...data,
  }));
  db.task.update.mockImplementation(async ({ data }) => ({
    ...baseTask,
    ...data,
  }));
  db.user.findFirst.mockResolvedValue({ id: "staff" });
  db.user.findMany.mockResolvedValue([
    { id: "staff", firstName: "Staff", lastName: "Person" },
  ]);
  db.constituent.findFirst.mockResolvedValue({ id: "person" });
  db.meeting.findFirst.mockResolvedValue({ id: "meeting" });
  vi.mocked(createTaskAssignmentNotification).mockResolvedValue(undefined);
});

describe("Task workflow API", () => {
  it("creates validated tasks and preserves explicit unassigned state", async () => {
    const result = await request(app)
      .post("/api/tasks")
      .send({
        title: "  Follow up  ",
        assigneeId: null,
        dueDate: "2026-11-03T23:59:59.999Z",
      });
    expect(result.status).toBe(201);
    expect(result.body.title).toBe("Follow up");
    expect(db.task.create.mock.lastCall?.[0].data).toMatchObject({
      organizationId: "org",
      createdById: "operator",
      assigneeId: null,
      dueDate: expect.any(Date),
    });
  });
  it("returns bad input before any database write", async () => {
    for (const body of [
      { title: "Valid", status: "WAITING" },
      { title: "Valid", dueDate: "invalid" },
      { title: "Valid", organizationId: "foreign" },
    ])
      expect((await request(app).post("/api/tasks").send(body)).status).toBe(
        400,
      );
    expect(db.task.create).not.toHaveBeenCalled();
  });
  it("rejects foreign or inactive relationships on create and edit", async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect(
      (
        await request(app)
          .post("/api/tasks")
          .send({ title: "Valid", assigneeId: "foreign" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch("/api/tasks/task")
          .send({ assigneeId: "foreign" })
      ).status,
    ).toBe(400);
    expect(db.task.update).not.toHaveBeenCalled();
  });
  it("blocks mass assignment of organization and lifecycle ownership", async () => {
    for (const body of [
      { organizationId: "foreign" },
      { createdById: "foreign" },
      { completedById: "foreign" },
      { completedAt: "2026-10-30T00:00:00Z" },
    ])
      expect(
        (await request(app).patch("/api/tasks/task").send(body)).status,
      ).toBe(400);
    expect(db.task.update).not.toHaveBeenCalled();
  });
  it("fetches exact linked tasks without queue filters while enforcing ownership", async () => {
    expect((await request(app).get("/api/tasks/task")).status).toBe(200);
    db.task.findFirst.mockResolvedValue({
      ...baseTask,
      createdById: "other",
      assigneeId: "other",
    });
    expect((await request(app).get("/api/tasks/task")).status).toBe(403);
    expect(
      (await request(app).get("/api/tasks/task").set("x-role", "admin")).status,
    ).toBe(200);
  });
  it("records completion once and clears metadata when reopened", async () => {
    expect(
      (
        await request(app)
          .post("/api/tasks/task/complete")
          .send({ outcome: "Called donor" })
      ).status,
    ).toBe(200);
    expect(db.task.update.mock.lastCall?.[0].data).toMatchObject({
      status: "COMPLETED",
      completedAt: expect.any(Date),
      completedById: "operator",
      outcome: "Called donor",
    });
    db.task.findFirst.mockResolvedValue({
      ...baseTask,
      status: "COMPLETED",
      completedAt: new Date("2026-10-20"),
      completedById: "original",
    });
    expect(
      (await request(app).post("/api/tasks/task/reopen").send({})).status,
    ).toBe(200);
    expect(db.task.update.mock.lastCall?.[0].data).toMatchObject({
      status: "PENDING",
      completedAt: null,
      completedById: null,
      archivedAt: null,
      outcome: null,
    });
  });
  it("reassignment produces a notice while notification failures do not duplicate saved tasks", async () => {
    vi.mocked(createTaskAssignmentNotification).mockRejectedValueOnce(
      new Error("Notification unavailable"),
    );
    const result = await request(app)
      .patch("/api/tasks/task")
      .send({ assigneeId: "staff" });
    expect(result.status).toBe(200);
    expect(result.body.notificationWarning).toContain("Task saved");
    expect(db.task.update).toHaveBeenCalledTimes(1);
  });
  it("applies type and completed filters before pagination and returns server total", async () => {
    const result = await request(app).get(
      "/api/tasks?queue=all&status=COMPLETED&type=CALL&page=2&limit=25",
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: 26, page: 2, totalPages: 2 });
    expect(db.task.findMany.mock.lastCall?.[0]).toMatchObject({
      skip: 25,
      take: 25,
      where: {
        AND: expect.arrayContaining([
          { status: "COMPLETED" },
          { type: "CALL" },
        ]),
      },
    });
  });
  it("never partially reassigns when a selected task is missing or completed", async () => {
    expect(
      (
        await request(app)
          .post("/api/tasks/bulk-assign")
          .send({ assigneeId: "staff", taskIds: ["task", "missing"] })
      ).status,
    ).toBe(404);
    db.task.findMany.mockResolvedValue([{ ...baseTask, status: "COMPLETED" }]);
    expect(
      (
        await request(app)
          .post("/api/tasks/bulk-assign")
          .send({ assigneeId: "staff", taskIds: ["task"] })
      ).status,
    ).toBe(400);
    expect(db.task.updateMany).not.toHaveBeenCalled();
  });
  it("requires task edit permission for every mutation and task view permission for assignees", async () => {
    expect(
      (
        await request(app)
          .post("/api/tasks/task/complete")
          .set("x-denied", "edit:tasks")
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/tasks/assignees")
          .set("x-denied", "view:tasks")
      ).status,
    ).toBe(403);
    expect(db.task.update).not.toHaveBeenCalled();
  });
  it("archives task notifications after deletion", async () => {
    expect((await request(app).delete("/api/tasks/task")).status).toBe(204);
    expect(resolveTaskNotifications).toHaveBeenCalledWith({
      organizationId: "org",
      taskId: "task",
    });
  });
});
