import { parseDefinition } from "./definition.js";
import { renderSurveyEmail } from "./email.js";
import { prisma as db } from "../compassion/database.js";
import type { SurveyAudience } from "@prisma/client";
import { createOrganizationEmailSender, describeOrganizationEmailSender } from "../services/smtp-service.js";
import { surveyAccess } from "./access.js";
import { emailDecisions, surveyContacts } from "./contacts.js";
import { publicOrigin } from "./distribution.js";
import { digest, invitationToken, openSurvey, randomToken, surveyPath } from "./storage.js";

const jobInclude = {
  invitation: { include: { distribution: true, revision: { include: { survey: true } } } },
} as const;
const cutoffMs = 15 * 60_000;
let timer: NodeJS.Timeout | undefined;
let running: Promise<void> | undefined;
let lastCompletedAt: Date | undefined;
let failed = false;

async function donorPreferences(organizationId: string, email: string, contactId: string | null, origin: string) {
  const subscription = await db.emailSubscription.upsert({
    where: { organizationId_email: { organizationId, email } },
    update: {}, create: { organizationId, email, constituentId: contactId, globalStatus: "UNKNOWN", source: "survey-invitation" },
  });
  const token = randomToken();
  await db.emailUnsubscribeToken.create({ data: {
    organizationId, email, subscriptionId: subscription.id, tokenHash: digest(token),
    category: "SURVEY", expiresAt: new Date(Date.now() + 180 * 86400_000),
  } });
  return [
    { label: "Unsubscribe from surveys", href: `${origin}/unsubscribe/${token}` },
    { label: "Manage survey preferences", href: `${origin}/preferences/${token}` },
  ];
}

