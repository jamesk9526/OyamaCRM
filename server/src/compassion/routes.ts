import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "./database.js";
import { accessToken, audit, CARE_ROLES, digest, encryptionReady, org, requireCareMembership, seal, unseal } from "./security.js";
import { CareError, check, client, date, integer, route, text } from "./http.js";
import { clinicalRoutes } from "./clinical.js";
import { migrationRoutes } from "./migration.js";
import { validAvailability } from "./scheduling.js";
import { letterRoutes } from "./letters.js";
import { identityRoutes } from "./identity.js";

export const careRoutes = Router();
export const publicCareRoutes = Router();
const router = careRoutes;
router.use(requireAuth);
router.post("/bootstrap", async (req, res) => {
  const account = await prisma.user.findFirst({ where: { id: req.user!.sub, organizationId: org(req), active: true, role: "admin" }, select: { id: true } });
  if (!account || req.body.approve !== true) { res.status(403).json({ error: { message: "An active platform administrator must explicitly initialize Compassion." } }); return; }
  const { atomic } = await import("./database.js");
  const initialized = await atomic(org(req), async () => {
    if (await prisma.compassionMembership.count({ where: { organizationId: org(req) } })) return false;
    await prisma.compassionMembership.create({ data: { organizationId: org(req), userId: account.id, role: "ADMIN" } });
    await audit(req, "CARE_WORKSPACE_INITIALIZED", account.id); return true;
  });
  if (!initialized) { res.status(409).json({ error: { message: "Compassion is already initialized. Contact its administrator for membership." } }); return; }
  res.status(201).json({ initialized: true });
});
router.use(requireCareMembership);
router.use(async (req, res, next) => {
  const id = /^\/clients\/([^/]+)/.exec(req.path)?.[1];
  if (id && !["import"].includes(id)) {
    let currentId = id;
    for (let depth = 0; depth < 20; depth++) {
      const link = await prisma.compassionClientRedirect.findFirst({ where: { organizationId: org(req), sourceId: currentId } });
      if (!link) break;
      currentId = link.targetId;
    }
    if (currentId !== id) {
      const canonicalPath = `/api/compassion${req.path.replace(`/clients/${id}`, `/clients/${currentId}`)}`;
      if (req.method === "GET") { res.redirect(307, canonicalPath); return; }
      res.status(409).json({ error: { code: "CLIENT_MERGED", message: "This client has been merged. Open the current client record.", canonicalPath } }); return;
    }
  }
  next();
});
router.use(clinicalRoutes, migrationRoutes, identityRoutes, letterRoutes);

