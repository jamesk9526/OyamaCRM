/**
 * OyamaWebMaster routes.
 * Provides first persisted APIs for websites and pages.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import {
  createWebmasterPage,
  createWebmasterPublishVersion,
  createWebmasterSite,
  duplicateWebmasterSite,
  getWebmasterPageById,
  getWebmasterPublishVersionById,
  getWebmasterSiteById,
  listWebmasterPages,
  listWebmasterPublishVersions,
  listWebmasterSites,
  WebmasterConnectedModule,
  WebmasterSiteType,
  updateWebmasterSite,
  updateWebmasterPage,
} from "../services/webmaster-store.js";
import { buildWebmasterPublishReadinessReport } from "../services/webmaster-publish-readiness.js";

const router = Router();

// All Webmaster APIs require an authenticated session.
router.use(requireAuth);

/** Normalizes arbitrary input into a URL-safe slug. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Returns true when a role may create or modify website records. */
function canWrite(role: string | undefined): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

/** Detects duplicate-key style DB errors from raw SQL calls. */
function isDuplicateEntryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return maybeMessage.includes("Duplicate entry") || maybeMessage.includes("ER_DUP_ENTRY");
}

/** Parses a query/body value as a valid site type. */
function parseSiteType(value: unknown): WebmasterSiteType | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().toUpperCase();
  const allowed: WebmasterSiteType[] = [
    "MAIN_SITE",
    "LANDING_SITE",
    "TEMPORARY_SITE",
    "EVENT_SITE",
    "DONATION_SITE",
    "CAMPAIGN_SITE",
    "PARTNER_PORTAL",
    "CLIENT_RESOURCE_SITE",
    "INTERNAL_SITE",
    "MICROSITE",
    "BLOG_SITE",
  ];
  return allowed.includes(normalized as WebmasterSiteType) ? (normalized as WebmasterSiteType) : undefined;
}

/** Parses a query/body value as a valid connected module. */
function parseConnectedModule(value: unknown): WebmasterConnectedModule | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const allowed: WebmasterConnectedModule[] = ["donor", "events", "compassion", "communications", "webmaster", "platform"];
  return allowed.includes(normalized as WebmasterConnectedModule) ? (normalized as WebmasterConnectedModule) : undefined;
}

/**
 * GET /api/webmaster/sites
 * Lists persisted website records for the active organization.
 */
router.get("/sites", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const query = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const siteType = parseSiteType(req.query.type);
  const connectedModule = parseConnectedModule(req.query.module);
  const ownerId = String(req.query.ownerId ?? "").trim();

  const items = await listWebmasterSites({
    organizationId,
    query,
    status: status ? (status as "DRAFT" | "ACTIVE" | "ARCHIVED") : undefined,
    siteType,
    connectedModule,
    ownerId: ownerId || undefined,
    limit: 100,
  });

  res.json({ items });
});

/**
 * POST /api/webmaster/sites
 * Creates a persisted website record.
 */
router.post("/sites", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const body = req.body as {
    name?: string;
    slug?: string;
    siteType?: WebmasterSiteType;
    sitePurpose?: string;
    connectedModule?: WebmasterConnectedModule;
    connectedRecordId?: string;
    domain?: string;
    subdomain?: string;
    launchStatus?: "NOT_READY" | "REVIEW_READY" | "READY_TO_LAUNCH" | "LIVE";
    launchDate?: string;
    expiresAt?: string;
    publishingTarget?: string;
    description?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  };

  const name = body.name?.trim();
  const slug = toSlug(body.slug?.trim() || name || "");

  if (!name || !slug) {
    res.status(400).json({
      error: {
        code: "WEBMASTER_SITE_VALIDATION",
        message: "name is required and must produce a valid slug.",
      },
    });
    return;
  }

  try {
    const created = await createWebmasterSite({
      organizationId,
      createdById: req.user?.sub,
      ownerId: req.user?.sub,
      name,
      slug,
      siteType: parseSiteType(body.siteType) ?? "MAIN_SITE",
      sitePurpose: body.sitePurpose,
      connectedModule: parseConnectedModule(body.connectedModule),
      connectedRecordId: body.connectedRecordId,
      domain: body.domain,
      subdomain: body.subdomain,
      launchStatus: body.launchStatus,
      launchDate: body.launchDate,
      expiresAt: body.expiresAt,
      publishingTarget: body.publishingTarget,
      description: body.description,
      status: body.status ?? "DRAFT",
    });

    await logAudit({
      action: "WEBMASTER_SITE_CREATED",
      entity: "WebmasterSite",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        slug: created.slug,
        siteType: created.siteType,
        status: created.status,
        domain: created.domain,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      res.status(409).json({ error: { code: "WEBMASTER_SITE_CONFLICT", message: "Site slug already exists." } });
      return;
    }
    throw error;
  }
});

