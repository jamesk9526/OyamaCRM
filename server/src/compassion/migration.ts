import { Router } from "express";
import { prisma } from "./database.js";
import { audit, digest, org, seal, unseal } from "./security.js";
import { check, route, text } from "./http.js";

export const IMPORT_FIELDS = ["externalSourceId", "firstName", "lastName", "preferredName", "email", "phone", "addressLine1", "addressLine2", "city", "state", "zip", "dateOfBirth", "intakeDate", "privateNotes", "referralSource", "clientStatus"] as const;
type ImportRow = Record<string, string>;
export function validateImportRow(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Record must be an object."];
  const row = value as ImportRow; const errors: string[] = [];
  const unsupported = Object.keys(row).filter((key) => !(IMPORT_FIELDS as readonly string[]).includes(key) && row[key] !== "");
  if (unsupported.length) errors.push(`Unsupported fields: ${unsupported.join(", ")}. Preserve these in the source archive; they will not be silently discarded.`);
  for (const field of ["externalSourceId", "firstName", "lastName"]) if (typeof row[field] !== "string" || !row[field].trim()) errors.push(`${field} is required.`);
  for (const [field, content] of Object.entries(row)) if (typeof content !== "string" || content.length > (field === "privateNotes" ? 50000 : 191)) errors.push(`${field} is invalid or too long.`);
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Invalid email; correct it before import.");
  for (const field of ["dateOfBirth", "intakeDate"]) if (row[field] && !Number.isFinite(Date.parse(row[field]))) errors.push(`Invalid ${field}.`);
  if (row.clientStatus && !["ACTIVE", "INACTIVE", "GRADUATED", "ARCHIVED", "PENDING"].includes(row.clientStatus)) errors.push("Invalid client status.");
  return errors;
}
export const migrationRoutes = Router();
const router = migrationRoutes;
router.get("/migration/coverage", ...route("import", async (_req, res) => res.json({
  supported: IMPORT_FIELDS,
  unavailable: ["No CenterPiece export has been inspected.", "Relational case/visit exports need source-specific mapping.", "Historical document archives must be uploaded to their verified client.", "Source signatures and audit history must remain preserved as original evidence."],
  sourceApiVerified: false,
})));
router.get("/migration/batches", ...route("import", async (req, res) => {
  res.json(await prisma.compassionImportBatch.findMany({ where: { organizationId: org(req) }, select: { id: true, status: true, sourceSystem: true, result: true, createdAt: true, committedAt: true }, orderBy: { createdAt: "desc" }, take: 30 }));
}));
router.post("/migration/preview", ...route("import", async (req, res) => {
  const rows: unknown = req.body.records;
  check(Array.isArray(rows) && rows.length > 0 && rows.length <= 1000, "Preview between 1 and 1,000 records.");
  const sourceSystem = text(req.body.sourceSystem || "centerpiece", 60);
  const seen = new Set<string>();
  const preview = [];
  for (let index = 0; index < rows.length; index++) {
    const errors = validateImportRow(rows[index]); const row = rows[index] as ImportRow;
    const sourceId = typeof row?.externalSourceId === "string" ? row.externalSourceId.trim() : "";
    if (sourceId && seen.has(sourceId.toLowerCase())) errors.push("Duplicate source ID in this batch.");
    if (sourceId) seen.add(sourceId.toLowerCase());
    const existing = errors.length ? null : await prisma.compassionClient.findFirst({ where: { organizationId: org(req), sourceSystem, externalSourceId: sourceId } });
    if (existing && await prisma.compassionClientRedirect.findFirst({ where: { organizationId: org(req), sourceId: existing.id } })) errors.push("This source identity has been merged. Reconcile its mapping with the kept client before importing updates.");
    const duplicate = !errors.length && !existing && row.email ? await prisma.compassionClient.findFirst({ where: { organizationId: org(req), email: row.email.trim() }, select: { id: true } }) : null;
    if (duplicate) errors.push("An existing client has this email. Review the records; no automatic merge will occur.");
    const changes: Array<{ field: string; before: string | null; after: string | null }> = [];
    if (!errors.length) for (const field of IMPORT_FIELDS) {
      if (field === "externalSourceId" || !Object.prototype.hasOwnProperty.call(row, field) || (["intakeDate", "clientStatus"].includes(field) && !row[field])) continue;
      const current = existing?.[field];
      const before = current instanceof Date ? current.toISOString() : current === undefined || current === null ? null : String(current);
      const after = row[field] && ["dateOfBirth", "intakeDate"].includes(field) ? new Date(row[field]).toISOString() : row[field] || null;
      if (before !== after) changes.push({ field, before, after });
    }
    preview.push({ row: index + 1, sourceId, action: errors.length ? "REJECTED" : existing ? "UPDATE" : "CREATE", clientId: existing?.id ?? null, expectedUpdatedAt: existing?.updatedAt.toISOString() ?? null, changes, errors });
  }
  const checksum = digest(JSON.stringify(rows));
  const summary = { total: rows.length, created: preview.filter((r) => r.action === "CREATE").length, updated: preview.filter((r) => r.action === "UPDATE").length, rejected: preview.filter((r) => r.action === "REJECTED").length, rows: preview };
  const batch = await prisma.compassionImportBatch.create({ data: { organizationId: org(req), actorId: req.user!.sub, sourceSystem, checksum, encryptedPayload: seal(JSON.stringify({ rows, preview }), `${org(req)}:import`), result: { total: summary.total, created: summary.created, updated: summary.updated, rejected: summary.rejected } } });
  await audit(req, "IMPORT_PREVIEW_CREATED", batch.id, { total: rows.length }); res.json({ id: batch.id, checksum, ...summary });
}));
router.post("/migration/:id/commit", ...route("import", async (req, res) => {
  const batch = await prisma.compassionImportBatch.findFirst({ where: { id: String(req.params.id), organizationId: org(req), actorId: req.user!.sub } });
  check(batch, "Import preview not found.");
  if (batch.status === "COMMITTED") { res.json(batch.result); return; }
  check(Date.now() - batch.createdAt.getTime() < 86400000, "Preview expired; prepare a new preview.");
  check(req.body.approve === true && req.body.checksum === batch.checksum, "Review and approve this exact preview.");
  const decoded = JSON.parse(unseal(batch.encryptedPayload, `${org(req)}:import`)) as { rows: ImportRow[]; preview: Array<{ row: number; action: string; clientId: string | null; expectedUpdatedAt: string | null }> };
  check(decoded.preview.every((r) => r.action !== "REJECTED"), "Correct all rejected records before committing.");
  let created = 0; let updated = 0;
  for (let i = 0; i < decoded.rows.length; i++) {
    const row = decoded.rows[i]; const decision = decoded.preview[i];
    const existing = await prisma.compassionClient.findFirst({ where: { organizationId: org(req), sourceSystem: batch.sourceSystem, externalSourceId: row.externalSourceId.trim() } });
    check((existing?.id ?? null) === decision.clientId, "Client records changed since preview; create a new preview.");
    check((existing?.updatedAt.toISOString() ?? null) === decision.expectedUpdatedAt, "A client was edited after preview. Prepare a fresh preview before applying updates.");
    if (!existing && row.email) check(!await prisma.compassionClient.findFirst({ where: { organizationId: org(req), email: row.email.trim() } }), "A duplicate appeared after preview; prepare a new preview.");
    const data = { firstName: row.firstName.trim(), lastName: row.lastName.trim(), preferredName: row.preferredName || null, email: row.email || null, phone: row.phone || null, addressLine1: row.addressLine1 || null, addressLine2: row.addressLine2 || null, city: row.city || null, state: row.state || null, zip: row.zip || null, referralSource: row.referralSource || null, privateNotes: row.privateNotes || null, dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null, ...(row.intakeDate ? { intakeDate: new Date(row.intakeDate), ...(!existing ? { createdAt: new Date(row.intakeDate) } : {}) } : {}), clientStatus: (row.clientStatus || "ACTIVE") as "ACTIVE" | "INACTIVE" | "GRADUATED" | "ARCHIVED" | "PENDING" };
    if (existing) {
      const update = Object.fromEntries(Object.entries(data).filter(([field]) => Object.prototype.hasOwnProperty.call(row, field) && (!["intakeDate", "clientStatus"].includes(field) || Boolean(row[field]))));
      await prisma.compassionClient.update({ where: { id: existing.id }, data: update }); updated++;
    }
    else { await prisma.compassionClient.create({ data: { ...data, organizationId: org(req), sourceSystem: batch.sourceSystem, externalSourceId: row.externalSourceId.trim() } }); created++; }
  }
  const result = { total: decoded.rows.length, created, updated, rejected: 0, checksum: batch.checksum };
  await prisma.compassionImportBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED", committedAt: new Date(), result } });
  await audit(req, "IMPORT_COMMITTED", batch.id, { created, updated }); res.json(result);
}));
