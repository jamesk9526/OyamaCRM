import { trashedIds } from "./trash-state.js";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { assertCampaign, demand, demandChannels } from "./access.js";
import { route, param } from "./http.js";
import { CreateError, required, string, type Channel } from "./domain.js";
import { metaAccount, graphRequest } from "./providers.js";
import { object, variantFrom } from "./domain.js";
import type { ReleaseSnapshot } from "./releases.js";
const router = Router();

router.get("/deliveries/:id/insights", route(async (req, res, org) => {
  await demand(req, "view:communications");
  const job = await prisma.createDelivery.findFirst({ where: { id: param(req), organizationId: org, channel: "SOCIAL", status: "PUBLISHED" }, include: { release: true } });
  if (!job?.providerId) throw new CreateError(404, "Published social delivery not found.");
  await assertCampaign(req, job.release.campaignId);
  const snapshot = job.release.snapshotJson as unknown as ReleaseSnapshot;
  const variant = snapshot.contents.find(item => item.id === job.contentId)?.variants.find(item => item.channel === "SOCIAL");
  const connection = await prisma.createConnection.findUnique({ where: { organizationId_provider: { organizationId: org, provider: "META" } } });
  if (!variant || !connection?.readyAt) throw new CreateError(422, "Verify the Meta connection before loading insights.");
  const { token, version } = metaAccount(connection, variant.format.accountId);
  try {
    if (variant.format.network === "INSTAGRAM") {
      const response = await graphRequest(token, version, `${job.providerId}/insights?metric=reach,saved,shares,total_interactions`);
      res.json({ available: true, metrics: (Array.isArray(response.data) ? response.data : []).map(object).map(metric => ({ name: string(metric.name), value: Array.isArray(metric.values) ? object(metric.values[0]).value : object(metric.total_value).value })) });
    } else {
      const response = await graphRequest(token, version, `${job.providerId}?fields=shares,comments.summary%28true%29,reactions.summary%28true%29`);
      res.json({ available: true, metrics: [{ name: "shares", value: object(response.shares).count ?? null }, { name: "comments", value: object(object(response.comments).summary).total_count ?? null }, { name: "reactions", value: object(object(response.reactions).summary).total_count ?? null }] });
    }
  } catch { res.json({ available: false, reason: "The provider did not make these insights available for this account, post, or granted scope." }); }
}));

