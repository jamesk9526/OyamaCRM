import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { CreateError, type Channel } from "./domain.js";
import { emailRecordAccessible } from "./legacy.js";
import { isTrashed } from "./trash-state.js";

export async function can(req: Request, permission: PermissionKey): Promise<boolean> {
  if (!req.user?.sub || !req.user.orgId || !req.user.role) return false;
  const override = await prisma.userPermission.findUnique({ where: { userId_permission: { userId: req.user.sub, permission } } });
  return override ? override.granted : hasDefaultPermission(req.user.role, permission);
}
export async function demand(req: Request, permission: PermissionKey) {
  if (!(await can(req, permission))) throw new CreateError(403, `Permission required: ${permission}`);
}
export async function demandChannels(req: Request, channels: Channel[], write = false, publish = false) {
  for (const channel of channels) {
    if (channel === "LETTER") {
      await demand(req, write ? "letters.edit" : "letters.view");
      if (publish) { await demand(req, "letters.generate_batch"); await demand(req, "letters.export_pdf"); }
    } else {
      await demand(req, write ? "edit:communications" : "view:communications");
      if (publish && channel === "SMS") await demand(req, "create.sms.publish");
      if (publish && channel === "SOCIAL") await demand(req, "create.social.publish");
    }
  }
}
export async function assertCampaign(req: Request, id: string, manage = false, tx: Prisma.TransactionClient = prisma, allowTrashed = false) {
  const campaign = await tx.createCampaign.findFirst({ where: { id, organizationId: req.user!.orgId } });
  if (!campaign) throw new CreateError(404, "Campaign not found.");
  if (manage && !allowTrashed && await isTrashed(req.user!.orgId, "CAMPAIGN", id, tx)) throw new CreateError(409, "Restore this campaign from Trash before editing or releasing it.");
  const channels = campaign.channelsJson as Channel[];
  await demandChannels(req, channels.length ? channels : ["EMAIL"]);
  if (campaign.fundraisingCampaignId) await demand(req, "view:campaigns");
  const bindings = await tx.createVariant.findMany({ where: { organizationId: req.user!.orgId, content: { campaignId: id }, channel: "EMAIL", legacyId: { not: null } }, select: { legacyId: true } });
  if (bindings.length) {
    const emails = await tx.emailCampaign.findMany({ where: { organizationId: req.user!.orgId, id: { in: bindings.map(item => item.legacyId!) } } });
    if (emails.some(email => !emailRecordAccessible(email, req.user!.sub, req.user!.role, manage))) throw new CreateError(403, manage ? "Only the owner or an administrator may manage this bound email." : "This campaign contains a private email owned by another staff member.");
  }
  return campaign;
}
export async function touchCampaign(tx: Prisma.TransactionClient, org: string, id: string, revision: number) {
  if (!Number.isInteger(revision)) throw new CreateError(400, "The campaign revision is required.");
  const changed = await tx.createCampaign.updateMany({ where: { id, organizationId: org, revision }, data: { revision: { increment: 1 }, status: "DRAFT" } });
  if (!changed.count) throw new CreateError(409, "This campaign changed in another session. Your local draft is preserved. Reload the saved version before retrying.");
  if (await isTrashed(org, "CAMPAIGN", id, tx)) throw new CreateError(409, "Restore this campaign from Trash before editing it.");
  const releases = await tx.createRelease.findMany({ where: { organizationId: org, campaignId: id, status: { in: ["APPROVED", "RELEASED"] } }, select: { id: true } });
  await tx.createDelivery.updateMany({ where: { releaseId: { in: releases.map(item => item.id) }, status: { in: ["HELD", "PENDING", "PAUSED", "PREPARING"] } }, data: { status: "CANCELLED", error: "Campaign changed; review and approve a new release." } });
  await tx.createRelease.updateMany({ where: { id: { in: releases.map(item => item.id) } }, data: { status: "SUPERSEDED" } });
}
