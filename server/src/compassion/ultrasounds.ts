import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "./database.js";
import { audit, org, unseal } from "./security.js";
import { CareError, check, client, date, route, text } from "./http.js";
import { hasActiveCaseworkAccount, OPEN_CARE_TASK_STATUSES } from "./care-team.js";

export const ultrasoundRoutes = Router();

ultrasoundRoutes.get("/ultrasounds/summary", ...route("clinical", async (req, res) => {
  const [groups, openFollowUps, overdueFollowUps] = await Promise.all([
    prisma.compassionChart.groupBy({ by: ["status"], where: { organizationId: org(req), kind: "ULTRASOUND" }, _count: { _all: true } }),
    prisma.compassionFollowUp.count({ where: { organizationId: org(req), chartId: { not: null }, status: { in: [...OPEN_CARE_TASK_STATUSES] } } }),
    prisma.compassionFollowUp.count({ where: { organizationId: org(req), chartId: { not: null }, OR: [{ status: "OVERDUE" }, { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lt: new Date() } }] } }),
  ]);
  const counts = { DRAFT: 0, REVIEW: 0, SIGNED: 0 };
  for (const group of groups) if (group.status in counts) counts[group.status as keyof typeof counts] = group._count._all;
  await audit(req, "ULTRASOUND_SUMMARY_READ");
  res.json({ ...counts, openFollowUps, overdueFollowUps });
}));

