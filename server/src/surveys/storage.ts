import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Prisma, Survey, SurveyAudience } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { audit as careAudit, encryptionReady, seal, unseal } from "../compassion/security.js";
import type { Request } from "express";
import { SurveyError, type Answers } from "./definition.js";

export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const json = (value: object) => value as Prisma.InputJsonValue;

export function invitationToken(id: string) {
  const secret = process.env.SURVEY_LINK_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new SurveyError(503, "LINKS_UNAVAILABLE", "Configure the survey link signing secret before creating personal links.");
  }
  return createHmac("sha256", secret || "local-oyama-survey-development-only")
    .update(`oyama-survey-invitation:${id}`).digest("base64url");
}

export const surveyPath = (token: string, audience: SurveyAudience) => `/s/respond#${audience === "CLIENT" ? "c" : "d"}.${token}`;

export function openSurvey(survey: Pick<Survey, "status" | "closesAt">, now = new Date()) {
  return survey.status === "LIVE" && (!survey.closesAt || survey.closesAt > now);
}

export function requireOpen(survey: Pick<Survey, "status" | "closesAt">) {
  if (!openSurvey(survey)) throw new SurveyError(410, "SURVEY_CLOSED", "This survey is closed.");
}

export function requireProtection(audience: SurveyAudience) {
  if (audience === "CLIENT" && !encryptionReady()) {
    throw new SurveyError(503, "PROTECTION_UNAVAILABLE", "Protected client feedback storage is not configured.");
  }
}

export function encodeAnswers(audience: SurveyAudience, org: string, revision: string, id: string, answers: Answers) {
  requireProtection(audience);
  const value = JSON.stringify(answers);
  return audience === "CLIENT" ? seal(value, `survey:${org}:${revision}:${id}`) : value;
}

export function readAnswers(audience: SurveyAudience, row: { organizationId: string; revisionId: string; id: string; payload: string }): Answers {
  requireProtection(audience);
  return JSON.parse(audience === "CLIENT"
    ? unseal(row.payload, `survey:${row.organizationId}:${row.revisionId}:${row.id}`)
    : row.payload) as Answers;
}

/** Serialize publishing, closing, invitations and submission against the same survey row. */
export async function surveyTransaction<T>(organizationId: string, surveyId: string, run: (tx: Prisma.TransactionClient, survey: Survey) => Promise<T>) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Survey WHERE organizationId = ${organizationId} AND id = ${surveyId} FOR UPDATE`;
    const survey = await tx.survey.findUnique({ where: { organizationId_id: { organizationId, id: surveyId } } });
    if (!survey) throw new SurveyError(404, "NOT_FOUND", "Survey not found.");
    return run(tx, survey);
  }, { timeout: 15_000 });
}

export async function auditSurvey(req: Request, audience: SurveyAudience, action: string, id: string, tx: Prisma.TransactionClient = db) {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  if (audience === "CLIENT") {
    if (tx === db) await careAudit(req, action, id);
    else await tx.compassionAudit.create({ data: { organizationId, actorId: userId, action, entityId: id } });
  } else {
    await tx.auditLog.create({ data: { organizationId, userId, action, entity: "Survey", entityId: id } });
  }
}
