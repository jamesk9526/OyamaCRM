import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { validateTaskInput } from "./task-policy.js";
import { createTaskAssignmentNotification } from "./notifications.js";

export class DonationFollowUpError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** Save a gift-linked task once per reviewed attempt, independently of gift creation. */
export async function createDonationFollowUp(organizationId: string, userId: string, donationId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DonationFollowUpError("Provide follow-up task details.");
  const { requestId, ...fields } = input as Record<string, unknown>;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) throw new DonationFollowUpError("A valid follow-up request ID is required.");
  const allowed = new Set(["title", "description", "type", "priority", "status", "dueDate", "reminderAt", "assigneeId", "constituentId"]);
  if (Object.keys(fields).some((key) => !allowed.has(key))) throw new DonationFollowUpError("Only follow-up task fields may be provided.");
  const values = validateTaskInput(fields, true);
  const result = await prisma.$transaction(async (tx) => {
    const gift = await tx.donation.findFirst({ where: { id: donationId, constituent: { organizationId } }, select: { id: true, constituentId: true } });
    if (!gift) throw new DonationFollowUpError("Donation not found.", 404);
    // The parent gift serializes retries even across API processes; no schema reset or new unique index is needed.
    await tx.$queryRaw`SELECT id FROM Donation WHERE id = ${gift.id} FOR UPDATE`;
    if (values.constituentId && values.constituentId !== gift.constituentId) throw new DonationFollowUpError("The follow-up must stay linked to this gift's donor.");
    const existing = await tx.task.findFirst({ where: { organizationId, sourceModule: "donor", sourceType: "donation-follow-up", sourceId: gift.id, metadata: { path: "$.requestId", equals: requestId } }, include: { assignee: { select: { id: true, firstName: true, lastName: true } }, constituent: { select: { id: true, firstName: true, lastName: true } } } });
    if (existing) return { task: existing, reused: true };
    const assigneeId = "assigneeId" in values ? values.assigneeId as string | null : userId;
    if (assigneeId && !await tx.user.findFirst({ where: { id: assigneeId, organizationId, active: true, role: { not: "compassion_user" } }, select: { id: true } })) throw new DonationFollowUpError("Choose an active staff account in your organization.");
    if (values.reminderAt instanceof Date && values.dueDate instanceof Date && values.reminderAt > values.dueDate) throw new DonationFollowUpError("The reminder must be on or before the due date.");
    const task = await tx.task.create({ data: { ...values, title: String(values.title), organizationId, createdById: userId, assigneeId, constituentId: gift.constituentId, sourceModule: "donor", sourceType: "donation-follow-up", sourceId: gift.id, metadata: { donationId: gift.id, requestId }, ...(values.status === "COMPLETED" ? { completedAt: new Date(), completedById: userId } : {}) } as Prisma.TaskUncheckedCreateInput, include: { assignee: { select: { id: true, firstName: true, lastName: true } }, constituent: { select: { id: true, firstName: true, lastName: true } } } });
    await tx.activity.create({ data: { constituentId: gift.constituentId, donationId: gift.id, taskId: task.id, userId, type: "NOTE", description: `Donation follow-up created: ${task.title}`, metadata: { source: "donation-follow-up", donationId: gift.id } } });
    return { task, reused: false };
  });
  let notificationWarning: string | undefined;
  if (!result.reused && result.task.assigneeId && ["PENDING", "IN_PROGRESS"].includes(result.task.status)) {
    try { await createTaskAssignmentNotification({ organizationId, assigneeId: result.task.assigneeId, taskId: result.task.id, taskTitle: result.task.title, dueDate: result.task.dueDate }); }
    catch { notificationWarning = "Task saved. Its in-app notification is pending; do not create the task again."; }
  }
  return { ...result.task, reused: result.reused, ...(notificationWarning ? { notificationWarning } : {}) };
}