ultrasoundRoutes.get("/clinical-team", ...route("clinical", async (req, res) => {
  const memberships = await prisma.compassionMembership.findMany({ where: { organizationId: org(req), active: true, role: { in: ["ADMIN", "CASEWORKER", "CLINICIAN", "PHYSICIAN"] } }, select: { userId: true } });
  res.json(await prisma.user.findMany({ where: { organizationId: org(req), active: true, id: { in: memberships.map((member) => member.userId) } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500 }));
}));

ultrasoundRoutes.get("/ultrasounds", ...route("clinical", async (req, res) => {
  const clientId = req.query.clientId ? text(req.query.clientId, 191) : undefined;
  if (clientId) await client(req, clientId);
  const search = req.query.search ? text(req.query.search, 100) : "";
  const status = req.query.status ? text(req.query.status, 20) : "";
  check(!status || ["DRAFT", "REVIEW", "SIGNED"].includes(status), "Choose an ultrasound chart status.");
  const page = Number(req.query.page ?? 1);
  check(Number.isSafeInteger(page) && page >= 1 && page <= 100000, "Choose a valid page.");
  const pageSize = 25;
  // Resolve names through the tenant-scoped directory, never by decrypting clinical findings.
  const matches = search ? await prisma.compassionClient.findMany({
    where: { organizationId: org(req), ...(clientId ? { id: clientId } : {}), ...(search ? {
      AND: search.split(/\s+/).map((part) => ({ OR: [{ firstName: { contains: part } }, { lastName: { contains: part } }] })),
    } : {}) },
    select: { id: true, firstName: true, lastName: true },
    take: 501,
  }) : [];
  check(matches.length <= 500, "Narrow the client search to fewer matching names.");
  const scope: Prisma.CompassionChartWhereInput = { organizationId: org(req), kind: "ULTRASOUND", ...(clientId ? { clientId } : {}), ...(search ? { clientId: { in: matches.map((patient) => patient.id) } } : {}) };
  const where = { ...scope, ...(status ? { status } : {}) };
  const [charts, total, groups] = await Promise.all([
    prisma.compassionChart.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: pageSize, skip: (page - 1) * pageSize }),
    prisma.compassionChart.count({ where }),
    prisma.compassionChart.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ]);
  const content = new Map(charts.map((chart) => [chart.id, JSON.parse(unseal(chart.encryptedContent, `${org(req)}:${chart.clientId}:chart`)) as Record<string, unknown>]));
  const ids = charts.map((chart) => chart.id);
  const patients = search ? matches : await prisma.compassionClient.findMany({ where: { organizationId: org(req), id: { in: charts.map((chart) => chart.clientId) } }, select: { id: true, firstName: true, lastName: true } });
  const appointmentIds = charts.flatMap((chart) => typeof content.get(chart.id)?.appointmentId === "string" ? [content.get(chart.id)!.appointmentId as string] : []);
  const [documents, followUps, appointments] = await Promise.all([
    prisma.compassionDocument.groupBy({ by: ["chartId", "clientId"], where: { organizationId: org(req), chartId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
    prisma.compassionFollowUp.findMany({ where: { organizationId: org(req), chartId: { in: ids } }, select: { id: true, chartId: true, clientId: true, dueDate: true, status: true, priority: true }, orderBy: { dueDate: "asc" } }),
    prisma.compassionAppointment.findMany({ where: { organizationId: org(req), id: { in: appointmentIds } }, select: { id: true, clientId: true, startTime: true, status: true, location: true } }),
  ]);
  const counts = { DRAFT: 0, REVIEW: 0, SIGNED: 0 };
  for (const group of groups) if (group.status in counts) counts[group.status as keyof typeof counts] = group._count._all;
  await audit(req, "ULTRASOUND_WORKLIST_READ", clientId);
  res.json({ items: charts.map((chart) => {
    const values = content.get(chart.id)!;
    return {
      id: chart.id, clientId: chart.clientId, authorId: chart.authorId, status: chart.status, version: chart.version, createdAt: chart.createdAt, updatedAt: chart.updatedAt,
      client: patients.find((patient) => patient.id === chart.clientId) ?? { id: chart.clientId, firstName: "Client", lastName: "unavailable" },
      examDate: typeof values.examDate === "string" ? values.examDate : "",
      examType: typeof values.examType === "string" ? values.examType : "",
      performedBy: typeof values.performedBy === "string" ? values.performedBy : "",
      attachmentCount: documents.find((group) => group.chartId === chart.id && group.clientId === chart.clientId)?._count._all ?? 0,
      appointment: appointments.find((appointment) => appointment.id === values.appointmentId && appointment.clientId === chart.clientId) ?? null,
      followUps: followUps.filter((followUp) => followUp.chartId === chart.id && followUp.clientId === chart.clientId).map(({ chartId, clientId, ...fields }) => { void chartId; void clientId; return fields; }),
    };
  }), total, page, pageSize, counts });
}));

ultrasoundRoutes.post("/ultrasounds/:id/follow-ups", ...route("clinical", async (req, res) => {
  const chart = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req), kind: "ULTRASOUND" } });
  if (!chart) throw new CareError(404, "NOT_FOUND", "Ultrasound chart not found.");
  await client(req, chart.clientId);
  check(req.body?.approve === true, "Review and confirm this care follow-up.");
  const dueDate = date(req.body.dueDate);
  const priority = req.body.priority ?? "MEDIUM";
  check(["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority), "Choose a follow-up priority.");
  const assignedStaffId = req.body.assignedStaffId ? text(req.body.assignedStaffId, 191) : null;
  if (assignedStaffId) {
    check(await hasActiveCaseworkAccount(org(req), assignedStaffId), "Select an active care-team account with casework access.");
  }
  const existing = await prisma.compassionFollowUp.findFirst({ where: { organizationId: org(req), chartId: chart.id, status: { in: [...OPEN_CARE_TASK_STATUSES] } } });
  if (existing) throw new CareError(409, "FOLLOW_UP_EXISTS", "This exam already has an open care follow-up. Manage it in the follow-up queue.");
  const row = await prisma.compassionFollowUp.create({ data: { organizationId: org(req), clientId: chart.clientId, chartId: chart.id, title: "Client-care follow-up", dueDate, priority, assignedStaffId } });
  await audit(req, "ULTRASOUND_FOLLOW_UP_CREATED", row.id, { chartId: chart.id });
  res.status(201).json({ id: row.id, dueDate: row.dueDate, status: row.status });
}));
