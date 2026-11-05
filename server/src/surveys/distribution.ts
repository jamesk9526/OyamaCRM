import { randomUUID } from "node:crypto";
import type { Router } from "express";
import type { Survey } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { describeOrganizationEmailSender } from "../services/smtp-service.js";
import { actor, authorizedSurvey, dateInput, notFound } from "./routes.js";
import { boundedText, invalid, record, SurveyError } from "./definition.js";
import { auditSurvey, digest, invitationToken, requireOpen, surveyPath, surveyTransaction } from "./storage.js";
import { emailDecisions, surveyContacts } from "./contacts.js";

const DAY = 24 * 60 * 60 * 1000;
export const MAX_RECIPIENTS = 500;

export function publicOrigin() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  try {
    const url = new URL(origin);
    if (url.username || url.password || (url.protocol !== "https:" && (process.env.NODE_ENV === "production" || url.protocol !== "http:"))) throw new Error();
    return url.origin;
  } catch {
    throw new SurveyError(503, "PUBLIC_URL_UNAVAILABLE", "Configure the public application URL before sending survey invitations.");
  }
}

function ids(input: unknown, limit: number, label: string) {
  if (!Array.isArray(input) || input.length > limit) invalid(`Select up to ${limit} ${label}.`);
  return [...new Set(input.map(value => boundedText(value, label, 64, true)))].sort();
}

function invitationExpiry(survey: Survey, sendAt: Date, days: number | null = null) {
  return new Date(Math.min(survey.closesAt?.getTime() ?? Infinity, sendAt.getTime() + (30 + (days ?? 0)) * DAY));
}

async function review(survey: Survey, actorId: string, input: Record<string, unknown>) {
  requireOpen(survey);
  const origin = publicOrigin();
  const organizationId = survey.organizationId;
  const subject = boundedText(input.subject, "Email subject", 160, true);
  if (/[\r\n\x00-\x1f]/.test(subject)) invalid("Use a single line for the subject.");
  const message = boundedText(input.message, "Email message", 3000, true);
  const scheduledAt = input.sendAt == null ? null : dateInput(input.sendAt, "send time");
  const sendAt = scheduledAt ?? new Date();
  if (scheduledAt && scheduledAt.getTime() < Date.now()) invalid("Schedule a future send time or choose Send now.");
  if (survey.closesAt && sendAt >= survey.closesAt) invalid("Send invitations before the survey closes.");
  const reminderDays = input.reminderDays == null ? null : input.reminderDays as number;
  if (reminderDays !== null && (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 30)) invalid("Set the reminder between 1 and 30 days.");
  if (reminderDays && survey.closesAt && sendAt.getTime() + reminderDays * DAY >= survey.closesAt.getTime()) {
    invalid("Schedule the reminder before the survey closes.");
  }
  const requested = ids(input.contactIds ?? [], MAX_RECIPIENTS, "contacts");
  const listIds = ids(input.listIds ?? [], 10, "saved donor lists");
  if (survey.audience === "CLIENT" && listIds.length) invalid("Choose recipients from Compassion client records.");
  const lists = listIds.length ? await db.emailRecipientList.findMany({
    where: { organizationId, id: { in: listIds } },
    select: { id: true, recipients: { select: { constituentId: true }, take: MAX_RECIPIENTS + 1 } },
  }) : [];
  if (lists.length !== listIds.length) invalid("A selected donor list is no longer available.");
  if (lists.some(list => list.recipients.length > MAX_RECIPIENTS)) invalid("Select lists with up to 500 entries.");
  const entries = lists.flatMap(list => list.recipients);
  const unlinkedEntries = entries.filter(row => !row.constituentId).length;
  const contactIds = [...new Set([...requested, ...entries.flatMap(row => row.constituentId ? [row.constituentId] : [])])];
  if (contactIds.length > MAX_RECIPIENTS) invalid("Select up to 500 distinct recipients per batch.");
  const revision = await db.surveyRevision.findUniqueOrThrow({
    where: { organizationId_surveyId_number: { organizationId, surveyId: survey.id, number: survey.published } },
    select: { id: true, number: true },
  });
  const [contacts, prior, sender] = await Promise.all([
    surveyContacts(organizationId, survey.audience, { ids: contactIds }),
    db.surveyInvitation.findMany({ where: { organizationId, revisionId: revision.id },
      select: { contactId: true, addressHash: true } }),
    describeOrganizationEmailSender(organizationId),
  ]);
  const decisions = await emailDecisions(organizationId, survey.audience, contacts);
  const used = new Set(prior.map(row => row.contactId));
  const usedAddresses = new Set(prior.map(row => row.addressHash));
  const rows = contacts.map(contact => {
    const reason = used.has(contact.id) || usedAddresses.has(digest(contact.email))
      ? "This recipient already has an invitation for this revision."
      : decisions.get(contact.id) ?? "Email eligibility could not be verified.";
    // An explicitly null decision means the recipient passed the eligibility policy.
    const excluded = !used.has(contact.id) && !usedAddresses.has(digest(contact.email)) && decisions.get(contact.id) === null
      ? null : reason;
    return { id: contact.id, name: contact.name, email: contact.email, excluded };
  });
  const missing = contactIds.length - contacts.length;
  const ready = rows.filter(row => row.excluded === null);
  const reviewHash = digest(JSON.stringify({ organizationId, actorId, revision, sender, origin,
    subject, message, sendAt: scheduledAt, reminderDays, closesAt: survey.closesAt, rows, missing, unlinkedEntries }));
  return { rows, ready, missing, unlinkedEntries, revision, reviewHash, sender, origin, subject, message,
    sendAt, scheduledAt, reminderDays, closesAt: survey.closesAt, identity: survey.identity };
}

