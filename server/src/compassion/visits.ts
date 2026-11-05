import { Router } from "express";
import { CompassionServiceType } from "@prisma/client";
import { prisma } from "./database.js";
import { audit, org, seal, unseal, hasCareCapability } from "./security.js";
import { check, client, route, text, integer, CareError } from "./http.js";
import { careLinks } from "./paper-forms.js";
import { calendarMonth, CENTER_COLUMNS, csvCell, type CenterDefinition, type VisitFacts } from "./visit-fields.js";

export const visitRoutes = Router(); const router = visitRoutes;
const patientProjection = { id: true, firstName: true, lastName: true };
router.get("/visits", ...route("casework", async (req, res) => {
  const clientId = text(req.query.clientId, 191); await client(req, clientId);
  const rows = await prisma.compassionVisit.findMany({ where: { organizationId: org(req), clientId }, orderBy: { visitDate: "desc" }, take: 250 });
  await audit(req, "VISITS_READ", clientId);
  res.json(rows.map(({ encryptedFacts, ...row }) => {
    const facts: VisitFacts = JSON.parse(unseal(encryptedFacts, `${org(req)}:${clientId}:visit`));
    if (!hasCareCapability(res.locals.careRole, "clinical")) for (const column of CENTER_COLUMNS.filter(c => c.clinical)) if (facts.metrics) delete facts.metrics[column.key];
    return { ...row, facts };
  }));
}));
router.post("/visits", ...route("casework", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  await careLinks(req, clientId, req.body.caseId, null);
  const recordKey = text(req.body.recordKey, 191);
  const previous = await prisma.compassionVisit.findFirst({ where: { organizationId: org(req), recordKey } });
  if (previous) { check(previous.clientId === clientId && previous.visitDate.toISOString().slice(0,10) === req.body.visitDate && previous.location === req.body.location && previous.caseId === (req.body.caseId || null) && previous.appointmentId === (req.body.appointmentId || null), "This retry key already saved a different visit. Reopen the saved visit before starting another."); res.json({ id: previous.id }); return; }
  const date = text(req.body.visitDate, 10); check(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date, "Choose a valid visit date.");
  const appointmentId = req.body.appointmentId ? text(req.body.appointmentId, 191) : null;
  if (appointmentId) {
    const appointment = await prisma.compassionAppointment.findFirst({ where: { id: appointmentId, organizationId: org(req), clientId } });
    check(appointment && (!req.body.caseId || appointment.caseId === req.body.caseId), "Choose this client’s appointment and case.");
    check(!["NO_SHOW", "CANCELLED", "RESCHEDULED"].includes(appointment.status), "A cancelled, missed or rescheduled booking cannot become an attended visit.");
    const existing = await prisma.compassionVisit.findFirst({ where: { organizationId: org(req), appointmentId } }); if (existing) { res.json({ id: existing.id }); return; }
  }
  const staffId = req.body.staffId ? text(req.body.staffId, 191) : null;
  if (staffId) check(await prisma.compassionStaff.findFirst({ where: { id: staffId, organizationId: org(req), isActive: true } }), "Select active care staff.");
  const row = await prisma.compassionVisit.create({ data: { organizationId: org(req), clientId, caseId: req.body.caseId || null, appointmentId, staffId, recordKey, visitDate: new Date(date), location: text(req.body.location, 191), authorId: req.user!.sub, encryptedFacts: seal("{}", `${org(req)}:${clientId}:visit`) } });
  await audit(req, "VISIT_STARTED", row.id); res.status(201).json({ id: row.id });
}));
router.patch("/visits/:id", ...route("casework", async (req, res) => {
  const row = await prisma.compassionVisit.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(row, "Visit not found.");
  if (req.body.expectedUpdatedAt !== row.updatedAt.toISOString()) throw new CareError(409, "VISIT_CHANGED", "Visit changed. Reload before saving.");
  check(["IN_PROGRESS", "COMPLETED", "VOID"].includes(req.body.status), "Choose a visit status.");
  const existing: VisitFacts = JSON.parse(unseal(row.encryptedFacts, `${org(req)}:${row.clientId}:visit`));
  const metrics = req.body.metrics ?? {}; check(metrics && typeof metrics === "object" && !Array.isArray(metrics), "Invalid visit facts.");
  for (const [key, value] of Object.entries(metrics)) {
    const column = CENTER_COLUMNS.find(c => c.key === key); check(column && typeof value === "boolean", "Unknown visit statistic.");
    if (column.clinical && !hasCareCapability(res.locals.careRole, "clinical")) throw new CareError(403, "CLINICAL_ACCESS_REQUIRED", "Clinical statistics require clinical access.");
  }
  const facts = { ...existing, metrics: { ...existing.metrics, ...metrics } };
  await prisma.compassionVisit.update({ where: { id: row.id }, data: { status: req.body.status, encryptedFacts: seal(JSON.stringify(facts), `${org(req)}:${row.clientId}:visit`) } });
  await audit(req, "VISIT_UPDATED", row.id); res.json({ updated: true });
}));
router.get("/visits/:id/services", ...route("casework", async (req, res) => {
  const visit = await prisma.compassionVisit.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(visit, "Visit not found.");
  const rows = await prisma.compassionService.findMany({ where: { organizationId: org(req), clientId: visit.clientId, visitId: visit.id }, select: { id: true, serviceType: true, quantity: true, serviceDate: true }, orderBy: { serviceDate: "asc" } });
  res.json(rows.filter(r => hasCareCapability(res.locals.careRole, "clinical") || !["PREGNANCY_TEST", "ULTRASOUND"].includes(r.serviceType)));
}));
router.post("/visits/:id/services", ...route("casework", async (req, res) => {
  const visit = await prisma.compassionVisit.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(visit && visit.status !== "VOID", "Choose an active visit.");
  check(Object.values(CompassionServiceType).includes(req.body.serviceType), "Choose a service type.");
  if (["PREGNANCY_TEST", "ULTRASOUND"].includes(req.body.serviceType) && !hasCareCapability(res.locals.careRole, "clinical")) throw new CareError(403, "CLINICAL_ACCESS_REQUIRED", "Medical services require clinical access.");
  const sourceKey = text(req.body.sourceKey, 191);
  const old = await prisma.compassionService.findFirst({ where: { organizationId: org(req), sourceKey } });
  if (old) { check(old.visitId === visit.id && old.serviceType === req.body.serviceType && old.quantity === (req.body.quantity ?? 1), "This retry key already saved a different service. Refresh before recording another."); res.json({ id: old.id }); return; }
  const row = await prisma.compassionService.create({ data: { organizationId: org(req), clientId: visit.clientId, caseId: visit.caseId, visitId: visit.id, sourceKey, serviceType: req.body.serviceType, quantity: integer(req.body.quantity ?? 1, 1, 10000), serviceDate: visit.visitDate } });
  await audit(req, "VISIT_SERVICE_RECORDED", row.id); res.status(201).json({ id: row.id });
}));
router.get("/reports/definitions", ...route("export", async (req, res) => {
  const rows = await prisma.compassionReportDefinition.findMany({ where: { organizationId: org(req) }, orderBy: { version: "desc" }, take: 100 });
  res.json(rows);
}));
router.post("/reports/definitions", ...route("manage", async (req, res) => {
  check(Array.isArray(req.body.columns) && req.body.columns.length === CENTER_COLUMNS.length, "Define each center-specific column.");
  const columns: CenterDefinition[] = req.body.columns;
  check(new Set(columns.map(c => c.key)).size === CENTER_COLUMNS.length && columns.every(c => CENTER_COLUMNS.some(x => x.key === c.key) && typeof c.configured === "boolean" && typeof c.description === "string" && c.description.length <= 1000 && (!c.configured || c.description.trim().length > 0)), "Configured columns need a counting definition.");
  const latest = await prisma.compassionReportDefinition.findFirst({ where: { organizationId: org(req) }, orderBy: { version: "desc" } });
  if ((latest?.version ?? 0) !== req.body.expectedVersion) throw new CareError(409, "DEFINITION_CHANGED", "Report definitions changed. Reload before publishing.");
  const row = await prisma.compassionReportDefinition.create({ data: { organizationId: org(req), version: (latest?.version ?? 0) + 1, config: columns.map(c=>({key:c.key,configured:c.configured,description:c.description})), authorId: req.user!.sub } });
  await audit(req, "REPORT_DEFINITION_PUBLISHED", row.id); res.status(201).json(row);
}));
router.get("/reports/monthly", ...route("export", async (req, res) => {
  let range: ReturnType<typeof calendarMonth>; try { range = calendarMonth(req.query.month); } catch { throw new CareError(400, "INVALID_MONTH", "Choose a calendar month."); }
  const { start, end } = range; const organizationId = org(req); const location = req.query.location ? text(req.query.location, 191) : null;
  const definition = req.query.version === "0" ? null : await prisma.compassionReportDefinition.findFirst({ where: { organizationId, ...(req.query.version ? { version: integer(Number(req.query.version), 1, 100000) } : {}) }, orderBy: { version: "desc" } });
  check(!req.query.version || req.query.version === "0" || definition, "Report definition not found.");
  const configured = (definition?.config ?? []) as unknown as CenterDefinition[];
  const columns = CENTER_COLUMNS.filter(c => !c.clinical || hasCareCapability(res.locals.careRole, "clinical")).map(c => ({ ...c, ...configured.find(d => d.key === c.key), configured: configured.find(d => d.key === c.key)?.configured ?? false }));
  const visits = await prisma.compassionVisit.findMany({ where: { organizationId, visitDate: { gte: start, lt: end }, status: { not: "VOID" }, ...(location ? { location } : {}) }, orderBy: { visitDate: "asc" }, take: 10001 });
  check(visits.length <= 10000, "Narrow the location filter; this register exceeds 10,000 visits.");
  const clients = await prisma.compassionClient.findMany({ where: { organizationId, id: { in: [...new Set(visits.map(v => v.clientId))] } }, select: patientProjection });
  const services = await prisma.compassionService.findMany({ where: { organizationId, visitId: { in: visits.filter(v => v.status === "COMPLETED").map(v => v.id) } }, select: { id: true, visitId: true, serviceType: true, quantity: true }, take:50001 });
  check(services.length<=50000,"Narrow the location filter; this register exceeds 50,000 service entries.");
  const patientsById=new Map(clients.map(c=>[c.id,c]));
  const servicesByVisit=new Map<string,typeof services>();
  for(const service of services) if(service.visitId) { const entries=servicesByVisit.get(service.visitId) ?? []; entries.push(service);servicesByVisit.set(service.visitId,entries); }
  // Appointment bounds use the explicitly selected center timezone, rather than server/browser time.
  const timezone = String(req.query.timezone || "America/Chicago"); try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new CareError(400, "INVALID_TIMEZONE", "Choose an IANA timezone."); }
  const appointments = await prisma.compassionAppointment.findMany({ where: { organizationId, startTime: { gte: new Date(start.getTime() - 86400000), lt: new Date(end.getTime() + 86400000) }, ...(location ? { location } : {}) }, select: { id: true, startTime: true, status: true },take:10001 });
  check(appointments.length<=10000,"Narrow the location filter; this register exceeds 10,000 bookings.");
  const dateFormatter=new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" });
  const monthAppointments = appointments.filter(a => { const parts = dateFormatter.formatToParts(a.startTime); return `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}` === req.query.month; });
  const rows = visits.map(v => {
    const patient = patientsById.get(v.clientId); const facts: VisitFacts = JSON.parse(unseal(v.encryptedFacts, `${organizationId}:${v.clientId}:visit`));
    const delivered = v.status === "COMPLETED" ? servicesByVisit.get(v.id) ?? [] : [];
    return { id: v.id, clientId: v.clientId, clientName: patient ? `${patient.lastName}, ${patient.firstName}` : "Client unavailable", visitDate: v.visitDate.toISOString().slice(0,10), location: v.location, status: v.status,
      services: delivered.filter(s => hasCareCapability(res.locals.careRole, "clinical") || !["PREGNANCY_TEST", "ULTRASOUND"].includes(s.serviceType)),
      supplies: delivered.filter(s => ["DIAPERS", "CLOTHING", "FORMULA"].includes(s.serviceType)).reduce((n,s) => n + (s.quantity ?? 0), 0),
      metrics: Object.fromEntries(columns.map(c => [c.key, c.configured ? (v.status === "COMPLETED" && facts.metrics?.[c.key] === true ? 1 : 0) : null])) };
  });
  const totals = { appointments: monthAppointments.length, noShows: monthAppointments.filter(a => a.status === "NO_SHOW").length, rescheduled: monthAppointments.filter(a => a.status === "RESCHEDULED").length, attendedVisits: visits.length, completedVisits: visits.filter(v => v.status === "COMPLETED").length, uniqueClients: new Set(visits.map(v => v.clientId)).size, supplies: rows.reduce((n,r) => n + r.supplies,0), metrics: Object.fromEntries(columns.map(c => [c.key, c.configured ? rows.reduce((n,r) => n + (r.metrics[c.key] ?? 0),0) : null])) };
  await audit(req, req.query.format === "csv" ? "MONTHLY_REGISTER_EXPORTED" : "MONTHLY_REGISTER_READ", undefined, { month: String(req.query.month), definitionVersion: definition?.version ?? 0, count: rows.length });
  if (req.query.format === "csv") {
    const records = [["Definition version", definition?.version ?? 0], ["Month", req.query.month], ["Client", "Date", "Location", "Status", "Supplies", ...columns.map(c => c.label)], ...rows.map(r => [r.clientName, r.visitDate, r.location, r.status, r.supplies, ...columns.map(c => r.metrics[c.key] ?? "Not configured")])];
    res.json({ csv: records.map(r => r.map(csvCell).join(",")).join("\r\n") }); return;
  }
  res.json({ month: req.query.month, timezone, definitionVersion: definition?.version ?? 0, columns, rows, totals, rules: "Appointments use scheduled date in the selected timezone. Attendance counts actual non-void visits; clients are distinct. Services, supply units, and configured events count completed visits only. Draft forms never count. Each configured event is a staff-recorded occurrence, counted once per completed visit. Legacy services without a visit link are excluded; no historical attendance is inferred." });
}));