router.get("/today", ...route("records", async (req, res) => {
  const now = new Date(); const start = req.query.start ? date(req.query.start) : new Date(now); if (!req.query.start) start.setHours(0, 0, 0, 0);
  const end = req.query.end ? date(req.query.end) : new Date(start.getTime() + 86400000);
  check(end > start && end.getTime() - start.getTime() <= 27 * 3600000, "Choose a single local calendar day.");
  const scope = { organizationId: org(req) };
  const [activeClients, activeCases, appointments, followUps, pendingApprovals, incompleteIntake] = await Promise.all([
    prisma.compassionClient.count({ where: { ...scope, clientStatus: "ACTIVE" } }),
    prisma.compassionCase.count({ where: { ...scope, caseStatus: "OPEN" } }),
    prisma.compassionAppointment.findMany({ where: { ...scope, startTime: { gte: start, lt: end } }, select: { id: true, startTime: true, appointmentType: true, status: true, location: true, client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { startTime: "asc" }, take: 100 }),
    res.locals.careCapabilities.includes("casework") ? prisma.compassionFollowUp.findMany({ where: { ...scope, assignedStaffId: req.user!.sub, status: "PENDING", dueDate: { lte: end } }, select: { id: true, clientId: true, title: true, dueDate: true }, orderBy: { dueDate: "asc" }, take: 15 }) : Promise.resolve([]),
    res.locals.careCapabilities.includes("clinical") ? prisma.compassionChart.count({ where: { ...scope, status: "REVIEW" } }) : Promise.resolve(null),
    prisma.compassionIntake.count({ where: { ...scope, status: { in: ["REQUESTED", "RETURNED"] } } }),
  ]);
  res.json({ activeClients, activeCases, appointments, followUps, pendingApprovals, incompleteIntake });
}));

router.get("/readiness", ...route("records", async (_req, res) => res.json({ encryptedStorage: encryptionReady(), clinicalCutoverApproved: false, sourceExportVerified: false, plusLinkVerified: false, remindersConfigured: false, message: "Clinical cutover requires verified source migration, clinical templates, storage/backups, and operational review." })));
router.get("/exports/clients", ...route("export", async (req, res) => {
  const rows = await prisma.compassionClient.findMany({ where: { organizationId: org(req) }, orderBy: { lastName: "asc" }, take: 10000, select: { id: true, firstName: true, lastName: true, email: true, phone: true, clientStatus: true, intakeDate: true } });
  const cell = (value: unknown) => { const raw = String(value ?? ""); const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; };
  const csv = [["Client ID", "First Name", "Last Name", "Email", "Phone", "Status", "Intake Date"], ...rows.map((row) => [row.id, row.firstName, row.lastName, row.email, row.phone, row.clientStatus, row.intakeDate.toISOString()])].map((row) => row.map(cell).join(",")).join("\r\n");
  await audit(req, "CLIENT_DIRECTORY_EXPORTED", undefined, { count: rows.length }); res.json({ csv, count: rows.length, limit: 10000 });
}));
router.get("/memberships", ...route("manage", async (req, res) => {
  const rows = await prisma.compassionMembership.findMany({ where: { organizationId: org(req) } });
  const users = await prisma.user.findMany({ where: { organizationId: org(req), active: true }, select: { id: true, firstName: true, lastName: true, email: true } });
  res.json({ memberships: rows, users, roles: CARE_ROLES });
}));
router.post("/memberships", ...route("manage", async (req, res) => {
  const userId = text(req.body.userId, 191); check(CARE_ROLES.includes(req.body.role), "Choose a Compassion role.");
  check(await prisma.user.findFirst({ where: { id: userId, organizationId: org(req), active: true } }), "Select an active account in this organization.");
  const active = req.body.active !== false;
  const existing = await prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId: org(req), userId } } });
  if (existing?.role === "ADMIN" && (!active || req.body.role !== "ADMIN")) {
    check(await prisma.compassionMembership.count({ where: { organizationId: org(req), active: true, role: "ADMIN" } }) > 1, "Keep at least one active Compassion administrator.");
  }
  const row = await prisma.compassionMembership.upsert({ where: { organizationId_userId: { organizationId: org(req), userId } }, create: { organizationId: org(req), userId, role: req.body.role, active }, update: { role: req.body.role, active } });
  await audit(req, "MEMBERSHIP_UPDATED", row.id, { role: row.role, active }); res.json(row);
}));
router.get("/audit", ...route("manage", async (req, res) => {
  await audit(req, "AUDIT_VIEWED");
  res.json(await prisma.compassionAudit.findMany({ where: { organizationId: org(req) }, orderBy: { createdAt: "desc" }, take: 200 }));
}));
router.get("/resources", ...route("schedule", async (req, res) => res.json(await prisma.compassionResource.findMany({ where: { organizationId: org(req) }, orderBy: { name: "asc" } }))));
router.post("/resources", ...route("manage", async (req, res) => {
  const name = text(req.body.name, 191); check(["ROOM", "EQUIPMENT", "STAFF"].includes(req.body.kind), "Select a room, equipment, or staff resource.");
  const timezone = String(req.body.timezone || "America/Chicago");
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new CareError(400, "INVALID_TIMEZONE", "Enter an IANA timezone."); }
  check(req.body.availability === undefined || validAvailability(req.body.availability), "Enter valid weekly availability windows.");
  const staffId = req.body.staffId ? text(req.body.staffId, 191) : null;
  if (req.body.kind === "STAFF") check(staffId && await prisma.compassionStaff.findFirst({ where: { id: staffId, organizationId: org(req), isActive: true } }), "Select an active care staff member for staff availability.");
  const row = await prisma.compassionResource.create({ data: { organizationId: org(req), name, kind: req.body.kind, staffId: req.body.kind === "STAFF" ? staffId : null, location: req.body.location ? text(req.body.location, 191) : null, timezone, availability: Array.isArray(req.body.availability) ? req.body.availability : undefined } });
  await audit(req, "RESOURCE_CREATED", row.id); res.status(201).json(row);
}));
router.patch("/resources/:id", ...route("manage", async (req, res) => {
  check(req.body.availability === undefined || validAvailability(req.body.availability), "Enter valid weekly availability windows.");
  const updated = await prisma.compassionResource.updateMany({ where: { id: String(req.params.id), organizationId: org(req) }, data: { ...(typeof req.body.active === "boolean" ? { active: req.body.active } : {}), ...(Array.isArray(req.body.availability) ? { availability: req.body.availability } : {}) } });
  check(updated.count, "Resource not found."); await audit(req, "RESOURCE_UPDATED", String(req.params.id)); res.json({ updated: true });
}));
router.get("/reservations", ...route("schedule", async (req, res) => res.json(await prisma.compassionReservation.findMany({ where: { organizationId: org(req), ...(req.query.appointmentId ? { appointmentId: String(req.query.appointmentId) } : {}) }, take: 1000 }))));
router.put("/clients/:id/contact-preferences", ...route("casework", async (req, res) => {
  const row = await client(req, String(req.params.id));
  const safeContact = { email: req.body.email === true, sms: req.body.sms === true, voicemail: req.body.voicemail === true, preferredName: req.body.preferredName ? text(req.body.preferredName, 191) : "", notes: req.body.notes ? text(req.body.notes, 1000) : "" };
  await prisma.compassionClient.update({ where: { id: row.id }, data: { safeContact } });
  await audit(req, "SAFE_CONTACT_UPDATED", row.id); res.json(safeContact);
}));