export function installDistributionRoutes(router: Router) {
  router.get("/:id/contacts", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const contacts = await surveyContacts(survey.organizationId, survey.audience, { q });
    res.json(contacts.map(({ id, name, email }) => ({ id, name, email })));
  });
  router.get("/:id/lists", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    if (survey.audience !== "DONOR") notFound();
    res.json(await db.emailRecipientList.findMany({ where: { organizationId: survey.organizationId },
      orderBy: { name: "asc" }, select: { id: true, name: true }, take: 100 }));
  });

  router.post("/:id/personal-link", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    if (survey.identity !== "LINKED") invalid("Anonymous surveys use a shared link.");
    const contactId = boundedText(req.body?.contactId, "Contact", 64, true);
    const [contact] = await surveyContacts(survey.organizationId, survey.audience, { ids: [contactId] });
    if (!contact) notFound();
    if (contact.doNotContact) invalid("This contact is marked do not contact.");
    const path = await surveyTransaction(survey.organizationId, survey.id, async (tx, current) => {
      requireOpen(current);
      const organizationId = current.organizationId;
      const revision = await tx.surveyRevision.findUniqueOrThrow({
        where: { organizationId_surveyId_number: { organizationId, surveyId: current.id, number: current.published } },
      });
      const existing = await tx.surveyInvitation.findUnique({
        where: { organizationId_revisionId_contactId: { organizationId, revisionId: revision.id, contactId } },
      });
      if (existing?.completedAt || existing?.revokedAt) invalid("This contact already completed the survey or their link was revoked.");
      const id = existing?.id ?? randomUUID();
      const token = invitationToken(id);
      const tokenHash = digest(token);
      const expiresAt = invitationExpiry(current, new Date());
      if (!existing) {
        await tx.surveyInvitation.create({ data: { id, organizationId, revisionId: revision.id, contactId, tokenHash, expiresAt } });
        await auditSurvey(req, current.audience, "SURVEY_LINK_CREATED", current.id, tx);
      } else if (existing.expiresAt <= new Date() || existing.tokenHash !== tokenHash) {
        await tx.surveyInvitation.update({ where: { id, organizationId }, data: { tokenHash, expiresAt } });
        await auditSurvey(req, current.audience, "SURVEY_LINK_REISSUED", current.id, tx);
      }
      return surveyPath(token, current.audience);
    });
    res.json({ path });
  });

  router.post("/:id/distributions/review", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    const reviewed = await review(survey, actor(req), record(req.body));
    res.json({ ...reviewed, ready: reviewed.ready.length });
  });

  router.post("/:id/distributions", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    const body = record(req.body);
    const organizationId = survey.organizationId;
    const actorId = actor(req);
    const requestKey = boundedText(body.requestKey, "Request key", 64, true);
    const reviewHash = boundedText(body.reviewHash, "Review key", 64, true);
    const requestHash = digest(JSON.stringify({ contactIds: ids(body.contactIds ?? [], MAX_RECIPIENTS, "contacts"),
      listIds: ids(body.listIds ?? [], 10, "saved donor lists"),
      subject: body.subject, message: body.message, sendAt: body.sendAt ?? null, reminderDays: body.reminderDays ?? null, reviewHash }));
    const saved = await surveyTransaction(organizationId, survey.id, async (tx, current) => {
      const prior = await tx.surveyDistribution.findUnique({
        where: { organizationId_requestKey: { organizationId, requestKey } }, include: { revision: { select: { surveyId: true } } },
      });
      if (prior) {
        if (prior.revision.surveyId !== current.id || prior.actorId !== actorId || prior.requestHash !== requestHash) {
          throw new SurveyError(409, "REQUEST_CONFLICT", "This request key belongs to a different distribution.");
        }
        return prior;
      }
      const checked = await review(current, actorId, body);
      if (checked.reviewHash !== reviewHash) throw new SurveyError(409, "REVIEW_CHANGED", "Recipients, sender, or survey settings changed. Review the distribution again.");
      if (!checked.sender) invalid("Configure the organization email sender first.");
      if (!checked.ready.length) invalid("Select at least one eligible recipient.");
      const distribution = await tx.surveyDistribution.create({ data: { organizationId, actorId, requestKey, requestHash, reviewHash,
        revisionId: checked.revision.id, subject: checked.subject, message: checked.message, sender: checked.sender, origin: checked.origin,
        sendAt: checked.sendAt, reminderDays: checked.reminderDays } });
      const invitations = checked.ready.map(row => {
        const id = randomUUID();
        return { id, organizationId, revisionId: checked.revision.id, distributionId: distribution.id, contactId: row.id,
          addressHash: digest(row.email), tokenHash: current.identity === "LINKED" ? digest(invitationToken(id)) : null,
          expiresAt: invitationExpiry(current, checked.sendAt, checked.reminderDays) };
      });
      await tx.surveyInvitation.createMany({ data: invitations });
      await tx.surveyDeliveryJob.createMany({ data: invitations.flatMap(({ id }) => {
        const first = { organizationId, invitationId: id, reminder: false, dueAt: checked.sendAt };
        return checked.reminderDays ? [first, { ...first, reminder: true, dueAt: new Date(checked.sendAt.getTime() + checked.reminderDays * DAY) }] : [first];
      }) });
      await auditSurvey(req, current.audience, "SURVEY_DISTRIBUTION_QUEUED", current.id, tx);
      return distribution;
    });
    res.status(202).json({ id: saved.id });
  });

  router.get("/:id/distributions", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    const batches = await db.surveyDistribution.findMany({
      where: { organizationId: survey.organizationId, revision: { surveyId: survey.id } }, orderBy: { createdAt: "desc" }, take: 25,
      include: { revision: { select: { number: true } }, invitations: { select: { jobs: { select: { status: true, reminder: true } } } } },
    });
    res.json(batches.map(row => {
      const counts: Record<string, number> = {};
      row.invitations.flatMap(invite => invite.jobs).forEach(job => { counts[job.status] = (counts[job.status] ?? 0) + 1; });
      return { id: row.id, revision: row.revision.number, subject: row.subject, sendAt: row.sendAt,
        recipients: row.invitations.length, reminderDays: row.reminderDays, counts };
    }));
  });

  router.get("/:id/invitations", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    if (survey.identity === "ANONYMOUS") return res.json([]);
    const rows = await db.surveyInvitation.findMany({ where: { organizationId: survey.organizationId, revision: { surveyId: survey.id } },
      orderBy: { createdAt: "desc" }, take: 100, select: { id: true, contactId: true, expiresAt: true, revokedAt: true, completedAt: true,
        revision: { select: { number: true } }, jobs: { select: { status: true, reminder: true, outcome: true } } } });
    const contacts = await surveyContacts(survey.organizationId, survey.audience, { ids: [...new Set(rows.map(row => row.contactId))] });
    const names = new Map(contacts.map(row => [row.id, row.name]));
    res.json(rows.map(row => ({ ...row, name: names.get(row.contactId) ?? "Unavailable record" })));
  });

  router.post("/:id/invitations/:invitationId/revoke", async (req, res) => {
    const survey = await authorizedSurvey(req, "send");
    if (survey.identity !== "LINKED") notFound();
    await surveyTransaction(survey.organizationId, survey.id, async (tx, current) => {
      const invitation = await tx.surveyInvitation.findFirst({ where: { organizationId: current.organizationId,
        id: String(req.params.invitationId), revision: { surveyId: current.id } } });
      if (!invitation) notFound();
      if (invitation.completedAt) invalid("A completed invitation cannot be revoked.");
      if (invitation.revokedAt) return;
      await tx.surveyInvitation.update({ where: { id: invitation.id, organizationId: current.organizationId }, data: { revokedAt: new Date() } });
      await tx.surveyDeliveryJob.updateMany({ where: { organizationId: current.organizationId, invitationId: invitation.id, status: "QUEUED" },
        data: { status: "SKIPPED", finishedAt: new Date(), outcome: "Invitation revoked." } });
      await auditSurvey(req, current.audience, "SURVEY_LINK_REVOKED", current.id, tx);
    });
    res.json({ ok: true });
  });
}
