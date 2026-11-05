import { randomUUID } from "node:crypto";
import { json as parseJson, Router } from "express";
import rateLimit from "express-rate-limit";
import type { SurveyAudience } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { evaluateAnswers, invalid, parseDefinition, record, SurveyError, type Answers } from "./definition.js";
import { digest, encodeAnswers, readAnswers, requireOpen, surveyTransaction, tokenPattern } from "./storage.js";
import { surveyLane } from "./routes.js";

export const publicSurveys = Router();
publicSurveys.use((_req, res, next) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" });
  next();
});
publicSurveys.use(rateLimit({
  windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Please wait a minute before trying again." } },
}));
publicSurveys.use(parseJson({ limit: "512kb" }));

function missing() { return new SurveyError(404, "NOT_FOUND", "This survey link is unavailable."); }

async function lookup(token: unknown, audience: SurveyAudience) {
  if (typeof token !== "string" || !tokenPattern.test(token)) throw missing();
  const invitation = await db.surveyInvitation.findFirst({
    where: { tokenHash: digest(token), revision: { survey: { audience, identity: "LINKED" } } },
    include: { revision: { include: { survey: true } } },
  });
  if (invitation?.revision.survey.identity === "LINKED") {
    if (invitation.revokedAt || invitation.expiresAt <= new Date()) throw missing();
    return { invitation, revision: invitation.revision };
  }
  const revision = await db.surveyRevision.findFirst({ where: { publicKey: token, survey: { audience, identity: "ANONYMOUS" } }, include: { survey: true } });
  if (!revision || revision.survey.identity !== "ANONYMOUS") throw missing();
  return { invitation: null, revision };
}

publicSurveys.post("/form", async (req, res) => {
  const { invitation, revision } = await lookup(req.body?.token, surveyLane(req.baseUrl));
  const survey = revision.survey;
  if (!invitation?.completedAt) requireOpen(survey);
  const organization = await db.organization.findUnique({ where: { id: survey.organizationId }, select: { name: true } });
  res.json({
    definition: parseDefinition(revision.definition, true), identity: survey.identity,
    organization: organization?.name ?? "Survey", completed: Boolean(invitation?.completedAt),
  });
});

publicSurveys.post("/responses", async (req, res) => {
  const body = record(req.body);
  const { invitation, revision } = await lookup(body.token, surveyLane(req.baseUrl));
  if (typeof body.submissionKey !== "string" || !/^[a-f0-9-]{36}$/i.test(body.submissionKey)) invalid("A submission key is required.");
  const submissionKey = digest(body.submissionKey.toLowerCase());
  const supplied = record(body.answers);
  if (Object.keys(supplied).length > 60) invalid("Too many answers.");
  const { answers, errors } = evaluateAnswers(parseDefinition(revision.definition, true), supplied as Answers);
  if (Object.keys(errors).length) {
    res.status(422).json({ error: { code: "INVALID_ANSWERS", message: "Review your answers and try again.", fields: errors } });
    return;
  }
  const { organizationId, surveyId } = revision;
  const created = await surveyTransaction(organizationId, surveyId, async (tx, survey) => {
    const existing = await tx.surveyResponse.findUnique({
      where: { organizationId_revisionId_submissionKey: { organizationId, revisionId: revision.id, submissionKey } },
      select: { invitationId: true, organizationId: true, revisionId: true, id: true, payload: true },
    });
    if (existing) {
      if (existing.invitationId === (invitation?.id ?? null) &&
        JSON.stringify(readAnswers(survey.audience, existing)) === JSON.stringify(answers)) return false;
      throw new SurveyError(409, "SUBMISSION_CONFLICT", "This submission key was already used.");
    }
    requireOpen(survey);
    let contactId: string | null = null;
    if (invitation) {
      const current = await tx.surveyInvitation.findFirst({ where: { organizationId, id: invitation.id } });
      if (!current || current.revokedAt || current.expiresAt <= new Date()) throw missing();
      if (current.completedAt) throw new SurveyError(409, "ALREADY_COMPLETED", "This invitation has already been completed.");
      contactId = current.contactId;
      await tx.surveyInvitation.update({ where: { id: current.id, organizationId }, data: { completedAt: new Date() } });
    }
    const id = randomUUID();
    await tx.surveyResponse.create({ data: {
      id, organizationId, revisionId: revision.id, invitationId: invitation?.id, submissionKey,
      donorId: survey.audience === "DONOR" ? contactId : null,
      clientId: survey.audience === "CLIENT" ? contactId : null,
      payload: encodeAnswers(survey.audience, organizationId, revision.id, id, answers),
    } });
    return true;
  });
  res.status(created ? 201 : 200).json({ completed: true });
});

publicSurveys.use((error: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (res.headersSent) return next(new Error("Survey response interrupted."));
  if (error instanceof SurveyError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  const type = (error as { type?: string } | null)?.type;
  if (type === "entity.too.large" || type === "entity.parse.failed") {
    const size = type === "entity.too.large";
    res.status(size ? 413 : 400).json({ error: { code: "INVALID_REQUEST", message: size ? "This response is too large." : "The survey request could not be read." } });
    return;
  }
  // Database errors can contain answer values or bearer tokens.
  console.error("[surveys] Public form request failed.");
  res.status(503).json({ error: { code: "SURVEY_UNAVAILABLE", message: "This survey is temporarily unavailable. Please try again." } });
});
