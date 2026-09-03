/** Trackable QR-code links, analytics, and the public redirect endpoint. */
import { createHash, randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function parseQrDestination(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function cleanQrSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : null;
}

function generatedSlug(): string {
  return randomBytes(6).toString("hex");
}

export function qrDeviceType(userAgent: string): string {
  if (/bot|crawler|spider|preview/i.test(userAgent)) return "bot";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return userAgent ? "desktop" : "unknown";
}

export function qrReferrer(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.slice(0, 500);
  } catch {
    return null;
  }
}

function publicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${forwardedProto || req.protocol}://${req.get("host")}`;
}

function presentLink<T extends { slug: string }>(req: Request, link: T) {
  return { ...link, shortUrl: `${publicBaseUrl(req)}/api/qr-codes/public/${link.slug}` };
}

/** Public scan endpoint. It stores privacy-reduced telemetry and never exposes CRM data. */
router.get("/public/:slug", async (req, res) => {
  const slug = cleanQrSlug(req.params.slug);
  const link = slug ? await prisma.qrCodeLink.findUnique({ where: { slug } }) : null;
  if (!link) return res.status(404).type("text/plain").send("This QR link was not found.");
  if (!link.active || (link.expiresAt && link.expiresAt <= new Date())) {
    return res.status(410).type("text/plain").send("This QR link is no longer active.");
  }

  const userAgent = String(req.get("user-agent") ?? "").slice(0, 500);
  const forwardedFor = String(req.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  const privacySeed = `${process.env.QR_TRACKING_SALT ?? process.env.JWT_SECRET ?? "oyama-qr"}|${forwardedFor || req.ip}|${userAgent}`;
  const visitorHash = createHash("sha256").update(privacySeed).digest("hex");
  res.set("Cache-Control", "no-store, private");
  try {
    await prisma.qrCodeScan.create({
      data: {
        qrCodeLinkId: link.id,
        visitorHash,
        deviceType: qrDeviceType(userAgent),
        referrer: qrReferrer(req.get("referer")),
      },
    });
  } catch (error) {
    // A telemetry write must never prevent a visitor from reaching the destination.
    console.error("[qr-codes] scan tracking failed", error);
  }
  return res.redirect(302, link.destinationUrl);
});

router.use(requireAuth);
router.use((req, res, next) => requirePermission(req.method === "GET" ? "view:communications" : "edit:communications")(req, res, next));

router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) return res.json({ items: [], summary: { totalLinks: 0, activeLinks: 0, totalScans: 0, uniqueVisitors: 0 } });
  const links = await prisma.qrCodeLink.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { scans: true } }, scans: { orderBy: { scannedAt: "desc" }, take: 1, select: { scannedAt: true } } },
  });
  const distinctVisitors = await prisma.qrCodeScan.findMany({
    where: { qrCodeLink: { organizationId }, visitorHash: { not: null } },
    distinct: ["visitorHash"],
    select: { visitorHash: true },
  });
  res.json({
    items: links.map((link) => presentLink(req, { ...link, scanCount: link._count.scans, lastScannedAt: link.scans[0]?.scannedAt ?? null, _count: undefined, scans: undefined })),
    summary: { totalLinks: links.length, activeLinks: links.filter((link) => link.active).length, totalScans: links.reduce((sum, link) => sum + link._count.scans, 0), uniqueVisitors: distinctVisitors.length },
  });
});

router.post("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) return res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const destinationUrl = parseQrDestination(req.body?.destinationUrl);
  const requestedSlug = req.body?.slug ? cleanQrSlug(req.body.slug) : null;
  if (!name || name.length > 160 || !destinationUrl || (req.body?.slug && !requestedSlug)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a name, a valid HTTP(S) destination, and an optional 3–64 character alias using letters, numbers, or hyphens." } });
  }
  const slug = requestedSlug ?? generatedSlug();
  const duplicate = await prisma.qrCodeLink.findUnique({ where: { slug }, select: { id: true } });
  if (duplicate) return res.status(409).json({ error: { code: "SLUG_TAKEN", message: "That short-link alias is already in use." } });
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Expiration date is invalid." } });
  const link = await prisma.qrCodeLink.create({ data: { organizationId, createdById: req.user?.sub, name, slug, destinationUrl, notes: typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 4000) || null : null, expiresAt } });
  await logAudit({ action: "QR_CODE_CREATED", entity: "QrCodeLink", entityId: link.id, organizationId, userId: req.user?.sub, metadata: { name, slug }, ipAddress: req.ip, userAgent: req.get("user-agent") });
  return res.status(201).json(presentLink(req, { ...link, scanCount: 0, lastScannedAt: null }));
});

