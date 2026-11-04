import { hydrateStudioAssets } from "./studio/frozen-assets.js";
import type { CreateDelivery, EmailPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { enqueueSnapshot, validateCurrentRecipient } from "../services/letter-production.js";
import type { LetterSnapshot } from "../services/letter-production-contract.js";
import { sendCampaignNow } from "../routes/email-campaigns.js";
import { CreateError, object, string } from "./domain.js";
import { ProviderError, sendAzure, graphRequest, metaAccount } from "./providers.js";
import { publishFrozenPage } from "./web.js";
import type { FrozenContent, FrozenVariant, ReleaseSnapshot } from "./releases.js";

export async function approverCanDispatch(org: string, actor: string, channel: string) {
  const user = await prisma.user.findFirst({ where: { id: actor, organizationId: org, active: true } });
  if (!user) throw new CreateError(403, "The release approver no longer has an active account. Review with an authorized staff member.");
  const permissions: PermissionKey[] = channel === "LETTER" ? ["letters.generate_batch", "letters.export_pdf"] : channel === "SMS" ? ["edit:communications", "create.sms.publish"] : channel === "SOCIAL" ? ["edit:communications", "create.social.publish"] : ["edit:communications"];
  for (const permission of permissions) {
    const override = await prisma.userPermission.findUnique({ where: { userId_permission: { userId: actor, permission } } });
    if (!(override ? override.granted : hasDefaultPermission(user.role, permission))) throw new CreateError(403, "The release approver's channel permissions changed. Renew approval.");
  }
}
async function emailDelivery(job: CreateDelivery, variant: FrozenVariant, actor: string) {
  if (!variant.email) throw new CreateError(422, "The approved email snapshot is missing.");
  const member = object(object(job.payloadJson).member);
  if (string(member.constituentId)) {
    const current = await prisma.constituent.findFirst({ where: { organizationId: job.organizationId, id: string(member.constituentId) } });
    if (!current || current.doNotContact || current.doNotEmail || current.emailOptOut || current.email?.trim().toLowerCase() !== job.recipientKey) {
      await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "SUPPRESSED", error: "Contact eligibility or email address changed after approval." } }); return;
    }
  }
  const executionId = job.executionId || `create_${job.id}_${job.attempts}`;
  // DRAFT executions are exclusively owned by Create. The legacy scheduled-email worker cannot claim them.
  const studioEmail = object(object(object(job.payloadJson).studio).email);
  const snapshot = { ...variant.email, ...(typeof studioEmail.html === "string" ? {bodyHtml:studioEmail.html,bodyText:string(studioEmail.text),...(typeof studioEmail.subject==="string"?{subject:studioEmail.subject}:{})} : {}) };
  const sourceSharing = variant.sourceSharing || { ownerId: actor, sharedWithOrganization: false };
  const email = await prisma.emailCampaign.upsert({ where: { id: executionId }, update: {}, create: { ...snapshot, purpose: snapshot.purpose as EmailPurpose, id: executionId, organizationId: job.organizationId, status: "DRAFT", audienceFilter: JSON.stringify({ _create: { releaseId: job.releaseId, deliveryId: job.id }, _sharing: { ownerId: sourceSharing.ownerId || null, sharedWithOrganization: sourceSharing.sharedWithOrganization === true } }) } });
  await prisma.createDelivery.update({ where: { id: job.id }, data: { executionId } });
  if (email.status !== "DRAFT") throw new ProviderError("This email execution already started. Reconcile its recipient log before retrying.", true);
  await sendCampaignNow(executionId, "MANUAL", { sendMode: "INDIVIDUAL", recipientEmails: [job.recipientKey], approvedBodies: { html: snapshot.bodyHtml || "", text: snapshot.bodyText || "" } });
  const accepted = await prisma.emailSendRecipient.findFirst({ where: { organizationId: job.organizationId, campaignId: executionId, email: job.recipientKey, sentAt: { not: null } } });
  if (!accepted) throw new ProviderError("The email was not accepted. Review the native delivery diagnostics before retrying.", false);
  await prisma.createDelivery.updateMany({ where: { id: job.id, status: "SENDING" }, data: { status: "ACCEPTED", acceptedAt: accepted.sentAt, error: null } });
}
async function letterDelivery(job: CreateDelivery, variant: FrozenVariant, actor: string, snapshot: ReleaseSnapshot) {
  const studio = object(object(job.payloadJson).studio);
  if (Array.isArray(studio.artifacts)) {
    if (!studio.artifacts.length) throw new CreateError(422, "The approved appeal pack has no frozen artifacts.");
    let primary: {id:string;generatedId:string}|null=null;
    for(const raw of studio.artifacts){const artifact=object(raw),letter=object(artifact.snapshot) as unknown as LetterSnapshot;await validateCurrentRecipient(job.organizationId,letter);hydrateStudioAssets(letter,snapshot.assetBundle);const key=`${job.deliveryKey}:${string(artifact.kind)}`;
      const generated=await prisma.generatedLetter.upsert({where:{productionKey:key},update:{},create:{organizationId:job.organizationId,productionKey:key,templateId:letter.templateId,constituentId:letter.recipientId,campaignId:snapshot.campaign.fundraisingCampaignId,eventId:snapshot.campaign.eventId,category:"GENERAL",mergedPrintBody:letter.bodyHtml,mergedPrintSubject:letter.subject,generatedByUserId:actor,metadataJson:{productionVersion:2,createReleaseId:job.releaseId,studioKind:string(artifact.kind),studioSensitive:letter.studio?.sensitive===true,queue:{reviewStatus:"NEEDS_REVIEW",printStatus:"NEEDS_REVIEW"}}}});
      letter.generatedLetterId=generated.id;const rendered=await enqueueSnapshot(letter,actor);
      await prisma.createPrintArtifact.upsert({where:{deliveryId_kind:{deliveryId:job.id,kind:string(artifact.kind)}},update:{renderJobId:rendered.id,status:"PREPARED"},create:{organizationId:job.organizationId,deliveryId:job.id,kind:string(artifact.kind),generatedLetterId:generated.id,renderJobId:rendered.id,snapshotJson:JSON.parse(JSON.stringify(letter)),status:"PREPARED"}});
      if(artifact.kind==="LETTER")primary={id:rendered.id,generatedId:generated.id};
    }
    if(!primary)throw new CreateError(422,"The approved appeal pack is missing its letter.");
    await prisma.createDelivery.update({where:{id:job.id},data:{status:"PREPARED",executionId:primary.generatedId,providerId:primary.id,error:null}});return;
  }
  if (!variant.letterBase) throw new CreateError(422, "The approved print snapshot is missing.");
  const letter = { ...variant.letterBase, ...object(object(job.payloadJson).letter) } as LetterSnapshot;
  await validateCurrentRecipient(job.organizationId, letter);
  const generated = await prisma.generatedLetter.upsert({ where: { productionKey: job.deliveryKey }, update: {}, create: { organizationId: job.organizationId, productionKey: job.deliveryKey, templateId: letter.templateId, constituentId: letter.recipientId, campaignId: snapshot.campaign.fundraisingCampaignId, eventId: snapshot.campaign.eventId, category: "GENERAL", mergedPrintBody: letter.bodyHtml, mergedPrintSubject: letter.subject, generatedByUserId: actor, metadataJson: { productionVersion: 2, createReleaseId: job.releaseId, queue: { reviewStatus: "NEEDS_REVIEW", printStatus: "NEEDS_REVIEW" } } } });
  letter.generatedLetterId = generated.id;
  const artifact = await enqueueSnapshot(letter, actor);
  await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PREPARED", executionId: generated.id, providerId: artifact.id, error: null } });
}
async function socialDelivery(job: CreateDelivery, variant: FrozenVariant) {
  const connection = await prisma.createConnection.findUnique({ where: { organizationId_provider: { organizationId: job.organizationId, provider: "META" } } });
  if (!connection?.readyAt) throw new CreateError(422, "The Meta connection must pass readiness again.");
  const { account, token, version } = metaAccount(connection, variant.format.accountId);
  const caption = variant.format.caption || variant.text;
  if (variant.format.network === "INSTAGRAM") {
    if (!variant.format.mediaUrl || !string(account.instagramId)) throw new CreateError(422, "Instagram requires a professional account and a public image URL.");
    if (!job.executionId) {
      const media = await graphRequest(token, version, `${account.instagramId}/media`, { image_url: variant.format.mediaUrl, caption });
      if (!string(media.id)) throw new ProviderError("Meta did not return a media container ID.", true);
      await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PREPARING", executionId: string(media.id), claimedAt: null } });
      return;
    }
    const status = await graphRequest(token, version, `${job.executionId}?fields=status_code`);
    if (["ERROR", "EXPIRED"].includes(string(status.status_code))) throw new ProviderError("Instagram media preparation failed or expired. Review the image before retrying.", false);
    if (status.status_code !== "FINISHED") {
      await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PREPARING", claimedAt: null, scheduledAt: new Date(Date.now() + 15000) } }); return;
    }
    const published = await graphRequest(token, version, `${account.instagramId}/media_publish`, { creation_id: job.executionId });
    if (!string(published.id)) throw new ProviderError("Meta did not return the published Instagram post ID.", true);
    await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PUBLISHED", providerId: string(published.id), acceptedAt: new Date() } });
  } else {
    const published = variant.format.mediaUrl ? await graphRequest(token, version, `${account.id}/photos`, { url: variant.format.mediaUrl, caption }) : await graphRequest(token, version, `${account.id}/feed`, { message: caption, ...(variant.format.ctaUrl ? { link: variant.format.ctaUrl } : {}) });
    const postId = string(published.post_id || published.id);
    if (!postId) throw new ProviderError("Meta did not return a published Facebook post ID.", true);
    await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PUBLISHED", providerId: postId, acceptedAt: new Date() } });
  }
}
async function dispatch(job: CreateDelivery, content: FrozenContent, variant: FrozenVariant, snapshot: ReleaseSnapshot, actor: string) {
  await approverCanDispatch(job.organizationId, actor, job.channel);
  if (variant.format.requiresLandingPage && job.channel !== "WEB") {
    const webJob = await prisma.createDelivery.findFirst({ where: { releaseId: job.releaseId, channel: "WEB", status: "PUBLISHED" } });
    if (!webJob) {
      await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PENDING", claimedAt: null, scheduledAt: new Date(Date.now() + 30000), error: "Waiting for this release's landing page to publish." } }); return;
    }
  }
  if (job.channel === "EMAIL") return emailDelivery(job, variant, actor);
  if (job.channel === "LETTER") return letterDelivery(job, variant, actor, snapshot);
  if (job.channel === "WEB") {
    const publication = await publishFrozenPage(job.organizationId, actor, snapshot, content, variant);
    await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "PUBLISHED", providerId: publication.id, acceptedAt: new Date() } }); return;
  }
  if (job.channel === "SOCIAL") return socialDelivery(job, variant);
  if (job.channel === "SMS") {
    const connection = await prisma.createConnection.findUnique({ where: { organizationId_provider: { organizationId: job.organizationId, provider: "AZURE_SMS" } } });
    if (!connection?.readyAt) throw new CreateError(422, "The Azure connection must pass readiness again.");
    const consent = await prisma.createSmsConsent.findUnique({ where: { organizationId_phone: { organizationId: job.organizationId, phone: job.recipientKey } } });
    const member = object(object(job.payloadJson).member);
    const contact = string(member.constituentId) ? await prisma.constituent.findFirst({ where: { organizationId: job.organizationId, id: string(member.constituentId) } }) : null;
    if (consent?.status !== "OPTED_IN" || !contact || contact.doNotContact || contact.phone?.trim() !== job.recipientKey) {
      await prisma.createDelivery.update({ where: { id: job.id }, data: { status: "SUPPRESSED", error: "SMS consent or contact eligibility changed after approval." } }); return;
    }
    const providerId = await sendAzure(connection, job.recipientKey, variant.format.caption || variant.text, job.id, job.claimedAt || new Date(), job.attempts);
    // A delivery report may arrive before the acceptance response. Never regress a terminal event.
    await prisma.createDelivery.updateMany({ where: { id: job.id, status: "SENDING" }, data: { status: "ACCEPTED", providerId, acceptedAt: new Date(), error: null } });
  }
}
export async function processCreateQueue(limit = 10) {
  // A crashed send cannot safely be re-issued without provider reconciliation.
  await prisma.createDelivery.updateMany({ where: { status: "SENDING", claimedAt: { lt: new Date(Date.now() - 10 * 60000) } }, data: { status: "UNKNOWN", error: "Worker interrupted while dispatching. Reconcile the provider outcome before retrying." } });
  const organizations = await prisma.organizationSettings.findMany({ where: { oyamaCreateEnabled: true }, select: { organizationId: true } });
  if (!organizations.length) return 0;
  const jobs = await prisma.createDelivery.findMany({ where: { organizationId: { in: organizations.map(item => item.organizationId) }, status: { in: ["PENDING", "PREPARING"] }, scheduledAt: { lte: new Date() }, release: { status: "RELEASED" } }, orderBy: [{ channel: "desc" }, { scheduledAt: "asc" }, { createdAt: "asc" }], take: limit, include: { release: true } });
  for (const job of jobs.sort((a, b) => Number(b.channel === "WEB") - Number(a.channel === "WEB"))) {
    const setting = await prisma.organizationSettings.findUnique({ where: { organizationId: job.organizationId } });
    if (!setting?.oyamaCreateEnabled) continue;
    const claimedAt = new Date();
    const claimed = await prisma.createDelivery.updateMany({ where: { id: job.id, status: job.status, release: { status: "RELEASED" } }, data: { status: "SENDING", claimedAt, attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      const snapshot = job.release.snapshotJson as unknown as ReleaseSnapshot;
      const content = snapshot.contents.find(item => item.id === job.contentId), variant = content?.variants.find(item => item.channel === job.channel);
      if (!content || !variant) throw new CreateError(422, "Approved content is missing.");
      await dispatch({ ...job, claimedAt, attempts: job.attempts + 1 }, content, variant, snapshot, job.release.approvedBy);
    } catch (error) {
      const ambiguous = error instanceof ProviderError ? error.ambiguous : ["EMAIL", "SMS", "SOCIAL"].includes(job.channel) && !(error instanceof CreateError);
      await prisma.createDelivery.updateMany({ where: { id: job.id, status: "SENDING" }, data: { status: ambiguous ? "UNKNOWN" : "FAILED", error: error instanceof Error ? error.message.slice(0, 2000) : "Delivery failed." } });
    }
  }
  return jobs.length;
}
let timer: NodeJS.Timeout | null = null, processing = false;
export function startCreateWorker() {
  if (timer) return;
  const tick = async () => { if (processing) return; processing = true; try { await processCreateQueue(); } catch (error) { console.error("[oyamaCreate] queue pass failed", error instanceof Error ? error.message : "unknown"); } finally { processing = false; } };
  timer = setInterval(() => void tick(), 15000); timer.unref();
}
export function stopCreateWorker() { if (timer) clearInterval(timer); timer = null; }
