import type { Router } from "express";
import type { Prisma, Survey } from "@prisma/client";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma as db } from "../compassion/database.js";
import { requireSurveyAccess } from "./access.js";
import { invalid, owns, parseDefinition, type Answer, type Definition } from "./definition.js";
import { accessFor, audienceOf, authorizedSurvey, dateInput, notFound, organization } from "./routes.js";
import { auditSurvey, readAnswers, requireProtection } from "./storage.js";
import { surveyContacts } from "./contacts.js";

function pageOf(value: unknown) { return Math.min(1000, Math.max(1, Number.parseInt(String(value ?? 1), 10) || 1)); }

async function reportScope(survey: Survey, query: Record<string, unknown>) {
  const revisionId = typeof query.revision === "string" ? query.revision : "";
  const revision = await db.surveyRevision.findFirst({ where: {
    organizationId: survey.organizationId, surveyId: survey.id,
    ...(revisionId ? { id: revisionId } : { number: survey.published }),
  } });
  if (!revision) notFound();
  const from = query.from ? dateInput(query.from, "start date") : undefined;
  const to = query.to ? dateInput(query.to, "end date") : undefined;
  if (from && to && from >= to) invalid("The end date must be after the start date.");
  const where: Prisma.SurveyResponseWhereInput = {
    organizationId: survey.organizationId, revisionId: revision.id,
    ...((from || to) ? { createdAt: { gte: from, lt: to } } : {}),
  };
  return { where, revision, definition: parseDefinition(revision.definition, true), dated: Boolean(from || to) };
}