/**
 * PATCH /api/webmaster/sites/:siteId
 * Updates persisted site metadata and lifecycle state.
 */
router.patch("/sites/:siteId", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const existing = await getWebmasterSiteById({ organizationId, siteId });
  if (!existing) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const body = req.body as {
    name?: string;
    slug?: string;
    siteType?: WebmasterSiteType;
    sitePurpose?: string;
    connectedModule?: WebmasterConnectedModule | null;
    connectedRecordId?: string | null;
    domain?: string | null;
    subdomain?: string | null;
    launchStatus?: "NOT_READY" | "REVIEW_READY" | "READY_TO_LAUNCH" | "LIVE";
    seoHealthScore?: number | null;
    publishingTarget?: string | null;
    launchDate?: string | null;
    expiresAt?: string | null;
    lastPublishedAt?: string | null;
    publishedVersionId?: string | null;
    description?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  };

  try {
    const updated = await updateWebmasterSite({
      organizationId,
      siteId,
      name: body.name?.trim(),
      slug: body.slug ? toSlug(body.slug) : undefined,
      siteType: parseSiteType(body.siteType),
      sitePurpose: body.sitePurpose,
      connectedModule: body.connectedModule === null ? null : parseConnectedModule(body.connectedModule),
      connectedRecordId: body.connectedRecordId,
      domain: body.domain,
      subdomain: body.subdomain,
      launchStatus: body.launchStatus,
      seoHealthScore: body.seoHealthScore,
      publishingTarget: body.publishingTarget,
      launchDate: body.launchDate,
      expiresAt: body.expiresAt,
      lastPublishedAt: body.lastPublishedAt,
      publishedVersionId: body.publishedVersionId,
      description: body.description,
      status: body.status,
    });

    await logAudit({
      action: "WEBMASTER_SITE_UPDATED",
      entity: "WebmasterSite",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        siteType: updated.siteType,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ item: updated });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      res.status(409).json({ error: { code: "WEBMASTER_SITE_CONFLICT", message: "Updated site slug conflicts with another site." } });
      return;
    }
    throw error;
  }
});

/**
 * POST /api/webmaster/sites/:siteId/archive
 * Soft-archives a site without deleting pages.
 */
router.post("/sites/:siteId/archive", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const existing = await getWebmasterSiteById({ organizationId, siteId });
  if (!existing) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const updated = await updateWebmasterSite({ organizationId, siteId, status: "ARCHIVED" });

  await logAudit({
    action: "WEBMASTER_SITE_ARCHIVED",
    entity: "WebmasterSite",
    entityId: siteId,
    userId: req.user?.sub,
    organizationId,
    metadata: { previousStatus: existing.status },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ item: updated });
});

/**
 * POST /api/webmaster/sites/:siteId/restore
 * Restores an archived site back to active drafting lifecycle.
 */
router.post("/sites/:siteId/restore", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const existing = await getWebmasterSiteById({ organizationId, siteId });
  if (!existing) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const updated = await updateWebmasterSite({
    organizationId,
    siteId,
    status: existing.status === "ARCHIVED" ? "DRAFT" : existing.status,
  });

  await logAudit({
    action: "WEBMASTER_SITE_RESTORED",
    entity: "WebmasterSite",
    entityId: siteId,
    userId: req.user?.sub,
    organizationId,
    metadata: { previousStatus: existing.status, status: updated.status },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ item: updated });
});

/**
 * POST /api/webmaster/sites/:siteId/duplicate
 * Creates a safe duplicate of a site and its pages.
 */
router.post("/sites/:siteId/duplicate", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const existing = await getWebmasterSiteById({ organizationId, siteId });
  if (!existing) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const body = req.body as { name?: string; slug?: string };

  try {
    const created = await duplicateWebmasterSite({
      organizationId,
      sourceSiteId: siteId,
      createdById: req.user?.sub,
      name: body.name?.trim(),
      slug: body.slug ? toSlug(body.slug) : undefined,
    });

    await logAudit({
      action: "WEBMASTER_SITE_DUPLICATED",
      entity: "WebmasterSite",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { sourceSiteId: existing.id, sourceSlug: existing.slug, duplicateSlug: created.slug },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      res.status(409).json({ error: { code: "WEBMASTER_SITE_CONFLICT", message: "Duplicate site slug already exists." } });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/webmaster/sites/:siteId/pages
 * Lists page records under one persisted site.
 */
router.get("/sites/:siteId/pages", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });

  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const query = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "").trim();

  const items = await listWebmasterPages({
    organizationId,
    siteId,
    query,
    status: status ? (status as "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED") : undefined,
    limit: 200,
  });

  res.json({ items });
});