async function dispatch(jobId: string, organizationId: string) {
  const finish = (status: "SKIPPED" | "FAILED" | "UNKNOWN" | "SENT", outcome: string | null = null) =>
    db.surveyDeliveryJob.updateMany({ where: { id: jobId, organizationId, status: "SENDING" },
      data: { status, finishedAt: new Date(), outcome } });
  const claim = await db.surveyDeliveryJob.updateMany({
    where: { id: jobId, organizationId, status: "QUEUED", dueAt: { lte: new Date() } },
    data: { status: "SENDING", claimedAt: new Date() },
  });
  if (!claim.count) return;
  let handedToProvider = false;
  try {
    const job = await db.surveyDeliveryJob.findFirstOrThrow({ where: { id: jobId, organizationId }, include: jobInclude });
    const { invitation } = job;
    const { distribution, revision } = invitation;
    const { survey } = revision;
    if (!distribution || !openSurvey(survey) || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.completedAt) {
      await finish("SKIPPED", "Survey or invitation is no longer eligible.");
      return;
    }
    if (job.reminder) {
      const first = await db.surveyDeliveryJob.findFirst({ where: { organizationId, invitationId: invitation.id, reminder: false } });
      if (first?.status !== "SENT") {
        if (first?.status === "SENDING" || first?.status === "QUEUED") {
          await db.surveyDeliveryJob.updateMany({ where: { id: job.id, organizationId, status: "SENDING" },
            data: { status: "QUEUED", claimedAt: null, dueAt: new Date(Date.now() + 60_000) } });
        } else await finish("SKIPPED", "The original invitation was not confirmed sent.");
        return;
      }
      if (first.finishedAt && distribution.reminderDays) {
        const earliestReminder = new Date(first.finishedAt.getTime() + distribution.reminderDays * 86400_000);
        if (earliestReminder > new Date()) {
          await db.surveyDeliveryJob.updateMany({ where: { id: job.id, organizationId, status: "SENDING" },
            data: { status: "QUEUED", claimedAt: null, dueAt: earliestReminder } });
          return;
        }
      }
    }
    const access = await surveyAccess(organizationId, distribution.actorId, survey.audience);
    if (!access[survey.audience].includes("send") || !access[survey.audience].includes("view")) {
      await finish("SKIPPED", "The approving user no longer has survey sending access.");
      return;
    }
    const origin = publicOrigin();
    if (origin !== distribution.origin || await describeOrganizationEmailSender(organizationId) !== distribution.sender) {
      await finish("FAILED", "The reviewed public URL or sender configuration changed.");
      return;
    }
    const token = survey.identity === "LINKED" ? invitationToken(invitation.id) : revision.publicKey;
    if (!token || (survey.identity === "LINKED" && digest(token) !== invitation.tokenHash)) {
      await finish("FAILED", "The invitation link signing configuration changed.");
      return;
    }
    const sender = await createOrganizationEmailSender(organizationId);
    const [contact] = await surveyContacts(organizationId, survey.audience, { ids: [invitation.contactId] });
    if (!contact || digest(contact.email) !== invitation.addressHash ||
      (await emailDecisions(organizationId, survey.audience, [contact])).get(contact.id) !== null) {
      await finish("SKIPPED", "The reviewed email address or contact eligibility changed.");
      return;
    }
    const links = [{ label: "Open survey", href: `${origin}${surveyPath(token, survey.audience)}` }];
    if (survey.audience === "DONOR") links.push(...await donorPreferences(organizationId, contact.email, contact.id.startsWith("list:") ? null : contact.id, origin));
    const reminder = survey.identity === "ANONYMOUS"
      ? "This is a reminder. If you already completed the survey, please disregard this message."
      : "This is a reminder that your feedback is still welcome.";
    const message = job.reminder ? `${reminder}\n\n${distribution.message}` : distribution.message;
    const { text, html: markup } = renderSurveyEmail({ message, design: survey.audience === "DONOR" ? distribution.emailDesign : null,
      appearance: survey.audience === "DONOR" ? parseDefinition(revision.definition).appearance : undefined, name: contact.name, surveyUrl: links[0].href, origin,
      preferences: links.slice(1), plain: survey.audience === "CLIENT" });
    const current = await db.surveyDeliveryJob.findFirst({ where: { id: job.id, organizationId, status: "SENDING" }, include: jobInclude });
    if (!current || !openSurvey(current.invitation.revision.survey) || current.invitation.revokedAt ||
      current.invitation.completedAt || current.invitation.expiresAt <= new Date()) {
      await finish("SKIPPED", "The survey closed or the invitation is no longer eligible.");
      return;
    }
    const currentAccess = await surveyAccess(organizationId, distribution.actorId, survey.audience);
    if (!currentAccess[survey.audience].includes("send") || !currentAccess[survey.audience].includes("view")) {
      await finish("SKIPPED", "The approving user no longer has survey sending access.");
      return;
    }
    handedToProvider = true;
    await sender.send({ to: contact.email, subject: job.reminder ? `Reminder: ${distribution.subject}` : distribution.subject, text, html: markup });
    await finish("SENT");
  } catch {
    await finish(handedToProvider ? "UNKNOWN" : "FAILED", handedToProvider
      ? "The email provider did not confirm acceptance. Review before sending again."
      : "Delivery could not start. Check the survey delivery configuration.");
  }
}

export async function processSurveyDeliveries(audience: SurveyAudience) {
  const now = new Date();
  const lane = { invitation: { revision: { survey: { audience } } } };
  await db.surveyDeliveryJob.updateMany({
    where: { ...lane, status: "SENDING", claimedAt: { lt: new Date(now.getTime() - cutoffMs) } },
    data: { status: "UNKNOWN", finishedAt: now, outcome: "Delivery was interrupted before confirmation." },
  });
  const due = await db.surveyDeliveryJob.findMany({
    where: { ...lane, status: "QUEUED", dueAt: { lte: now } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 12,
    select: { id: true, organizationId: true },
  });
  for (const job of due) await dispatch(job.id, job.organizationId);
}

export function surveyDeliveryHealth() {
  return { running: Boolean(timer), lastCompletedAt: lastCompletedAt?.toISOString() ?? null, failed };
}

export function startSurveyDeliveryWorker(audience: SurveyAudience) {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = processSurveyDeliveries(audience).then(() => { lastCompletedAt = new Date(); failed = false; }, () => {
      failed = true;
      console.error("[surveys] Delivery queue processing failed.");
    }).finally(() => { running = undefined; });
  }, 15_000);
  timer.unref();
}

export async function stopSurveyDeliveryWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  await running;
}
