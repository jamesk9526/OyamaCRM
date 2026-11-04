import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function trashedIds(org: string, kind: string, tx: Prisma.TransactionClient = prisma) {
  const rows = await tx.createTrashItem.findMany({ where: { organizationId: org, kind, restoredAt: null }, select: { resourceId: true } });
  return rows.map(row => row.resourceId);
}

export async function isTrashed(org: string, kind: string, resourceId: string, tx: Prisma.TransactionClient = prisma) {
  return !!await tx.createTrashItem.findFirst({ where: { organizationId: org, kind, resourceId, restoredAt: null }, select: { id: true } });
}
