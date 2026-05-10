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
  createWebmasterSite,
  getWebmasterPageById,
  getWebmasterSiteById,
  listWebmasterPages,
  listWebmasterSites,
  updateWebmasterPage,
} from "../services/webmaster-store.js";

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

  const items = await listWebmasterSites({
    organizationId,
    query,
    status: status ? (status as "DRAFT" | "ACTIVE" | "ARCHIVED") : undefined,
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
    domain?: string;
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
      name,
      slug,
      domain: body.domain,
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
