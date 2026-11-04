import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
/** Awaited by legacy writers, so pending Create releases cannot outlive a changed native draft. */
export async function invalidateLegacyBindings(org: string, channel: "EMAIL" | "LETTER", legacyId?: string) {
  try {
    const bindings = await prisma.createVariant.findMany({ where: { organizationId: org, channel, ...(legacyId ? { legacyId } : { legacyId: { not: null } }) }, include: { content: { select: { campaignId: true } } } });
    if (!bindings.length) return;
    await prisma.$transaction(async tx => {
      const campaignIds = [...new Set(bindings.map(item => item.content.campaignId))];
      await tx.createCampaign.updateMany({ where: { organizationId: org, id: { in: campaignIds } }, data: { revision: { increment: 1 }, status: "DRAFT" } });
      await tx.createVariant.updateMany({ where: { organizationId: org, id: { in: bindings.map(item => item.id) } }, data: { needsReview: true, revision: { increment: 1 } } });
      const releases = await tx.createRelease.findMany({ where: { organizationId: org, campaignId: { in: campaignIds }, status: { in: ["APPROVED", "RELEASED"] } }, select: { id: true } });
      await tx.createRelease.updateMany({ where: { id: { in: releases.map(item => item.id) } }, data: { status: "SUPERSEDED" } });
      await tx.createDelivery.updateMany({ where: { releaseId: { in: releases.map(item => item.id) }, status: { in: ["HELD", "PENDING", "PAUSED", "PREPARING"] } }, data: { status: "CANCELLED", error: "Native draft changed; renew campaign review." } });
    });
  } catch (error) {
    // A disabled rollout must not break existing installations before the additive migration is installed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return;
    throw error;
  }
}