/**
 * GET /api/webmaster/sites/:siteId/publish-readiness
 * Returns publish preflight readiness checks for a selected site.
 */
router.get("/sites/:siteId/publish-readiness", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });

  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const pages = await listWebmasterPages({ organizationId, siteId, limit: 500 });
  const readiness = buildWebmasterPublishReadinessReport({ site, pages });

  res.json({
    data: readiness,
  });
});

/**
 * GET /api/webmaster/sites/:siteId/publish-versions
 * Returns immutable publish snapshot history used for rollback.
 */
router.get("/sites/:siteId/publish-versions", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });
  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const items = await listWebmasterPublishVersions({ organizationId, siteId, limit: 30 });
  res.json({ items });
});

/**
 * POST /api/webmaster/sites/:siteId/publish
 * Creates immutable publish snapshot and marks draft pages as published.
 */
router.post("/sites/:siteId/publish", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });
  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const body = req.body as { confirm?: boolean; note?: string };
  if (body.confirm !== true) {
    res.status(400).json({
      error: { code: "WEBMASTER_PUBLISH_CONFIRM_REQUIRED", message: "Set confirm=true to execute publish." },
    });
    return;
  }

  const pages = await listWebmasterPages({ organizationId, siteId, limit: 500 });
  const readiness = buildWebmasterPublishReadinessReport({ site, pages });
  if (!readiness.preflightPassed) {
    res.status(409).json({
      error: {
        code: "WEBMASTER_PUBLISH_PREFLIGHT_FAILED",
        message: "Publish preflight checks failed. Resolve blockers before publishing.",
      },
      data: readiness,
    });
    return;
  }

  for (const page of pages) {
    if (page.status === "ARCHIVED") continue;
    if (page.status !== "PUBLISHED") {
      await updateWebmasterPage({
        organizationId,
        pageId: page.id,
        status: "PUBLISHED",
        updatedById: req.user?.sub,
      });
    }
  }

  const version = await createWebmasterPublishVersion({
    organizationId,
    siteId,
    createdById: req.user?.sub,
    note: body.note,
  });

  const updatedSite = await updateWebmasterSite({
    organizationId,
    siteId,
    status: "ACTIVE",
    lastPublishedAt: new Date().toISOString(),
    publishedVersionId: version.id,
  });

  await logAudit({
    action: "WEBMASTER_SITE_PUBLISHED",
    entity: "WebmasterSite",
    entityId: siteId,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      publishedVersionId: version.id,
      note: body.note ?? null,
      pageCount: pages.length,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    item: {
      site: updatedSite,
      version,
    },
  });
});

/**
 * POST /api/webmaster/sites/:siteId/rollback
 * Restores page and site snapshot from selected publish version.
 */
router.post("/sites/:siteId/rollback", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });
  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const body = req.body as { confirm?: boolean; versionId?: string; note?: string };
  if (body.confirm !== true) {
    res.status(400).json({
      error: { code: "WEBMASTER_ROLLBACK_CONFIRM_REQUIRED", message: "Set confirm=true to execute rollback." },
    });
    return;
  }

  const versionId = String(body.versionId ?? "").trim();
  if (!versionId) {
    res.status(400).json({ error: { code: "WEBMASTER_ROLLBACK_VERSION_REQUIRED", message: "versionId is required." } });
    return;
  }

  const version = await getWebmasterPublishVersionById({ organizationId, versionId });
  if (!version || version.siteId !== siteId) {
    res.status(404).json({ error: { code: "WEBMASTER_PUBLISH_VERSION_NOT_FOUND", message: "Publish version not found." } });
    return;
  }

  const snapshot = version.snapshotJson;
  const snapshotPages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
  const currentPages = await listWebmasterPages({ organizationId, siteId, limit: 500 });
  const currentById = new Map(currentPages.map((page) => [page.id, page]));

  for (const currentPage of currentPages) {
    const keep = snapshotPages.some((snapshotPage) => snapshotPage.id === currentPage.id);
    if (!keep && currentPage.status !== "ARCHIVED") {
      await updateWebmasterPage({
        organizationId,
        pageId: currentPage.id,
        status: "ARCHIVED",
        updatedById: req.user?.sub,
      });
    }
  }

  for (const snapshotPage of snapshotPages) {
    const existingPage = currentById.get(snapshotPage.id);
    if (existingPage) {
      await updateWebmasterPage({
        organizationId,
        pageId: existingPage.id,
        title: snapshotPage.title,
        slug: snapshotPage.slug,
        path: snapshotPage.path,
        status: snapshotPage.status === "ARCHIVED" ? "ARCHIVED" : "PUBLISHED",
        seoTitle: snapshotPage.seoTitle ?? undefined,
        seoDescription: snapshotPage.seoDescription ?? undefined,
        contentJson: snapshotPage.contentJson ?? undefined,
        updatedById: req.user?.sub,
      });
      continue;
    }

    await createWebmasterPage({
      organizationId,
      siteId,
      title: snapshotPage.title,
      slug: `${snapshotPage.slug}-${Date.now().toString().slice(-4)}`,
      path: `${snapshotPage.path}-restored-${Date.now().toString().slice(-4)}`,
      status: snapshotPage.status === "ARCHIVED" ? "ARCHIVED" : "PUBLISHED",
      seoTitle: snapshotPage.seoTitle ?? undefined,
      seoDescription: snapshotPage.seoDescription ?? undefined,
      contentJson: snapshotPage.contentJson ?? undefined,
      createdById: req.user?.sub,
      updatedById: req.user?.sub,
    });
  }

  const rollbackVersion = await createWebmasterPublishVersion({
    organizationId,
    siteId,
    createdById: req.user?.sub,
    rollbackFromVersionId: versionId,
    note: body.note ?? `Rollback to ${version.versionLabel}`,
  });

  const updatedSite = await updateWebmasterSite({
    organizationId,
    siteId,
    lastPublishedAt: new Date().toISOString(),
    publishedVersionId: rollbackVersion.id,
    status: "ACTIVE",
  });

  await logAudit({
    action: "WEBMASTER_SITE_ROLLBACK_EXECUTED",
    entity: "WebmasterSite",
    entityId: siteId,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      targetVersionId: versionId,
      rollbackVersionId: rollbackVersion.id,
      note: body.note ?? null,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    item: {
      site: updatedSite,
      version: rollbackVersion,
    },
  });
});