router.get("/deliveries", route(async (req, res, org) => {
  const campaignId = string(req.query.campaignId);
  if (campaignId) await assertCampaign(req, campaignId);
  else await demand(req, "view:communications");
  const channel = string(req.query.channel);
  if (channel) await demandChannels(req, [channel as Channel]);
  const page = Math.max(1, Math.min(10000, Number.parseInt(string(req.query.page) || "1", 10) || 1));
  const where = { organizationId: org, ...(campaignId ? { release: { campaignId } } : {}), ...(channel ? { channel } : {}), ...(req.query.status ? { status: string(req.query.status) } : {}) };
  const [items, total] = await Promise.all([
    prisma.createDelivery.findMany({ where, orderBy: { scheduledAt: "desc" }, take: 50, skip: (page - 1) * 50, select: { id: true, releaseId: true, contentId: true, channel: true, recipientKey: true, status: true, scheduledAt: true, attempts: true, providerId: true, executionId: true, error: true, acceptedAt: true, deliveredAt: true, release: { select: { campaignId: true, campaign: { select: { name: true } } } } } }),
    prisma.createDelivery.count({ where }),
  ]);
  const visible = [];
  for (const item of items) { try { await demandChannels(req, [item.channel as Channel]); await assertCampaign(req, item.release.campaignId); visible.push(item); } catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) continue; throw error; } }
  res.json({ items: visible, total, page, pageSize: 50 });
}));
router.post("/deliveries/:id/:action", route(async (req, res, org, actor) => {
  const job = await prisma.createDelivery.findFirst({ where: { id: param(req), organizationId: org }, include: { release: true } });
  if (!job) throw new CreateError(404, "Delivery not found.");
  const campaign = await assertCampaign(req, job.release.campaignId, true); await demandChannels(req, [job.channel as Channel], true, true);
  const action = param(req, "action"); let data: { status: string; error?: string | null; executionId?: string | null; providerId?: string | null; acceptedAt?: Date | null };
  const currentRelease = job.release.status === "RELEASED" && job.release.campaignRevision === campaign.revision;
  if (action === "pause" && ["PENDING", "PREPARING"].includes(job.status)) data = { status: "PAUSED" };
  else if (action === "resume" && job.status === "PAUSED" && currentRelease) data = { status: job.channel === "SOCIAL" && job.executionId ? "PREPARING" : "PENDING", error: null };
  else if (action === "cancel" && ["HELD", "PENDING", "PAUSED", "PREPARING", "FAILED", "PREPARED"].includes(job.status)) data = { status: "CANCELLED", error: "Cancelled by staff." };
  else if (action === "retry" && job.status === "FAILED" && currentRelease && req.body.confirm === true) data = { status: "PENDING", error: null, executionId: null, providerId: null };
  else if (action === "reconcile" && job.status === "UNKNOWN" && currentRelease && req.body.confirm === true) {
    await demand(req, "create.connections.manage");
    required(req.body.evidence, "Provider reconciliation evidence", 5000);
    if (req.body.outcome === "ACCEPTED") data = { status: job.channel === "SOCIAL" ? "PUBLISHED" : "ACCEPTED", providerId: required(req.body.providerId, "Provider reference", 200), acceptedAt: new Date(), error: null };
    else if (req.body.outcome === "NOT_SENT") data = { status: "FAILED", error: "Provider confirmed no delivery. Staff may review and retry.", executionId: null, providerId: null };
    else throw new CreateError(400, "Record the provider's accepted or not-sent outcome.");
  } else throw new CreateError(409, "This action does not apply to the delivery's current state. Refresh its status.");
  await prisma.$transaction(async tx => {
    const changed = await tx.createDelivery.updateMany({ where: { id: job.id, organizationId: org, status: job.status }, data });
    if (!changed.count) throw new CreateError(409, "The delivery changed while you were reviewing it.");
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: `CREATE_DELIVERY_${action.toUpperCase()}`, entity: "CreateDelivery", entityId: job.id, metadata: json({ from: job.status, to: data.status, evidence: req.body.evidence || null, providerId: data.providerId || null }) } });
  }); res.json({ updated: true });
}));
router.get("/calendar", route(async (req, res, org) => {
  await demand(req, "view:communications");
  if (req.query.after !== undefined && typeof req.query.after !== "string") throw new CreateError(400, "Use a valid calendar cursor.");
  let cursor = string(req.query.after).slice(0, 191), scanned = 0, exhausted = false;
  const visible: Array<{ id: string; contentId: string; name: string; channel: string; scheduledAt: string; campaignId: string; campaign: { name: string; status: string } }> = [];
  const visibility = new Map<string, boolean>();
  // A stable ID cursor survives date edits. Undated/private rows never consume the result limit.
  while (scanned < 1000 && visible.length < 500) {
    const batchSize = Math.min(100, 1000 - scanned);
    const items = await prisma.createContent.findMany({ where: { organizationId: org, ...(cursor ? { id: { gt: cursor } } : {}), campaign: { isTemplate: false, id: { notIn: await trashedIds(org, "CAMPAIGN") } } }, orderBy: { id: "asc" }, take: batchSize, select: { id: true, name: true, scheduledAt: true, campaignId: true, variants: { select: { channel: true, documentJson: true } }, campaign: { select: { name: true, status: true, channelsJson: true, startsAt: true } } } });
    if (!items.length) { exhausted = true; break; }
    for (const item of items) {
      cursor = item.id; scanned++;
      if (!visibility.has(item.campaignId)) {
        try { await assertCampaign(req, item.campaignId); visibility.set(item.campaignId, true); }
        catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) visibility.set(item.campaignId, false); else throw error; }
      }
      if (!visibility.get(item.campaignId)) continue;
      for (const variant of item.variants) {
        if (!(item.campaign.channelsJson as string[]).includes(variant.channel)||variantFrom(variant.documentJson).enabled===false) continue;
        const scheduledAt = variantFrom(variant.documentJson).scheduledAt || item.scheduledAt?.toISOString() || item.campaign.startsAt?.toISOString();
        if (scheduledAt) visible.push({ id: `${item.id}:${variant.channel}`, contentId: item.id, name: item.name, channel: variant.channel, scheduledAt, campaignId: item.campaignId, campaign: { name: item.campaign.name, status: item.campaign.status } });
      }
      if (visible.length >= 500) break;
    }
    if (items.length < batchSize && cursor === items[items.length - 1].id) { exhausted = true; break; }
  }
  res.json({ items: visible.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), hasMore: !exhausted, nextCursor: exhausted ? null : cursor });
}));
router.get("/campaigns/:id/results", route(async (req, res, org) => {
  const campaign = await assertCampaign(req, param(req));
  const deliveries = await prisma.createDelivery.groupBy({ by: ["channel", "status"], where: { organizationId: org, release: { campaignId: campaign.id } }, _count: { _all: true } });
  const executions = await prisma.createDelivery.findMany({ where: { organizationId: org, channel: "EMAIL", release: { campaignId: campaign.id }, executionId: { not: null } }, select: { executionId: true } });
  const bindings = await prisma.createVariant.findMany({ where: { organizationId: org, content: { campaignId: campaign.id }, legacyId: { not: null } }, select: { channel: true, legacyId: true } });
  const legacyIds = bindings.filter(row => row.channel === "EMAIL").map(row => row.legacyId!);
  const emailIds = [...new Set([...executions.flatMap(row => row.executionId ? [row.executionId] : []), ...legacyIds])];
  const events = emailIds.length ? await prisma.emailCampaignDeliveryEvent.findMany({ where: { organizationId: org, campaignId: { in: emailIds } }, select: { campaignId: true, recipientEmail: true, eventType: true, metadata: true } }) : [];
  const eventCounts = new Map<string, Set<string>>();
  for (const event of events) {
    const metadata = event.metadata as Record<string, unknown> | null;
    // SMTP acceptance is deliberately excluded from confirmed-delivery metrics.
    if (event.eventType === "DELIVERED" && metadata?.source === "smtp_acceptance") continue;
    const set = eventCounts.get(event.eventType) || new Set<string>(); set.add(`${event.campaignId}:${event.recipientEmail}`); eventCounts.set(event.eventType, set);
  }
  const giving = campaign.fundraisingCampaignId ? await prisma.donation.aggregate({ where: { campaignId: campaign.fundraisingCampaignId, status: "COMPLETED", constituent: { organizationId: org } }, _sum: { amount: true }, _count: { _all: true } }) : null;
  const nativePrintHistory = await prisma.generatedLetter.groupBy({ by: ["status"], where: { organizationId: org, templateId: { in: bindings.filter(row => row.channel === "LETTER").map(row => row.legacyId!) } }, _count: { _all: true } });
  const socialPosts = await prisma.createDelivery.findMany({ where: { organizationId: org, channel: "SOCIAL", status: "PUBLISHED", release: { campaignId: campaign.id } }, select: { id: true, recipientKey: true, providerId: true, acceptedAt: true }, take: 100, orderBy: { acceptedAt: "desc" } });
  const leads = await prisma.createLead.groupBy({ by: ["status"], where: { organizationId: org, campaignId: campaign.id }, _count: { _all: true } });
  const nativeAccepted = legacyIds.length ? await prisma.emailSendRecipient.count({ where: { organizationId: org, campaignId: { in: legacyIds }, sentAt: { not: null } } }) : 0;
  res.json({ deliveries, nativePrintHistory, socialPosts, email: { accepted: nativeAccepted + deliveries.filter(row => row.channel === "EMAIL" && ["ACCEPTED", "DELIVERED"].includes(row.status)).reduce((sum, row) => sum + row._count._all, 0), confirmedDelivered: eventCounts.get("DELIVERED")?.size ?? null, opened: eventCounts.get("OPENED")?.size ?? null, clicked: eventCounts.get("CLICKED")?.size ?? null }, giving: giving ? { amount: Number(giving._sum.amount || 0), gifts: giving._count._all, attribution: "Linked fundraising campaign totals" } : null, leads, socialInsights: { available: socialPosts.length > 0, reason: socialPosts.length ? "Load available insights for each published post. Provider scopes and post type determine which metrics are returned." : "Social insights are unavailable until a connected account publishes a campaign post." }, eventResultsUrl: campaign.eventId ? `/events/${campaign.eventId}` : null });
}));
export default router;
