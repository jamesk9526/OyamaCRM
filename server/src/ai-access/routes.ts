import { Router, type Request, type Response, type NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { CreateError } from "../oyama-create/domain.js";
import { can } from "../oyama-create/access.js";
import { CAPABILITIES, RESOURCES, resourceFields, LEGACY_TOOLS, resourceFor } from "./catalog.js";
import { accessPolicy, decideAccess, saveAccessPolicy, presetRules, consentSnapshot, validateDocument } from "./policy.js";
import { currentGrant, reviewOperation, cancelOperation, operationResult } from "./operations.js";
import { rawRecord, getRecord } from "./records.js";

const router = Router();
const handle = (work: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void work(req, res, next).catch(error => {
  if (error instanceof CreateError) res.status(error.status).json({ error: { code: "AI_ACCESS", message: error.message } });
  else if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) res.status(503).json({ error: { code: "AI_MIGRATION_REQUIRED", message: "Deploy the AI access database migration before using this workspace." } });
  else next(error);
}); };
router.use(requireAuth);
router.use(handle(async (req, res, next) => { // Recheck membership, not the JWT's stale role.
  const user = await prisma.user.findFirst({ where: { id: req.user!.sub, organizationId: req.user!.orgId, active: true, role: { not: "compassion_user" } } });
  if (!user) throw new CreateError(403, "This CRM account is unavailable.");
  req.user = { sub: user.id, orgId: user.organizationId, role: user.role, email: user.email };
  res.set("Cache-Control", "no-store");
  next();
}));
router.get("/", handle(async (req, res) => {
  const policy = await accessPolicy(req.user!.orgId), admin = req.user!.role === "admin";
  const users = admin ? await prisma.user.findMany({ where: { organizationId: req.user!.orgId, active: true, role: { not: "compassion_user" } }, select: { id: true, firstName: true, lastName: true, email: true, role: true }, take: 500, orderBy: { email: "asc" } }) : [];
  const connections = await prisma.chatGptGrant.findMany({ where: { organizationId: req.user!.orgId, ...(admin ? {} : { userId: req.user!.sub }), revokedAt: null, refreshExpiresAt: { gt: new Date() } }, select: { id: true, userId: true, scopes: true, createdAt: true, lastUsedAt: true }, take: 500, orderBy: { createdAt: "desc" } });
  const capabilities = [];
  for (const cap of CAPABILITIES) capabilities.push({ ...cap, native: undefined, handler: undefined, effective: await decideAccess(req, cap.key, undefined, policy) });
  res.json({ revision: policy.revision, document: admin ? policy.document : undefined, canManage: admin, userId: req.user!.sub, capabilities, resources: RESOURCES.map(resource => ({ key: resource.key, title: resource.title, module: resource.module, fields: resourceFields(resource), owner: resource.owner, campaign: resource.campaign, event: resource.event })), users, connections, presets: { read: presetRules("read"), drafting: presetRules("drafting"), supervised: presetRules("supervised") } });
}));
router.put("/", handle(async (req, res) => { res.json(await saveAccessPolicy(req, req.body.revision, req.body.document)); }));
router.get("/consent", handle(async (req, res) => {
  const scopes = typeof req.query.scopes === "string" ? req.query.scopes.split(" ").filter(Boolean) : [];
  if (!scopes.length || scopes.length > CAPABILITIES.length + 3 || scopes.some(scope => !CAPABILITIES.some(cap => cap.key === scope) && !["letters.read", "letters.write", "reports.read"].includes(scope))) throw new CreateError(400, "Choose supported OAuth scopes.");
  const snapshot = await consentSnapshot(req, scopes);
  res.json({ snapshot, capabilities: Object.entries(snapshot.capabilities).map(([key, rule]) => ({ key, title: CAPABILITIES.find(cap => cap.key === key)?.title || key, mode: rule.mode })), notice: "Selected CRM records will be shared with ChatGPT. Increasing access or automatic execution requires a new connection approval." });
}));
router.post("/effective", handle(async (req, res) => {
  const userId = typeof req.body.userId === "string" ? req.body.userId : req.user!.sub;
  if (userId !== req.user!.sub && req.user!.role !== "admin") throw new CreateError(403, "Inspect your own effective access.");
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: req.user!.orgId, active: true }, select: { id: true, role: true, email: true, organizationId: true } });
  if (!user) throw new CreateError(404, "CRM user not found.");
  const actor = { ...req, user: { sub: user.id, role: user.role, email: user.email, orgId: user.organizationId } } as Request;
  const grant = req.body.connectionId ? await currentGrant(String(req.body.connectionId), req.user!.orgId) : undefined;
  if (grant && grant.userId !== userId) throw new CreateError(400, "Choose a connection belonging to the selected user.");
  const key = String(req.body.capability || ""), decision = await decideAccess(actor, key, grant);
  if (req.body.recordId) {
    const cap = CAPABILITIES.find(item => item.key === key), resource = cap?.resource ? resourceFor(cap.resource) : undefined;
    if (!resource || !grant) throw new CreateError(400, "Choose a resource capability and connection to inspect a record.");
    try { await rawRecord(actor, resource, String(req.body.recordId), grant, !cap?.read, decision.constraints); }
    catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; decision.mode = "blocked"; decision.reasons.push("Record ownership, field or connection restrictions prevent this action."); }
  }
  res.json(decision);
}));
router.put("/connections/:id", handle(async (req, res) => {
  const grant = await currentGrant(String(req.params.id), req.user!.orgId);
  if (grant.userId !== req.user!.sub && req.user!.role !== "admin") throw new CreateError(403, "Only the owner or an administrator may restrict a connection.");
  const policy = await accessPolicy(req.user!.orgId);
  if (req.body.revision !== policy.revision) throw new CreateError(409, "AI access changed. Reload before saving.");
  const proposed = validateDocument({ ...policy.document, connections: { ...policy.document.connections, [grant.id]: req.body.rules } });
  if (req.user!.role !== "admin") {
    const ranks = { blocked: 0, approval: 1, automatic: 2 };
    for (const cap of CAPABILITIES) {
      const before = policy.document.connections[grant.id]?.[cap.key], after = proposed.connections[grant.id]?.[cap.key];
      if (before && !after || after && ranks[after.mode] > ranks[(await decideAccess(req, cap.key, grant)).mode]) throw new CreateError(403, "You may only reduce this connection's access.");
      if (before?.records && before.records !== "all" && after?.records !== before.records || before?.fields && (!after?.fields || after.fields.some(field => !before.fields!.includes(field))) || before?.campaignIds && after?.campaignIds?.some(id => !before.campaignIds!.includes(id)) || before?.eventIds && after?.eventIds?.some(id => !before.eventIds!.includes(id))) throw new CreateError(403, "You may only narrow existing connection restrictions.");
    }
    // Save only the validated connection delta; the caller never writes org/role/user rules.
    const revision = policy.revision + 1, config = { revision, document: proposed } as unknown as Prisma.InputJsonValue;
    await prisma.$transaction(async tx => {
      if (policy.row) {
        const saved = await tx.pluginSetting.updateMany({ where: { id: policy.row.id, updatedAt: policy.row.updatedAt }, data: { config, updatedAt: new Date(Math.max(Date.now(), policy.row.updatedAt.getTime() + 1)) } });
        if (!saved.count) throw new CreateError(409, "AI access changed. Reload before saving.");
      } else await tx.pluginSetting.create({ data: { organizationId: req.user!.orgId, pluginKey: "ai-access-policy-v1", enabled: true, config } });
      await tx.aiAccessRevision.create({ data: { organizationId: req.user!.orgId, actorId: req.user!.sub, revision, documentJson: config } });
    });
    res.json({ revision });
  } else res.json(await saveAccessPolicy(req, policy.revision, proposed));
}));
router.delete("/connections/:id", handle(async (req, res) => {
  const grant = await currentGrant(String(req.params.id), req.user!.orgId);
  if (req.user!.role !== "admin" && grant.userId !== req.user!.sub) throw new CreateError(403, "Disconnect your own connection.");
  await prisma.$transaction(async tx => {
    await tx.chatGptGrant.updateMany({ where: { id: grant.id, organizationId: req.user!.orgId }, data: { revokedAt: new Date(), accessHash: null, refreshHash: null, codeHash: null } });
    await tx.aiOperation.updateMany({ where: { grantId: grant.id, status: { in: ["PENDING", "QUEUED"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  });
  res.status(204).end();
}));
async function operationVisible(req: Request, id: string) {
  const row = await prisma.aiOperation.findFirst({ where: { id, organizationId: req.user!.orgId, ...(["admin", "manager"].includes(req.user!.role) ? {} : { actorId: req.user!.sub }) } });
  if (!row) throw new CreateError(404, "AI operation not found.");
  const cap = CAPABILITIES.find(item => item.key === row.capability)!;
  for (const permission of cap.permissions) if (!await can(req, permission)) throw new CreateError(403, "CRM permission is required to review this operation.");
  const preview = row.previewJson as unknown as { targets: { resource: string; id: string }[] };
  if (row.actorId !== req.user!.sub) {
    const grant = await currentGrant(row.grantId, req.user!.orgId);
    for (const target of preview.targets) if (target.resource !== "studio_draft") await rawRecord(req, resourceFor(target.resource)!, target.id, grant);
  }
  return row;
}
router.get("/operations", handle(async (req, res) => {
  const where = { organizationId: req.user!.orgId, ...(["admin", "manager"].includes(req.user!.role) ? {} : { actorId: req.user!.sub }), ...(req.query.status === "PENDING" ? { status: "PENDING" } : {}), ...(typeof req.query.cursor === "string" ? { id: { lt: req.query.cursor } } : {}) };
  const rows = await prisma.aiOperation.findMany({ where, orderBy: { id: "desc" }, take: 51, select: { id: true, capability: true, status: true, actorId: true, createdAt: true, expiresAt: true, reviewerId: true, reviewedAt: true, finishedAt: true } });
  res.json({ items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null });
}));
router.get("/operations/:id", handle(async (req, res) => {
  const row = await operationVisible(req, String(req.params.id));
  res.json({ id: row.id, capability: row.capability, status: row.status, actorId: row.actorId, preview: row.previewJson, expiresAt: row.expiresAt, createdAt: row.createdAt, reviewerId: row.reviewerId, reviewReason: row.reviewReason, reviewedAt: row.reviewedAt });
}));
router.post("/operations/:id/decision", handle(async (req, res) => {
  if (typeof req.body.approved !== "boolean" || req.body.reason !== undefined && (typeof req.body.reason !== "string" || req.body.reason.length > 500)) throw new CreateError(400, "Choose approve or reject with an optional reason.");
  await operationVisible(req, String(req.params.id));
  res.json(await reviewOperation(req, String(req.params.id), req.body.approved, req.body.reason));
}));
router.post("/operations/:id/cancel", handle(async (req, res) => { res.json(await cancelOperation(req, String(req.params.id))); }));
router.get("/operations/:id/export", handle(async (req, res) => {
  const row = await operationVisible(req, String(req.params.id));
  if (row.actorId !== req.user!.sub) throw new CreateError(403, "Only the requesting user may download this export.");
  const grant = await currentGrant(row.grantId, req.user!.orgId);
  await operationResult(req, grant, row, "");
  const exported = (row.resultJson as unknown as { export?: { resource: string; items: { id: string; fields: Record<string, unknown> }[] } })?.export;
  if (row.status !== "SUCCEEDED" || !exported) throw new CreateError(409, "This export is not ready.");
  const records = [];
  for (const item of exported.items) { const current = await getRecord(req, grant, item.id, ""); records.push(current.fields); }
  const columns = [...new Set(records.flatMap(record => Object.keys(record)))];
  const cell = (value: unknown) => { const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); return `"${(typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; };
  res.type("text/csv").set("Content-Disposition", 'attachment; filename="oyama-crm-export.csv"').send([columns.map(cell).join(","), ...records.map(record => columns.map(key => cell(record[key])).join(","))].join("\r\n"));
}));
export default router;
