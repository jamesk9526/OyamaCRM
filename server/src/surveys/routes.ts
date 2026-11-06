import { loadOrganizationBrandingContext } from "../services/organization-branding.js";
import { storeStudioImage } from "../oyama-create/studio/asset-storage.js";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Survey, SurveyAudience, SurveyIdentity } from "@prisma/client";
import { prisma as db } from "../compassion/database.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireSurveyAccess, surveyAccess, type Ability, type SurveyAccess } from "./access.js";
import { blankDefinition, boundedText, invalid, parseDefinition, record, starterTemplates, SurveyError } from "./definition.js";
import { auditSurvey, json, openSurvey, randomToken, requireProtection, surveyPath, surveyTransaction } from "./storage.js";
import { installDistributionRoutes } from "./distribution.js";
import { installReportingRoutes } from "./reporting.js";

export const surveys = Router();
surveys.use(requireAuth, (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

export const organization = (req: Request) => req.user!.orgId;
export const actor = (req: Request) => req.user!.sub;
export const accessFor = (req: Request) => surveyAccess(organization(req), actor(req), surveyLane(req.baseUrl));
export const surveyLane = (baseUrl: string): SurveyAudience => baseUrl.startsWith("/api/compassion") ? "CLIENT" : "DONOR";

export function audienceOf(value: unknown): SurveyAudience {
  if (value !== "DONOR" && value !== "CLIENT") invalid("Choose a donor or client survey.");
  return value;
}

function identityOf(value: unknown): SurveyIdentity {
  if (value !== "LINKED" && value !== "ANONYMOUS") invalid("Choose a response identity mode.");
  return value;
}

export function notFound(): never { throw new SurveyError(404, "NOT_FOUND", "Survey not found."); }

export async function authorizedSurvey(req: Request, ability: Ability, access?: SurveyAccess) {
  const organizationId = organization(req);
  const permitted = access ?? await accessFor(req);
  const visible = (["DONOR", "CLIENT"] as const).filter(value => permitted[value].includes("view"));
  const survey = await db.survey.findFirst({ where: { organizationId, id: String(req.params.id), audience: { in: visible } } });
  if (!survey) notFound();
  requireSurveyAccess(permitted, survey.audience, ability);
  return survey;
}

export function dateInput(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    invalid(`Choose a valid ${label}.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) invalid(`Choose a valid ${label}.`);
  return date;
}

const statusOf = (survey: Survey) => survey.status === "LIVE" && !openSurvey(survey) ? "CLOSED" : survey.status;
function overview(survey: Survey, responseCount?: number) {
  return {
    id: survey.id, title: parseDefinition(survey.draft).title, audience: survey.audience, identity: survey.identity,
    status: statusOf(survey), published: survey.published, closesAt: survey.closesAt, updatedAt: survey.updatedAt, responseCount,
  };
}

surveys.post("/:id/logo", async (req, res) => {
  const survey = await authorizedSurvey(req, "edit");
  if (survey.audience !== "DONOR") notFound();
  const data = boundedText(req.body?.image, "Logo image", 280000, true);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/=]+)$/i.exec(data);
  if (!match) invalid("Upload a PNG, JPEG or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 200000) invalid("Choose a logo up to 200 KB.");
  const asset = await storeStudioImage({ org: survey.organizationId, actor: actor(req), name: "Survey logo", bytes, mimeType: match[1] });
  await auditSurvey(req, "DONOR", "SURVEY_LOGO_UPLOADED", survey.id);
  res.status(201).json({ logoUrl: asset.url });
});

surveys.get("/:id/branding", async (req, res) => {
  const survey = await authorizedSurvey(req, "edit");
  if (survey.audience !== "DONOR") notFound();
  const branding = await loadOrganizationBrandingContext(survey.organizationId);
  res.json({ logoUrl: branding.logoUrl || branding.logoSquareUrl || "" });
});

surveys.get("/access", async (req, res) => { res.json(await accessFor(req)); });

surveys.get("/", async (req, res) => {
  const organizationId = organization(req);
  const audience = audienceOf(req.query.audience);
  const access = await accessFor(req);
  requireSurveyAccess(access, audience, "view");
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : "";
  const page = Math.max(1, Math.min(500, Number.parseInt(String(req.query.page || 1), 10) || 1));
  const where = { organizationId, audience, ...(query ? { draft: { path: "$.title", string_contains: query } } : {}) };
  const [rows, total] = await Promise.all([
    db.survey.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 24, take: 24 }),
    db.survey.count({ where }),
  ]);
  const counts = access[audience].includes("responses")
    ? await db.surveyRevision.findMany({ where: { organizationId, surveyId: { in: rows.map(row => row.id) } }, select: { surveyId: true, _count: { select: { responses: true } } } })
    : [];
  const bySurvey = new Map<string, number>();
  counts.forEach(row => bySurvey.set(row.surveyId, (bySurvey.get(row.surveyId) ?? 0) + row._count.responses));
  res.json({ items: rows.map(row => overview(row, access[audience].includes("responses") ? bySurvey.get(row.id) ?? 0 : undefined)), page, total });
});

surveys.get("/templates", async (req, res) => {
  const audience = audienceOf(req.query.audience);
  requireSurveyAccess(await accessFor(req), audience, "view");
  const saved = await db.surveyTemplate.findMany({ where: { organizationId: organization(req), audience }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json([...starterTemplates(audience), ...saved.map(row => ({ id: row.id, definition: parseDefinition(row.definition, true) }))]);
});

surveys.post("/", async (req, res) => {
  const body = record(req.body);
  const audience = audienceOf(body.audience);
  const identity = identityOf(body.identity);
  const organizationId = organization(req);
  requireSurveyAccess(await accessFor(req), audience, "edit");
  let definition = blankDefinition();
  if (body.templateId) {
    const id = boundedText(body.templateId, "Template", 64, true);
    const starter = starterTemplates(audience).find(template => template.id === id);
    const saved = starter ? null : await db.surveyTemplate.findFirst({ where: { id, organizationId, audience } });
    if (!starter && !saved) notFound();
    definition = starter?.definition ?? parseDefinition(saved!.definition, true);
  }
  if (body.title !== undefined) definition.title = boundedText(body.title, "Survey title", 160, true);
  const survey = await db.survey.create({ data: { organizationId, audience, identity, draft: json(definition) } });
  res.status(201).json(overview(survey));
});

surveys.get("/:id", async (req, res) => {
  const access = await accessFor(req);
  const survey = await authorizedSurvey(req, "view", access);
  const revisions = await db.surveyRevision.findMany({
    where: { organizationId: survey.organizationId, surveyId: survey.id },
    orderBy: { number: "desc" }, select: { id: true, number: true, publicKey: true, createdAt: true, definition: true },
  });
  const draft = parseDefinition(survey.draft);
  const current = revisions[0];
  res.json({
    ...overview(survey), draft, editVersion: survey.editVersion, abilities: access[survey.audience], timezone: access.timezone,
    hasUnpublishedChanges: !current || JSON.stringify(draft) !== JSON.stringify(parseDefinition(current.definition)),
    revisions: revisions.map(row => ({ id: row.id, number: row.number, createdAt: row.createdAt,
      path: row.publicKey && openSurvey(survey) && access[survey.audience].includes("send") ? surveyPath(row.publicKey, survey.audience) : null })),
  });
});

surveys.patch("/:id", async (req, res) => {
  const survey = await authorizedSurvey(req, "edit");
  const body = record(req.body);
  const draft = parseDefinition(body.definition);
  if (survey.audience === "CLIENT" && draft.appearance) invalid("Survey appearance customization is currently donor-only.");
  const identity = body.identity === undefined ? survey.identity : identityOf(body.identity);
  if (!Number.isSafeInteger(body.editVersion)) invalid("A draft version is required.");
  const saved = await surveyTransaction(survey.organizationId, survey.id, async (tx, current) => {
    if (statusOf(current) === "CLOSED" || current.status === "ARCHIVED") invalid("Duplicate this survey to edit a closed or archived survey.");
    if (current.published && identity !== current.identity) invalid("The response identity mode is locked after publication.");
    if (body.editVersion !== current.editVersion) throw new SurveyError(409, "DRAFT_CHANGED", "The survey changed. Reload it before saving.");
    return tx.survey.update({ where: { id: survey.id, organizationId: survey.organizationId },
      data: { draft: json(draft), identity, editVersion: { increment: 1 } } });
  });
  res.json({ editVersion: saved.editVersion, draft });
});

surveys.post("/:id/publish", async (req, res) => {
  const survey = await authorizedSurvey(req, "publish");
  const body = record(req.body);
  const closesAt = body.closesAt == null ? null : dateInput(body.closesAt, "closing date");
  requireProtection(survey.audience);
  const revision = await surveyTransaction(survey.organizationId, survey.id, async (tx, current) => {
    if (body.editVersion !== current.editVersion) throw new SurveyError(409, "DRAFT_CHANGED", "Save and review the current draft before publishing.");
    if (statusOf(current) === "CLOSED" || current.status === "ARCHIVED") invalid("Duplicate a closed or archived survey to publish it again.");
    if (closesAt && closesAt <= new Date()) invalid("The closing date must be in the future.");
    const definition = parseDefinition(current.draft, true);
    const previous = current.published ? await tx.surveyRevision.findUnique({
      where: { organizationId_surveyId_number: { organizationId: current.organizationId, surveyId: current.id, number: current.published } },
    }) : null;
    if (previous && JSON.stringify(parseDefinition(previous.definition)) === JSON.stringify(definition)) {
      if (closesAt?.getTime() !== current.closesAt?.getTime()) {
        await tx.survey.update({ where: { id: current.id, organizationId: current.organizationId }, data: { closesAt } });
        await auditSurvey(req, current.audience, "SURVEY_CLOSING_CHANGED", current.id, tx);
      }
      return previous;
    }
    const row = await tx.surveyRevision.create({ data: {
      organizationId: current.organizationId, surveyId: current.id, number: current.published + 1, definition: json(definition),
      publicKey: current.identity === "ANONYMOUS" ? randomToken() : null,
    } });
    await tx.survey.update({ where: { id: current.id, organizationId: current.organizationId },
      data: { status: "LIVE", published: row.number, closesAt } });
    await auditSurvey(req, current.audience, "SURVEY_PUBLISHED", current.id, tx);
    return row;
  });
  res.json({ revision: revision.number });
});

surveys.post("/:id/duplicate", async (req, res) => {
  const survey = await authorizedSurvey(req, "edit");
  const draft = parseDefinition(survey.draft);
  const row = await db.survey.create({ data: { organizationId: survey.organizationId, audience: survey.audience,
    identity: survey.identity, draft: json({ ...draft, title: `${draft.title.slice(0, 153)} (copy)` }) } });
  res.status(201).json(overview(row));
});

surveys.post("/:id/template", async (req, res) => {
  const survey = await authorizedSurvey(req, "edit");
  const definition = parseDefinition(survey.draft, true);
  const row = await db.surveyTemplate.create({ data: { organizationId: survey.organizationId, audience: survey.audience, definition: json(definition) } });
  res.status(201).json({ id: row.id });
});

for (const action of ["close", "archive"] as const) {
  surveys.post(`/:id/${action}`, async (req, res) => {
    const survey = await authorizedSurvey(req, "publish");
    await surveyTransaction(survey.organizationId, survey.id, async (tx, current) => {
      const status = action === "close" ? "CLOSED" : "ARCHIVED";
      if (current.status === status) return;
      if (action === "close" && current.status !== "LIVE") invalid("Only a live survey can be closed.");
      if (action === "archive" && openSurvey(current)) invalid("Close the survey before archiving it.");
      await tx.survey.update({ where: { id: current.id, organizationId: current.organizationId }, data: { status } });
      await tx.surveyDeliveryJob.updateMany({
        where: { organizationId: current.organizationId, status: "QUEUED", invitation: { revision: { surveyId: current.id } } },
        data: { status: "SKIPPED", finishedAt: new Date(), outcome: "Survey closed." },
      });
      await auditSurvey(req, current.audience, action === "close" ? "SURVEY_CLOSED" : "SURVEY_ARCHIVED", current.id, tx);
    });
    res.json({ ok: true });
  });
}

installDistributionRoutes(surveys);
installReportingRoutes(surveys);

surveys.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof SurveyError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  // Avoid logging query parameters or protected answer payloads.
  console.error("[surveys] Workspace request failed.");
  const schemaMissing = (error as { code?: string } | null)?.code === "P2021";
  res.status(503).json({ error: { code: schemaMissing ? "SURVEY_SCHEMA_REQUIRED" : "SURVEY_UNAVAILABLE",
    message: schemaMissing ? "Survey storage is not installed. Ask an administrator to apply the survey migration." :
      "Surveys are temporarily unavailable. Please try again." } });
});
