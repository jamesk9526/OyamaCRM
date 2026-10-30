import { Prisma, TaskPriority, TaskStatus, TaskType } from "@prisma/client";

export class TaskValidationError extends Error {}
export const activeTaskStatuses: TaskStatus[] = ["PENDING", "IN_PROGRESS"];
export const canManageTeamTasks = (role?: string) =>
  role === "admin" || role === "super_admin";
export function canAccessTask(
  task: { createdById: string | null; assigneeId: string | null },
  userId: string,
  role?: string,
) {
  return (
    canManageTeamTasks(role) ||
    task.createdById === userId ||
    task.assigneeId === userId
  );
}

/** Explicit tenancy wins. Only genuinely unscoped legacy rows inherit relation scope. */
export function taskOrganizationWhere(
  organizationId: string,
): Prisma.TaskWhereInput {
  return {
    OR: [
      { organizationId },
      {
        organizationId: null,
        AND: [
          {
            OR: [
              { constituent: { organizationId } },
              { assignee: { organizationId } },
              { createdBy: { organizationId } },
              { meeting: { organizationId } },
            ],
          },
          {
            OR: [{ constituentId: null }, { constituent: { organizationId } }],
          },
          { OR: [{ meetingId: null }, { meeting: { organizationId } }] },
        ],
      },
    ],
  };
}

const editable = new Set([
  "title",
  "description",
  "type",
  "status",
  "priority",
  "dueDate",
  "reminderAt",
  "snoozedUntil",
  "archivedAt",
  "outcome",
  "constituentId",
  "assigneeId",
  "meetingId",
  "checklistJson",
  "metadata",
]);
const creation = new Set([
  ...editable,
  "sourceModule",
  "sourceType",
  "sourceId",
]);
export function validateTaskInput(
  input: unknown,
  create = false,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TaskValidationError("Provide task fields as an object.");
  const values = input as Record<string, unknown>;
  const allowed = create ? creation : editable;
  for (const key of Object.keys(values))
    if (!allowed.has(key))
      throw new TaskValidationError(`Task field ${key} cannot be changed.`);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (["type", "status", "priority"].includes(key)) {
      const options =
        key === "type"
          ? TaskType
          : key === "status"
            ? TaskStatus
            : TaskPriority;
      if (
        typeof value !== "string" ||
        !Object.values(options).includes(value as never)
      )
        throw new TaskValidationError(`Choose a valid task ${key}.`);
      result[key] = value;
    } else if (
      ["dueDate", "reminderAt", "snoozedUntil", "archivedAt"].includes(key)
    ) {
      if (value === null || value === "") {
        result[key] = null;
        continue;
      }
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
        !Number.isFinite(Date.parse(value))
      )
        throw new TaskValidationError(`Choose a valid ${key}.`);
      const [year, month, day] = value.slice(0,10).split("-").map(Number);
      const calendar = new Date(Date.UTC(year, month - 1, day));
      if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new TaskValidationError(`Choose a valid ${key}.`);
      result[key] = new Date(value);
    } else if (["checklistJson", "metadata"].includes(key)) {
      if (
        value !== null &&
        (typeof value !== "object" || JSON.stringify(value).length > 20000)
      )
        throw new TaskValidationError(
          `${key} must be valid JSON smaller than 20 KB.`,
        );
      result[key] = value === null ? Prisma.DbNull : value;
    } else {
      if (value !== null && typeof value !== "string")
        throw new TaskValidationError(`${key} must be text.`);
      const text = typeof value === "string" ? value.trim() : "";
      const limit = ["description", "outcome"].includes(key)
        ? 20000
        : key === "title"
          ? 500
          : 191;
      if (text.length > limit || (key === "title" && !text))
        throw new TaskValidationError(
          key === "title"
            ? "Enter a title of 1–500 characters."
            : `${key} is too long.`,
        );
      result[key] = text || null;
    }
  }
  if (create && !result.title)
    throw new TaskValidationError("Enter a task title.");
  return result;
}