async function* responseRows(where: Prisma.SurveyResponseWhereInput) {
  let after: string | undefined;
  for (;;) {
    const rows = await db.surveyResponse.findMany({ where: { ...where, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" }, take: 250 });
    yield* rows;
    if (rows.length < 250) return;
    after = rows[rows.length - 1].id;
  }
}

export function responseSummary(definition: Definition) {
  const questions = definition.sections.flatMap(section => section.questions);
  const entries = questions.map(question => ({
    question, answered: 0, total: 0, promoters: 0, detractors: 0,
    distribution: new Map<string, number>(
      (question.type === "boolean" ? ["Yes", "No"] :
        question.type === "rating" ? ["1", "2", "3", "4", "5"] :
        question.type === "nps" ? Array.from({ length: 11 }, (_, n) => String(n)) : question.options).map(value => [value, 0])),
  }));
  return {
    add(answers: Record<string, Answer>) {
      for (const item of entries) {
        const value = answers[item.question.id];
        if (value === undefined) continue;
        item.answered++;
        if (typeof value === "number") {
          item.total += value;
          if (value >= 9) item.promoters++;
          if (value <= 6) item.detractors++;
        }
        for (const choice of Array.isArray(value) ? value : [value]) {
          const label = choice === true ? "Yes" : choice === false ? "No" : String(choice);
          if (item.distribution.has(label)) item.distribution.set(label, (item.distribution.get(label) ?? 0) + 1);
        }
      }
    },
    values() {
      return entries.map(({ question, answered, total, promoters, detractors, distribution }) => ({
        id: question.id, title: question.title, type: question.type, answered,
        average: answered && ["number", "rating"].includes(question.type) ? total / answered : null,
        nps: answered && question.type === "nps" ? Math.round(100 * (promoters - detractors) / answered) : null,
        distribution: Array.from(distribution, ([label, count]) => ({ label, count, percentage: answered ? 100 * count / answered : 0 })),
      }));
    },
  };
}

export function surveyCsvCell(input: string) {
  const value = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(input) ? `'${input}` : input;
  return `"${value.replace(/"/g, '""')}"`;
}

export function installReportingRoutes(router: Router) {
  router.get("/records/:audience/:contactId/history", async (req, res) => {
    const audience = audienceOf(req.params.audience);
    const organizationId = organization(req);
    const contactId = String(req.params.contactId);
    requireSurveyAccess(await accessFor(req), audience, "responses");
    if (!(await surveyContacts(organizationId, audience, { ids: [contactId] })).length) notFound();
    const rows = await db.surveyResponse.findMany({
      where: { organizationId, ...(audience === "DONOR" ? { donorId: contactId } : { clientId: contactId }),
        revision: { survey: { organizationId, audience, identity: "LINKED" } } },
      include: { revision: { select: { id: true, definition: true, number: true, surveyId: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    res.json(rows.map(row => ({ id: row.id, revisionId: row.revision.id, revision: row.revision.number,
      surveyId: row.revision.surveyId, title: parseDefinition(row.revision.definition).title, submittedAt: row.createdAt })));
  });

  router.get("/:id/summary", async (req, res) => {
    const survey = await authorizedSurvey(req, "responses");
    requireProtection(survey.audience);
    const { where, revision, definition, dated } = await reportScope(survey, req.query);
    const aggregate = responseSummary(definition);
    let completed = 0;
    const cutoff = new Date();
    for await (const row of responseRows({ ...where, createdAt: { ...(where.createdAt as Prisma.DateTimeFilter | undefined), lte: cutoff } })) {
      aggregate.add(readAnswers(survey.audience, row));
      completed++;
    }
    let invitationStats = null;
    if (survey.identity === "LINKED" && !dated) {
      const invitedWhere: Prisma.SurveyInvitationWhereInput = {
        organizationId: survey.organizationId, revisionId: revision.id,
        OR: [{ distributionId: null }, { completedAt: { not: null } }, { jobs: { some: { reminder: false, status: "SENT" } } }],
      };
      const [invited, linkedCompleted] = await Promise.all([
        db.surveyInvitation.count({ where: invitedWhere }),
        db.surveyInvitation.count({ where: { ...invitedWhere, completedAt: { not: null } } }),
      ]);
      invitationStats = { invited, completed: linkedCompleted, percentage: invited ? 100 * linkedCompleted / invited : null };
    }
    res.json({ completed, invitationStats, questions: aggregate.values() });
  });

  router.get("/:id/responses", async (req, res) => {
    const survey = await authorizedSurvey(req, "responses");
    const { where } = await reportScope(survey, req.query);
    const page = pageOf(req.query.page);
    const [rows, total] = await Promise.all([
      db.surveyResponse.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25,
        select: { id: true, donorId: true, clientId: true, createdAt: true } }),
      db.surveyResponse.count({ where }),
    ]);
    const contactIds = [...new Set(rows.flatMap(row => row.donorId || row.clientId ? [row.donorId || row.clientId!] : []))];
    const contacts = await surveyContacts(survey.organizationId, survey.audience, { ids: contactIds });
    const names = new Map(contacts.map(row => [row.id, row.name]));
    res.json({ items: rows.map(row => {
      const contactId = row.donorId || row.clientId;
      return { id: row.id, createdAt: row.createdAt, name: contactId ? names.get(contactId) ?? "Unavailable record" : "Anonymous response",
        contactId: contactId && names.has(contactId) ? contactId : null };
    }), page, total });
  });

  router.get("/:id/responses/:responseId", async (req, res) => {
    const survey = await authorizedSurvey(req, "responses");
    const row = await db.surveyResponse.findFirst({ where: { id: String(req.params.responseId), organizationId: survey.organizationId,
      revision: { surveyId: survey.id } }, include: { revision: { select: { definition: true, number: true } } } });
    if (!row) notFound();
    const answers = readAnswers(survey.audience, row);
    const definition = parseDefinition(row.revision.definition);
    const contactId = row.donorId || row.clientId;
    const [contact] = contactId ? await surveyContacts(survey.organizationId, survey.audience, { ids: [contactId] }) : [];
    if (survey.audience === "CLIENT") await auditSurvey(req, survey.audience, "SURVEY_RESPONSE_VIEWED", row.id);
    res.json({ id: row.id, createdAt: row.createdAt, revision: row.revision.number, title: definition.title,
      name: contact?.name ?? (contactId ? "Unavailable record" : "Anonymous response"), contactId: contact?.id ?? null,
      answers: definition.sections.flatMap(section => section.questions).filter(question => owns(answers, question.id))
        .map(question => ({ id: question.id, title: question.title, value: answers[question.id] })) });
  });

  router.get("/:id/export.csv", async (req, res) => {
    const access = await accessFor(req);
    const survey = await authorizedSurvey(req, "export", access);
    requireSurveyAccess(access, survey.audience, "responses");
    requireProtection(survey.audience);
    const { where, revision, definition } = await reportScope(survey, req.query);
    const questions = definition.sections.flatMap(section => section.questions);
    await auditSurvey(req, survey.audience, "SURVEY_RESPONSES_EXPORTED", survey.id);
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="survey-responses-v${revision.number}.csv"` });
    async function* csv() {
      const line = (cells: string[]) => cells.map(surveyCsvCell).join(",") + "\r\n";
      const linked = survey.identity === "LINKED";
      yield "\uFEFF" + line(["Response ID", "Revision", "Submitted at (UTC)", ...(linked ? ["CRM record ID"] : []), ...questions.map(q => q.title)]);
      for await (const row of responseRows(where)) {
        const answers = readAnswers(survey.audience, row);
        yield line([row.id, String(revision.number), row.createdAt.toISOString(), ...(linked ? [row.donorId ?? row.clientId ?? ""] : []),
          ...questions.map(q => {
            const answer = answers[q.id];
            return Array.isArray(answer) ? JSON.stringify(answer) : String(answer ?? "");
          })]);
      }
    }
    await pipeline(Readable.from(csv()), res);
  });
}
