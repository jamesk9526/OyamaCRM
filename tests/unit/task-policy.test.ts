import { describe, expect, it } from "vitest";
import {
  canAccessTask,
  taskOrganizationWhere,
  validateTaskInput,
} from "@/server/src/services/task-policy";

describe("Task input and ownership policy", () => {
  it("rejects mass assignment, bad enums, invalid dates and blank titles", () => {
    for (const input of [
      { organizationId: "other" },
      { createdById: "other" },
      { completedById: "other" },
      { status: "WAITING" },
      { priority: "CRITICAL" },
      { dueDate: "tomorrow" },
      { dueDate: "2026-02-31T12:00:00Z" },
      { title: "  " },
      { assigneeId: 5 },
    ])
      expect(() => validateTaskInput(input)).toThrow();
  });
  it("trims text and supports explicit clearing without allowing ownership metadata", () => {
    expect(
      validateTaskInput({
        title: " Call donor ",
        dueDate: null,
        assigneeId: null,
      }),
    ).toEqual({ title: "Call donor", dueDate: null, assigneeId: null });
    expect(
      validateTaskInput({ dueDate: "2026-10-30T23:59:59.999Z" }).dueDate,
    ).toBeInstanceOf(Date);
  });
  it("keeps admin, creator and assignee visibility explicit", () => {
    const task = { createdById: "creator", assigneeId: "assignee" };
    expect(canAccessTask(task, "other", "staff")).toBe(false);
    expect(canAccessTask(task, "creator", "staff")).toBe(true);
    expect(canAccessTask(task, "assignee", "staff")).toBe(true);
    expect(canAccessTask(task, "other", "super_admin")).toBe(true);
  });
  it("restricts relation-based compatibility scope to legacy null-organization tasks", () => {
    const where = taskOrganizationWhere("org");
    expect(where.OR?.[0]).toEqual({ organizationId: "org" });
    expect(where.OR?.[1]).toMatchObject({ organizationId: null });
  });
});