router.get("/intake", ...route("casework", async (req, res) => res.json(await prisma.compassionIntake.findMany({ where: { organizationId: org(req) }, select: { id: true, clientId: true, appointmentId: true, language: true, status: true, expiresAt: true, createdAt: true, processedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }))));
router.post("/intake", ...route("casework", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  const appointmentId = req.body.appointmentId ? text(req.body.appointmentId, 191) : null;
  if (appointmentId) check(await prisma.compassionAppointment.findFirst({ where: { id: appointmentId, clientId, organizationId: org(req) } }), "Appointment not found for this client.");
  const token = accessToken(); const language = req.body.language === "es" ? "es" : "en";
  const template = Array.isArray(req.body.template) ? req.body.template : [
    { key: "preferredName", label: language === "es" ? "Nombre preferido" : "Preferred name", required: false },
    { key: "reason", label: language === "es" ? "Motivo de la visita" : "Reason for visit", required: true },
  ];
  check(template.length <= 40 && template.every((f: { key?: unknown; label?: unknown }) => typeof f.key === "string" && /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(f.key) && typeof f.label === "string" && f.label.length < 200), "Invalid intake template.");
  const consentVersion = text(req.body.consentVersion || "1", 100);
  check(typeof req.body.consentText === "string" && req.body.consentText.trim().length >= 20, "Provide your center's reviewed consent wording.");
  const row = await prisma.compassionIntake.create({ data: { organizationId: org(req), clientId, appointmentId, tokenHash: digest(token), language, template: { fields: template, consentText: text(req.body.consentText, 20000) }, consentVersion, expiresAt: new Date(Date.now() + 72 * 3600000) } });
  await audit(req, "INTAKE_REQUEST_CREATED", row.id); res.status(201).json({ id: row.id, path: `/compassion/public/intake/${token}`, expiresAt: row.expiresAt });
}));
router.get("/intake/:id", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionIntake.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(row, "Intake request not found.");
  await audit(req, "INTAKE_REVIEWED", row.id);
  const { encryptedSubmission, tokenHash, ...fields } = row;
  void tokenHash;
  res.json({ ...fields, submission: encryptedSubmission ? JSON.parse(unseal(encryptedSubmission, `${org(req)}:${row.clientId}:intake`)) : null });
}));
router.post("/intake/:id/process", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionIntake.findFirst({ where: { id: String(req.params.id), organizationId: org(req), status: "RETURNED" } }); check(row?.encryptedSubmission && req.body.approve === true, "Review a returned intake and approve processing.");
  const content = unseal(row.encryptedSubmission, `${org(req)}:${row.clientId}:intake`);
  const chart = await prisma.compassionChart.create({ data: { organizationId: org(req), clientId: row.clientId, kind: "CONSENT", authorId: req.user!.sub, encryptedContent: seal(JSON.stringify({ sourceIntakeId: row.id, consentVersion: row.consentVersion, submitted: JSON.parse(content) }), `${org(req)}:${row.clientId}:chart`) } });
  await prisma.compassionIntake.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date() } });
  await audit(req, "INTAKE_PROCESSED", row.id); res.json({ chartId: chart.id });
}));
router.post("/clients/:id/portal-access", ...route("messages", async (req, res) => {
  const row = await client(req, String(req.params.id)); const token = accessToken();
  await prisma.compassionPortalAccess.updateMany({ where: { organizationId: org(req), clientId: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  const grant = await prisma.compassionPortalAccess.create({ data: { organizationId: org(req), clientId: row.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 3600000) } });
  await audit(req, "PORTAL_ACCESS_ISSUED", row.id); res.json({ path: `/compassion/public/portal/${token}`, expiresAt: grant.expiresAt });
}));
router.delete("/clients/:id/portal-access", ...route("messages", async (req, res) => {
  const row = await client(req, String(req.params.id));
  await prisma.compassionPortalAccess.updateMany({ where: { organizationId: org(req), clientId: row.id }, data: { revokedAt: new Date() } });
  await audit(req, "PORTAL_ACCESS_REVOKED", row.id); res.json({ revoked: true });
}));
router.get("/messages", ...route("messages", async (req, res) => {
  const clientId = text(req.query.clientId, 191); await client(req, clientId);
  const rows = await prisma.compassionMessage.findMany({ where: { organizationId: org(req), clientId }, orderBy: { createdAt: "asc" }, take: 250 });
  await audit(req, "MESSAGES_READ", clientId); res.json(rows.map(({ encryptedContent, ...row }) => ({ ...row, content: unseal(encryptedContent, `${org(req)}:${clientId}:message`) })));
}));
router.post("/messages", ...route("messages", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  check(req.body.approve === true, "Review and approve the portal message.");
  const row = await prisma.compassionMessage.create({ data: { organizationId: org(req), clientId, authorId: req.user!.sub, direction: "STAFF", encryptedContent: seal(text(req.body.content), `${org(req)}:${clientId}:message`) } });
  await audit(req, "PORTAL_MESSAGE_SENT", row.id); res.status(201).json({ id: row.id });
}));

router.get("/classes", ...route("records", async (req, res) => res.json(await prisma.compassionClass.findMany({ where: { organizationId: org(req) }, orderBy: { startTime: "desc" }, take: 200 }))));
router.post("/classes", ...route("casework", async (req, res) => {
  const row = await prisma.compassionClass.create({ data: { organizationId: org(req), title: text(req.body.title, 191), startTime: date(req.body.startTime), capacity: integer(req.body.capacity, 1, 500), points: integer(req.body.points ?? 0, 0, 10000), location: req.body.location ? text(req.body.location, 191) : null } });
  await audit(req, "CLASS_CREATED", row.id); res.status(201).json(row);
}));
router.get("/classes/:id/enrollments", ...route("casework", async (req, res) => {
  check(await prisma.compassionClass.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }), "Class not found.");
  const rows = await prisma.compassionEnrollment.findMany({ where: { classId: String(req.params.id), organizationId: org(req) } }); res.json(rows);
}));
router.post("/classes/:id/enrollments", ...route("casework", async (req, res) => {
  const classId = String(req.params.id); const clientId = text(req.body.clientId, 191); await client(req, clientId);
  const session = await prisma.compassionClass.findFirst({ where: { id: classId, organizationId: org(req) } }); check(session, "Class not found.");
  const existing = await prisma.compassionEnrollment.findUnique({ where: { classId_clientId: { classId, clientId } } });
  if (existing) { res.json(existing); return; }
  const count = await prisma.compassionEnrollment.count({ where: { classId, organizationId: org(req), status: { in: ["ENROLLED", "COMPLETED"] } } });
  const row = await prisma.compassionEnrollment.create({ data: { organizationId: org(req), classId, clientId, status: count >= session.capacity ? "WAITLIST" : "ENROLLED" } });
  await audit(req, "CLASS_ENROLLED", row.id); res.status(201).json(row);
}));
router.patch("/enrollments/:id", ...route("casework", async (req, res) => {
  const row = await prisma.compassionEnrollment.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(row, "Enrollment not found.");
  check(["COMPLETED", "DROPPED", "ENROLLED"].includes(req.body.status), "Choose an enrollment status.");
  const session = await prisma.compassionClass.findFirst({ where: { id: row.classId, organizationId: org(req) } }); check(session, "Class not found.");
  check(row.status !== "COMPLETED" || req.body.status === "COMPLETED", "Completed attendance is protected. Record a separate point correction if needed.");
  if (row.status === "WAITLIST" && req.body.status !== "DROPPED") check(await prisma.compassionEnrollment.count({ where: { classId: row.classId, organizationId: org(req), status: { in: ["ENROLLED", "COMPLETED"] } } }) < session.capacity, "Class is full.");
  await prisma.compassionEnrollment.update({ where: { id: row.id }, data: { status: req.body.status } });
  if (req.body.status === "COMPLETED" && session.points > 0) await prisma.compassionPointEntry.upsert({ where: { sourceKey: `class:${row.id}` }, create: { organizationId: org(req), clientId: row.clientId, amount: session.points, reason: `Class completed: ${session.title}`, sourceKey: `class:${row.id}`, actorId: req.user!.sub }, update: {} });
  await audit(req, "CLASS_ATTENDANCE_UPDATED", row.id); res.json({ updated: true });
}));
router.get("/clients/:id/points", ...route("casework", async (req, res) => {
  const row = await client(req, String(req.params.id)); const entries = await prisma.compassionPointEntry.findMany({ where: { organizationId: org(req), clientId: row.id }, orderBy: { createdAt: "desc" } });
  res.json({ balance: entries.reduce((sum, e) => sum + e.amount, 0), entries });
}));
router.post("/clients/:id/points", ...route("casework", async (req, res) => {
  const row = await client(req, String(req.params.id)); const amount = integer(req.body.amount, -10000, 10000); check(amount !== 0, "Enter a nonzero points amount.");
  check(req.body.approve === true, "Review and approve this points transaction.");
  const total = await prisma.compassionPointEntry.aggregate({ where: { organizationId: org(req), clientId: row.id }, _sum: { amount: true } });
  check((total._sum.amount ?? 0) + amount >= 0, "Insufficient points for this redemption.");
  const entry = await prisma.compassionPointEntry.create({ data: { organizationId: org(req), clientId: row.id, amount, reason: text(req.body.reason, 1000), actorId: req.user!.sub } });
  await audit(req, amount < 0 ? "BOUTIQUE_REDEMPTION" : "POINTS_GRANTED", entry.id); res.status(201).json(entry);
}));
router.get("/staff-hours", ...route("manage", async (req, res) => res.json(await prisma.compassionStaffHours.findMany({ where: { organizationId: org(req) }, orderBy: { date: "desc" }, take: 200 }))));
router.post("/staff-hours", ...route("manage", async (req, res) => {
  const staffId = text(req.body.staffId, 191); check(await prisma.compassionStaff.findFirst({ where: { id: staffId, organizationId: org(req), isActive: true } }), "Staff member not found.");
  const row = await prisma.compassionStaffHours.create({ data: { organizationId: org(req), staffId, serviceArea: text(req.body.serviceArea, 191), date: date(req.body.date), minutes: integer(req.body.minutes, 1, 1440) } });
  await audit(req, "STAFF_HOURS_RECORDED", row.id); res.status(201).json(row);
}));