/**
 * POST /api/webmaster/sites/:siteId/pages
 * Creates a persisted page record under one site.
 */
router.post("/sites/:siteId/pages", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const siteId = req.params.siteId;
  const site = await getWebmasterSiteById({ organizationId, siteId });

  if (!site) {
    res.status(404).json({ error: { code: "WEBMASTER_SITE_NOT_FOUND", message: "Site not found." } });
    return;
  }

  const body = req.body as {
    title?: string;
    slug?: string;
    path?: string;
    status?: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
    seoTitle?: string;
    seoDescription?: string;
    contentJson?: Record<string, unknown>;
  };

  const title = body.title?.trim();
  const slug = toSlug(body.slug?.trim() || title || "");
  const path = body.path?.trim() || `/${slug}`;

  if (!title || !slug || !path) {
    res.status(400).json({
      error: {
        code: "WEBMASTER_PAGE_VALIDATION",
        message: "title is required and must produce a valid slug/path.",
      },
    });
    return;
  }

  try {
    const created = await createWebmasterPage({
      organizationId,
      siteId,
      title,
      slug,
      path,
      status: body.status ?? "DRAFT",
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      contentJson: body.contentJson,
      createdById: req.user?.sub,
      updatedById: req.user?.sub,
    });

    await logAudit({
      action: "WEBMASTER_PAGE_CREATED",
      entity: "WebmasterPage",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        siteId,
        slug: created.slug,
        path: created.path,
        status: created.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      res.status(409).json({ error: { code: "WEBMASTER_PAGE_CONFLICT", message: "Page slug/path already exists for this site." } });
      return;
    }
    throw error;
  }
});

/**
 * PATCH /api/webmaster/pages/:pageId
 * Updates persisted page metadata including status transitions.
 */
router.patch("/pages/:pageId", async (req, res) => {
  if (!canWrite(req.user?.role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for Webmaster write actions." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const pageId = req.params.pageId;
  const existing = await getWebmasterPageById({ organizationId, pageId });

  if (!existing) {
    res.status(404).json({ error: { code: "WEBMASTER_PAGE_NOT_FOUND", message: "Page not found." } });
    return;
  }

  const body = req.body as {
    title?: string;
    slug?: string;
    path?: string;
    status?: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
    seoTitle?: string;
    seoDescription?: string;
    contentJson?: Record<string, unknown>;
  };

  const nextSlug = body.slug ? toSlug(body.slug) : undefined;

  try {
    const updated = await updateWebmasterPage({
      organizationId,
      pageId,
      title: body.title?.trim(),
      slug: nextSlug,
      path: body.path?.trim(),
      status: body.status,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      contentJson: body.contentJson,
      updatedById: req.user?.sub,
    });

    await logAudit({
      action: "WEBMASTER_PAGE_UPDATED",
      entity: "WebmasterPage",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ item: updated });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      res.status(409).json({ error: { code: "WEBMASTER_PAGE_CONFLICT", message: "Updated slug/path conflicts with another page." } });
      return;
    }
    throw error;
  }
});

export default router;