router.get("/:id/analytics", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const link = organizationId ? await prisma.qrCodeLink.findFirst({ where: { id: req.params.id, organizationId } }) : null;
  if (!link) return res.status(404).json({ error: { code: "NOT_FOUND", message: "QR code not found." } });
  const requestedDays = Number.parseInt(String(req.query.days ?? "30"), 10);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const scans = await prisma.qrCodeScan.findMany({ where: { qrCodeLinkId: link.id, scannedAt: { gte: since } }, orderBy: { scannedAt: "desc" }, take: 5000 });
  const daily = new Map<string, number>();
  const devices = new Map<string, number>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(since); date.setUTCDate(since.getUTCDate() + offset); daily.set(date.toISOString().slice(0, 10), 0);
  }
  for (const scan of scans) {
    const day = scan.scannedAt.toISOString().slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
    devices.set(scan.deviceType, (devices.get(scan.deviceType) ?? 0) + 1);
  }
  res.json({
    link: presentLink(req, link), days,
    totals: { scans: scans.length, uniqueVisitors: new Set(scans.map((scan) => scan.visitorHash).filter(Boolean)).size },
    daily: Array.from(daily, ([date, count]) => ({ date, count })),
    devices: Array.from(devices, ([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count),
    recentScans: scans.slice(0, 50).map(({ id, scannedAt, deviceType: device, referrer }) => ({ id, scannedAt, device, referrer })),
  });
});

router.patch("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const existing = organizationId ? await prisma.qrCodeLink.findFirst({ where: { id: req.params.id, organizationId } }) : null;
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "QR code not found." } });
  const destinationUrl = req.body?.destinationUrl === undefined ? undefined : parseQrDestination(req.body.destinationUrl);
  const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
  if (destinationUrl === null || name === "" || (name && name.length > 160)) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a valid name and HTTP(S) destination." } });
  let expiresAt: Date | null | undefined;
  if (req.body?.expiresAt === null || req.body?.expiresAt === "") expiresAt = null;
  else if (req.body?.expiresAt !== undefined) { expiresAt = new Date(req.body.expiresAt); if (Number.isNaN(expiresAt.getTime())) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Expiration date is invalid." } }); }
  const link = await prisma.qrCodeLink.update({ where: { id: existing.id }, data: { ...(name !== undefined ? { name } : {}), ...(destinationUrl !== undefined ? { destinationUrl } : {}), ...(typeof req.body?.active === "boolean" ? { active: req.body.active } : {}), ...(expiresAt !== undefined ? { expiresAt } : {}), ...(req.body?.notes !== undefined ? { notes: String(req.body.notes).trim().slice(0, 4000) || null } : {}) } });
  await logAudit({ action: "QR_CODE_UPDATED", entity: "QrCodeLink", entityId: link.id, organizationId: organizationId ?? undefined, userId: req.user?.sub, metadata: { active: link.active }, ipAddress: req.ip, userAgent: req.get("user-agent") });
  return res.json(presentLink(req, link));
});

router.delete("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const existing = organizationId ? await prisma.qrCodeLink.findFirst({ where: { id: req.params.id, organizationId }, select: { id: true, slug: true } }) : null;
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "QR code not found." } });
  await prisma.qrCodeLink.delete({ where: { id: existing.id } });
  await logAudit({ action: "QR_CODE_DELETED", entity: "QrCodeLink", entityId: existing.id, organizationId: organizationId ?? undefined, userId: req.user?.sub, metadata: { slug: existing.slug }, ipAddress: req.ip, userAgent: req.get("user-agent") });
  return res.status(204).send();
});

export default router;
