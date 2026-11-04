import { prisma } from "./database.js";

export const OPEN_CARE_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"] as const;
export async function hasActiveCaseworkAccount(organizationId: string, userId: string): Promise<boolean> {
  const [account, membership] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, organizationId, active: true }, select: { id: true } }),
    prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId, userId } } }),
  ]);
  return Boolean(account && membership?.active && ["ADMIN", "CASEWORKER", "CLINICIAN", "PHYSICIAN"].includes(membership.role));
}