// Public routes authenticate only purpose-specific, expiring opaque tokens.
publicCareRoutes.get("/intake/:token", async (req, res) => {
  const row = await prisma.compassionIntake.findUnique({ where: { tokenHash: digest(String(req.params.token)) } });
  if (!row || row.expiresAt <= new Date() || row.status !== "REQUESTED") { res.status(404).json({ error: { message: "This intake link is expired or already submitted." } }); return; }
  res.json({ language: row.language, template: row.template, consentVersion: row.consentVersion });
});
publicCareRoutes.post("/intake/:token", async (req, res, next) => {
  try {
    const row = await prisma.compassionIntake.findUnique({ where: { tokenHash: digest(String(req.params.token)) } });
    check(row && row.expiresAt > new Date() && row.status === "REQUESTED", "This intake link is expired or already submitted.");
    check(req.body.consent === true && typeof req.body.signedName === "string" && req.body.signedName.trim(), "Confirm consent and enter your name.");
    const template = row.template as { fields: Array<{ key: string; required?: boolean }> };
    check(req.body.answers && typeof req.body.answers === "object", "Complete the intake form.");
    const answers: Record<string, string> = {};
    for (const field of template.fields) { const answer = req.body.answers[field.key]; check(!field.required || (typeof answer === "string" && answer.trim()), "Complete all required questions."); if (answer) answers[field.key] = text(answer, 5000); }
    const submission = JSON.stringify({ answers, signedName: text(req.body.signedName, 191), signedAt: new Date().toISOString(), consent: true, template: row.template, consentVersion: row.consentVersion });
    const updated = await prisma.compassionIntake.updateMany({ where: { id: row.id, status: "REQUESTED", expiresAt: { gt: new Date() } }, data: { encryptedSubmission: seal(submission, `${row.organizationId}:${row.clientId}:intake`), signedAt: new Date(), status: "RETURNED" } });
    check(updated.count, "This form has already been submitted."); res.json({ submitted: true });
  } catch (error) { if (error instanceof CareError) res.status(error.status).json({ error: { message: error.message } }); else next(error); }
});
publicCareRoutes.use("/portal/:token", async (req, res, next) => {
  const row = await prisma.compassionPortalAccess.findUnique({ where: { tokenHash: digest(String(req.params.token)) } });
  if (!row || row.revokedAt || row.expiresAt <= new Date()) { res.status(401).json({ error: { message: "Portal access expired. Request a new link from your care team." } }); return; }
  res.locals.portal = row; next();
});
publicCareRoutes.get("/portal/:token", async (_req, res) => {
  const grant = res.locals.portal as { organizationId: string; clientId: string };
  const scope = { organizationId: grant.organizationId, clientId: grant.clientId };
  const [messages, documents, appointments, entries, enrollments] = await Promise.all([
    prisma.compassionMessage.findMany({ where: scope, orderBy: { createdAt: "asc" }, take: 250 }),
    prisma.compassionDocument.findMany({ where: { ...scope, shared: true, deletedAt: null }, select: { id: true, name: true, mimeType: true } }),
    prisma.compassionAppointment.findMany({ where: { ...scope, startTime: { gte: new Date() }, status: "SCHEDULED" }, select: { id: true, startTime: true, location: true } }),
    prisma.compassionPointEntry.aggregate({ where: scope, _sum: { amount: true } }),
    prisma.compassionEnrollment.findMany({ where: scope, select: { classId: true, status: true } }),
  ]);
  await prisma.compassionAudit.create({ data: { ...{ organizationId: grant.organizationId }, action: "PORTAL_VIEWED", entityId: grant.clientId } });
  res.json({ messages: messages.map(({ encryptedContent, ...row }) => ({ id: row.id, direction: row.direction, createdAt: row.createdAt, content: unseal(encryptedContent, `${scope.organizationId}:${scope.clientId}:message`) })), documents, appointments, points: entries._sum.amount ?? 0, enrollments });
});
publicCareRoutes.post("/portal/:token/messages", async (req, res) => {
  const grant = res.locals.portal as { organizationId: string; clientId: string };
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 10000) { res.status(400).json({ error: { message: "Enter a message up to 10,000 characters." } }); return; }
  await prisma.compassionMessage.create({ data: { organizationId: grant.organizationId, clientId: grant.clientId, direction: "CLIENT", encryptedContent: seal(content, `${grant.organizationId}:${grant.clientId}:message`) } });
  res.status(201).json({ sent: true });
});
publicCareRoutes.get("/portal/:token/documents/:id", async (req, res) => {
  const grant = res.locals.portal as { organizationId: string; clientId: string };
  const row = await prisma.compassionDocument.findFirst({ where: { id: String(req.params.id), organizationId: grant.organizationId, clientId: grant.clientId, shared: true, deletedAt: null } });
  if (!row) { res.status(404).json({ error: { message: "Document not found." } }); return; }
  await prisma.compassionAudit.create({ data: { organizationId: grant.organizationId, action: "PORTAL_DOCUMENT_DOWNLOADED", entityId: row.id } });
  res.json({ name: row.name, mimeType: row.mimeType, base64: unseal(row.encryptedContent, `${grant.organizationId}:${grant.clientId}:document`) });
});
