/**
 * Webmaster persistent store service.
 * Uses raw SQL via Prisma to avoid generated-client model drift during bootstrap phases.
 */
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";

export type WebmasterSiteStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type WebmasterPageStatus = "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
export type WebmasterSiteType =
  | "MAIN_SITE"
  | "LANDING_SITE"
  | "TEMPORARY_SITE"
  | "EVENT_SITE"
  | "DONATION_SITE"
  | "CAMPAIGN_SITE"
  | "PARTNER_PORTAL"
  | "CLIENT_RESOURCE_SITE"
  | "INTERNAL_SITE"
  | "MICROSITE"
  | "BLOG_SITE";

export type WebmasterConnectedModule = "donor" | "events" | "compassion" | "communications" | "webmaster" | "platform";

export interface WebmasterSiteRecord {
  id: string;
  organizationId: string;
  createdById: string | null;
  ownerId: string | null;
  name: string;
  slug: string;
  siteType: WebmasterSiteType;
  sitePurpose: string | null;
  connectedModule: WebmasterConnectedModule | null;
  connectedRecordId: string | null;
  domain: string | null;
  subdomain: string | null;
  launchStatus: "NOT_READY" | "REVIEW_READY" | "READY_TO_LAUNCH" | "LIVE";
  seoHealthScore: number | null;
  publishingTarget: string | null;
  launchDate: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  lastPublishedAt: string | null;
  publishedVersionId: string | null;
  description: string | null;
  status: WebmasterSiteStatus;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebmasterPageRecord {
  id: string;
  organizationId: string;
  siteId: string;
  siteName: string;
  createdById: string | null;
  updatedById: string | null;
  title: string;
  slug: string;
  path: string;
  status: WebmasterPageStatus;
  contentJson: Record<string, unknown> | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebmasterPublishVersionRecord {
  id: string;
  organizationId: string;
  siteId: string;
  versionLabel: string;
  note: string | null;
  rollbackFromVersionId: string | null;
  snapshotJson: {
    site: WebmasterSiteRecord;
    pages: WebmasterPageRecord[];
  };
  createdById: string | null;
  createdAt: string;
}

let schemaReady = false;

/** Adds one column only when missing, compatible with MySQL variants lacking IF NOT EXISTS. */
async function ensureColumnExists(tableName: string, columnName: string, definition: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    tableName,
    columnName,
  );

  const exists = Number(rows[0]?.count ?? 0) > 0;
  if (exists) return;

  await prisma.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

/** Safely converts DB timestamps to ISO strings. */
function toIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

/** Ensures Webmaster site/page tables exist in the primary database. */
export async function ensureWebmasterSchema(): Promise<void> {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS webmaster_sites (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      created_by_id VARCHAR(64) NULL,
      owner_id VARCHAR(64) NULL,
      site_name VARCHAR(255) NOT NULL,
      site_slug VARCHAR(180) NOT NULL,
      site_type VARCHAR(64) NOT NULL DEFAULT 'MAIN_SITE',
      site_purpose TEXT NULL,
      connected_module VARCHAR(64) NULL,
      connected_record_id VARCHAR(128) NULL,
      domain VARCHAR(255) NULL,
      subdomain VARCHAR(255) NULL,
      launch_status VARCHAR(64) NOT NULL DEFAULT 'NOT_READY',
      seo_health_score INT NULL,
      publishing_target VARCHAR(128) NULL,
      launch_date DATETIME NULL,
      expires_at DATETIME NULL,
      archived_at DATETIME NULL,
      last_published_at DATETIME NULL,
      published_version_id VARCHAR(128) NULL,
      description TEXT NULL,
      site_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_webmaster_site_slug (organization_id, site_slug),
      INDEX idx_webmaster_site_status (organization_id, site_status, updated_at)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS webmaster_pages (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      site_id VARCHAR(64) NOT NULL,
      created_by_id VARCHAR(64) NULL,
      updated_by_id VARCHAR(64) NULL,
      page_title VARCHAR(255) NOT NULL,
      page_slug VARCHAR(180) NOT NULL,
      page_path VARCHAR(255) NOT NULL,
      page_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      content_json LONGTEXT NULL,
      seo_title VARCHAR(255) NULL,
      seo_description TEXT NULL,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_webmaster_page_slug (site_id, page_slug),
      UNIQUE KEY uniq_webmaster_page_path (site_id, page_path),
      INDEX idx_webmaster_page_status (organization_id, page_status, updated_at),
      CONSTRAINT fk_webmaster_pages_site FOREIGN KEY (site_id) REFERENCES webmaster_sites(id) ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS webmaster_publish_versions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      site_id VARCHAR(64) NOT NULL,
      version_label VARCHAR(64) NOT NULL,
      note TEXT NULL,
      rollback_from_version_id VARCHAR(64) NULL,
      snapshot_json LONGTEXT NOT NULL,
      created_by_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_webmaster_publish_versions_site (organization_id, site_id, created_at),
      CONSTRAINT fk_webmaster_publish_versions_site FOREIGN KEY (site_id) REFERENCES webmaster_sites(id) ON DELETE CASCADE
    )
  `);

  await ensureColumnExists("webmaster_sites", "owner_id", "owner_id VARCHAR(64) NULL");
  await ensureColumnExists("webmaster_sites", "site_type", "site_type VARCHAR(64) NOT NULL DEFAULT 'MAIN_SITE'");
  await ensureColumnExists("webmaster_sites", "site_purpose", "site_purpose TEXT NULL");
  await ensureColumnExists("webmaster_sites", "connected_module", "connected_module VARCHAR(64) NULL");
  await ensureColumnExists("webmaster_sites", "connected_record_id", "connected_record_id VARCHAR(128) NULL");
  await ensureColumnExists("webmaster_sites", "subdomain", "subdomain VARCHAR(255) NULL");
  await ensureColumnExists("webmaster_sites", "launch_status", "launch_status VARCHAR(64) NOT NULL DEFAULT 'NOT_READY'");
  await ensureColumnExists("webmaster_sites", "seo_health_score", "seo_health_score INT NULL");
  await ensureColumnExists("webmaster_sites", "publishing_target", "publishing_target VARCHAR(128) NULL");
  await ensureColumnExists("webmaster_sites", "launch_date", "launch_date DATETIME NULL");
  await ensureColumnExists("webmaster_sites", "expires_at", "expires_at DATETIME NULL");
  await ensureColumnExists("webmaster_sites", "archived_at", "archived_at DATETIME NULL");
  await ensureColumnExists("webmaster_sites", "last_published_at", "last_published_at DATETIME NULL");
  await ensureColumnExists("webmaster_sites", "published_version_id", "published_version_id VARCHAR(128) NULL");

  schemaReady = true;
}

/** Maps one raw site row into the typed API shape. */
function mapSiteRow(row: Record<string, unknown>): WebmasterSiteRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    createdById: row.created_by_id ? String(row.created_by_id) : null,
    ownerId: row.owner_id ? String(row.owner_id) : null,
    name: String(row.site_name),
    slug: String(row.site_slug),
    siteType: String(row.site_type ?? "MAIN_SITE") as WebmasterSiteType,
    sitePurpose: row.site_purpose ? String(row.site_purpose) : null,
    connectedModule: row.connected_module ? (String(row.connected_module) as WebmasterConnectedModule) : null,
    connectedRecordId: row.connected_record_id ? String(row.connected_record_id) : null,
    domain: row.domain ? String(row.domain) : null,
    subdomain: row.subdomain ? String(row.subdomain) : null,
    launchStatus: String(row.launch_status ?? "NOT_READY") as WebmasterSiteRecord["launchStatus"],
    seoHealthScore: row.seo_health_score === null || row.seo_health_score === undefined ? null : Number(row.seo_health_score),
    publishingTarget: row.publishing_target ? String(row.publishing_target) : null,
    launchDate: row.launch_date ? toIso(row.launch_date) : null,
    expiresAt: row.expires_at ? toIso(row.expires_at) : null,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    lastPublishedAt: row.last_published_at ? toIso(row.last_published_at) : null,
    publishedVersionId: row.published_version_id ? String(row.published_version_id) : null,
    description: row.description ? String(row.description) : null,
    status: String(row.site_status) as WebmasterSiteStatus,
    pageCount: Number(row.page_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Maps one raw page row into the typed API shape. */
function mapPageRow(row: Record<string, unknown>): WebmasterPageRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    siteId: String(row.site_id),
    siteName: String(row.site_name ?? ""),
    createdById: row.created_by_id ? String(row.created_by_id) : null,
    updatedById: row.updated_by_id ? String(row.updated_by_id) : null,
    title: String(row.page_title),
    slug: String(row.page_slug),
    path: String(row.page_path),
    status: String(row.page_status) as WebmasterPageStatus,
    contentJson: row.content_json ? (JSON.parse(String(row.content_json)) as Record<string, unknown>) : null,
    seoTitle: row.seo_title ? String(row.seo_title) : null,
    seoDescription: row.seo_description ? String(row.seo_description) : null,
    publishedAt: row.published_at ? toIso(row.published_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/** Maps one raw publish-version row into typed payload. */
function mapPublishVersionRow(row: Record<string, unknown>): WebmasterPublishVersionRecord {
  const rawSnapshot = row.snapshot_json ? JSON.parse(String(row.snapshot_json)) as {
    site?: WebmasterSiteRecord;
    pages?: WebmasterPageRecord[];
  } : {};

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    siteId: String(row.site_id),
    versionLabel: String(row.version_label ?? ""),
    note: row.note ? String(row.note) : null,
    rollbackFromVersionId: row.rollback_from_version_id ? String(row.rollback_from_version_id) : null,
    snapshotJson: {
      site: rawSnapshot.site as WebmasterSiteRecord,
      pages: Array.isArray(rawSnapshot.pages) ? rawSnapshot.pages : [],
    },
    createdById: row.created_by_id ? String(row.created_by_id) : null,
    createdAt: toIso(row.created_at),
  };
}

/** Lists sites for one organization with page counts. */
export async function listWebmasterSites(params: {
  organizationId: string;
  query?: string;
  status?: WebmasterSiteStatus;
  siteType?: WebmasterSiteType;
  connectedModule?: WebmasterConnectedModule;
  ownerId?: string;
  limit?: number;
}): Promise<WebmasterSiteRecord[]> {
  await ensureWebmasterSchema();
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 300);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT s.id, s.organization_id, s.created_by_id, s.site_name, s.site_slug, s.domain, s.description,
             s.owner_id, s.site_type, s.site_purpose, s.connected_module, s.connected_record_id, s.subdomain,
             s.launch_status, s.seo_health_score, s.publishing_target, s.launch_date, s.expires_at, s.archived_at,
             s.last_published_at, s.published_version_id,
             s.site_status, s.created_at, s.updated_at, COUNT(p.id) AS page_count
      FROM webmaster_sites s
      LEFT JOIN webmaster_pages p ON p.site_id = s.id
      WHERE s.organization_id = ?
        AND (? = '' OR s.site_status = ?)
        AND (? = '' OR s.site_type = ?)
        AND (? = '' OR IFNULL(s.connected_module, '') = ?)
        AND (? = '' OR IFNULL(s.owner_id, '') = ?)
        AND (
          ? = '' OR s.site_name LIKE CONCAT('%', ?, '%') OR s.site_slug LIKE CONCAT('%', ?, '%') OR IFNULL(s.domain, '') LIKE CONCAT('%', ?, '%')
        )
      GROUP BY s.id, s.organization_id, s.created_by_id, s.owner_id, s.site_name, s.site_slug, s.site_type,
               s.site_purpose, s.connected_module, s.connected_record_id, s.domain, s.subdomain, s.launch_status,
               s.seo_health_score, s.publishing_target, s.launch_date, s.expires_at, s.archived_at, s.last_published_at,
               s.published_version_id, s.description, s.site_status, s.created_at, s.updated_at
      ORDER BY s.updated_at DESC, s.site_name ASC
      LIMIT ?
    `,
    params.organizationId,
    params.status ?? "",
    params.status ?? "",
    params.siteType ?? "",
    params.siteType ?? "",
    params.connectedModule ?? "",
    params.connectedModule ?? "",
    params.ownerId ?? "",
    params.ownerId ?? "",
    params.query ?? "",
    params.query ?? "",
    params.query ?? "",
    params.query ?? "",
    limit,
  );

  return rows.map(mapSiteRow);
}

/** Gets one site scoped to organization ownership. */
export async function getWebmasterSiteById(params: {
  organizationId: string;
  siteId: string;
}): Promise<WebmasterSiteRecord | null> {
  const items = await listWebmasterSites({ organizationId: params.organizationId, limit: 300 });
  return items.find((site) => site.id === params.siteId) ?? null;
}

/** Creates one persisted site row. */
export async function createWebmasterSite(params: {
  organizationId: string;
  createdById?: string;
  ownerId?: string;
  name: string;
  slug: string;
  siteType?: WebmasterSiteType;
  sitePurpose?: string;
  connectedModule?: WebmasterConnectedModule;
  connectedRecordId?: string;
  domain?: string;
  subdomain?: string;
  launchStatus?: WebmasterSiteRecord["launchStatus"];
  seoHealthScore?: number | null;
  publishingTarget?: string;
  launchDate?: string;
  expiresAt?: string;
  lastPublishedAt?: string;
  publishedVersionId?: string;
  description?: string;
  status?: WebmasterSiteStatus;
}): Promise<WebmasterSiteRecord> {
  await ensureWebmasterSchema();
  const id = randomUUID();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO webmaster_sites
      (id, organization_id, created_by_id, owner_id, site_name, site_slug, site_type, site_purpose, connected_module, connected_record_id,
       domain, subdomain, launch_status, seo_health_score, publishing_target, launch_date, expires_at, archived_at, last_published_at,
       published_version_id, description, site_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    params.organizationId,
    params.createdById ?? null,
    params.ownerId ?? params.createdById ?? null,
    params.name,
    params.slug,
    params.siteType ?? "MAIN_SITE",
    params.sitePurpose?.trim() || null,
    params.connectedModule ?? null,
    params.connectedRecordId?.trim() || null,
    params.domain?.trim() || null,
    params.subdomain?.trim() || null,
    params.launchStatus ?? "NOT_READY",
    params.seoHealthScore ?? null,
    params.publishingTarget?.trim() || null,
    params.launchDate ? new Date(params.launchDate) : null,
    params.expiresAt ? new Date(params.expiresAt) : null,
    params.status === "ARCHIVED" ? new Date() : null,
    params.lastPublishedAt ? new Date(params.lastPublishedAt) : null,
    params.publishedVersionId?.trim() || null,
    params.description?.trim() || null,
    params.status ?? "DRAFT",
  );

  const created = await getWebmasterSiteById({ organizationId: params.organizationId, siteId: id });
  if (!created) {
    throw new Error("Created site could not be reloaded.");
  }
  return created;
}

/** Updates mutable site metadata with non-destructive archival support. */
export async function updateWebmasterSite(params: {
  organizationId: string;
  siteId: string;
  ownerId?: string;
  name?: string;
  slug?: string;
  siteType?: WebmasterSiteType;
  sitePurpose?: string;
  connectedModule?: WebmasterConnectedModule | null;
  connectedRecordId?: string | null;
  domain?: string | null;
  subdomain?: string | null;
  launchStatus?: WebmasterSiteRecord["launchStatus"];
  seoHealthScore?: number | null;
  publishingTarget?: string | null;
  launchDate?: string | null;
  expiresAt?: string | null;
  lastPublishedAt?: string | null;
  publishedVersionId?: string | null;
  description?: string;
  status?: WebmasterSiteStatus;
}): Promise<WebmasterSiteRecord> {
  await ensureWebmasterSchema();

  await prisma.$executeRawUnsafe(
    `
      UPDATE webmaster_sites
      SET owner_id = COALESCE(?, owner_id),
          site_name = COALESCE(?, site_name),
          site_slug = COALESCE(?, site_slug),
          site_type = COALESCE(?, site_type),
          site_purpose = COALESCE(?, site_purpose),
          connected_module = COALESCE(?, connected_module),
          connected_record_id = COALESCE(?, connected_record_id),
          domain = COALESCE(?, domain),
          subdomain = COALESCE(?, subdomain),
          launch_status = COALESCE(?, launch_status),
          seo_health_score = COALESCE(?, seo_health_score),
          publishing_target = COALESCE(?, publishing_target),
          launch_date = COALESCE(?, launch_date),
          expires_at = COALESCE(?, expires_at),
          last_published_at = COALESCE(?, last_published_at),
          published_version_id = COALESCE(?, published_version_id),
          description = COALESCE(?, description),
          site_status = COALESCE(?, site_status),
          archived_at = CASE
            WHEN ? = 'ARCHIVED' THEN IFNULL(archived_at, CURRENT_TIMESTAMP)
            WHEN ? = 'ACTIVE' THEN NULL
            ELSE archived_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND id = ?
    `,
    params.ownerId ?? null,
    params.name ?? null,
    params.slug ?? null,
    params.siteType ?? null,
    params.sitePurpose ?? null,
    params.connectedModule ?? null,
    params.connectedRecordId ?? null,
    params.domain ?? null,
    params.subdomain ?? null,
    params.launchStatus ?? null,
    params.seoHealthScore ?? null,
    params.publishingTarget ?? null,
    params.launchDate ? new Date(params.launchDate) : null,
    params.expiresAt ? new Date(params.expiresAt) : null,
    params.lastPublishedAt ? new Date(params.lastPublishedAt) : null,
    params.publishedVersionId ?? null,
    params.description ?? null,
    params.status ?? null,
    params.status ?? null,
    params.status ?? null,
    params.organizationId,
    params.siteId,
  );

  const updated = await getWebmasterSiteById({ organizationId: params.organizationId, siteId: params.siteId });
  if (!updated) throw new Error("Updated site could not be reloaded.");
  return updated;
}

/** Duplicates one site and all pages as a safe non-destructive clone. */
export async function duplicateWebmasterSite(params: {
  organizationId: string;
  sourceSiteId: string;
  createdById?: string;
  name?: string;
  slug?: string;
}): Promise<WebmasterSiteRecord> {
  await ensureWebmasterSchema();
  const source = await getWebmasterSiteById({ organizationId: params.organizationId, siteId: params.sourceSiteId });
  if (!source) throw new Error("Source site not found.");

  const newSite = await createWebmasterSite({
    organizationId: params.organizationId,
    createdById: params.createdById,
    ownerId: source.ownerId ?? params.createdById,
    name: params.name ?? `${source.name} Copy`,
    slug: params.slug ?? `${source.slug}-copy-${Date.now().toString().slice(-5)}`,
    siteType: source.siteType,
    sitePurpose: source.sitePurpose ?? undefined,
    connectedModule: source.connectedModule ?? undefined,
    connectedRecordId: source.connectedRecordId ?? undefined,
    domain: undefined,
    subdomain: undefined,
    launchStatus: "NOT_READY",
    seoHealthScore: source.seoHealthScore,
    publishingTarget: source.publishingTarget ?? undefined,
    description: source.description ?? undefined,
    status: "DRAFT",
  });

  const sourcePages = await listWebmasterPages({
    organizationId: params.organizationId,
    siteId: source.id,
    limit: 500,
  });

  for (const page of sourcePages) {
    await createWebmasterPage({
      organizationId: params.organizationId,
      siteId: newSite.id,
      createdById: params.createdById,
      updatedById: params.createdById,
      title: page.title,
      slug: `${page.slug}-${Date.now().toString().slice(-4)}`,
      path: `${page.path}-copy-${Date.now().toString().slice(-4)}`,
      status: "DRAFT",
      seoTitle: page.seoTitle ?? undefined,
      seoDescription: page.seoDescription ?? undefined,
      contentJson: page.contentJson ?? undefined,
    });
  }

  return newSite;
}

/** Lists pages under one site. */
export async function listWebmasterPages(params: {
  organizationId: string;
  siteId: string;
  query?: string;
  status?: WebmasterPageStatus;
  limit?: number;
}): Promise<WebmasterPageRecord[]> {
  await ensureWebmasterSchema();
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT p.id, p.organization_id, p.site_id, s.site_name, p.created_by_id, p.updated_by_id,
             p.page_title, p.page_slug, p.page_path, p.page_status, p.content_json, p.seo_title,
             p.seo_description, p.published_at, p.created_at, p.updated_at
      FROM webmaster_pages p
      INNER JOIN webmaster_sites s ON s.id = p.site_id
      WHERE p.organization_id = ?
        AND p.site_id = ?
        AND (? = '' OR p.page_status = ?)
        AND (
          ? = '' OR p.page_title LIKE CONCAT('%', ?, '%') OR p.page_slug LIKE CONCAT('%', ?, '%') OR p.page_path LIKE CONCAT('%', ?, '%')
        )
      ORDER BY p.updated_at DESC, p.page_title ASC
      LIMIT ?
    `,
    params.organizationId,
    params.siteId,
    params.status ?? "",
    params.status ?? "",
    params.query ?? "",
    params.query ?? "",
    params.query ?? "",
    params.query ?? "",
    limit,
  );

  return rows.map(mapPageRow);
}

/** Gets one page scoped to organization ownership. */
export async function getWebmasterPageById(params: {
  organizationId: string;
  pageId: string;
}): Promise<WebmasterPageRecord | null> {
  await ensureWebmasterSchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT p.id, p.organization_id, p.site_id, s.site_name, p.created_by_id, p.updated_by_id,
             p.page_title, p.page_slug, p.page_path, p.page_status, p.content_json, p.seo_title,
             p.seo_description, p.published_at, p.created_at, p.updated_at
      FROM webmaster_pages p
      INNER JOIN webmaster_sites s ON s.id = p.site_id
      WHERE p.organization_id = ? AND p.id = ?
      LIMIT 1
    `,
    params.organizationId,
    params.pageId,
  );

  if (rows.length === 0) return null;
  return mapPageRow(rows[0]);
}

/** Creates one persisted page record under a site. */
export async function createWebmasterPage(params: {
  organizationId: string;
  siteId: string;
  createdById?: string;
  updatedById?: string;
  title: string;
  slug: string;
  path: string;
  status?: WebmasterPageStatus;
  seoTitle?: string;
  seoDescription?: string;
  contentJson?: Record<string, unknown>;
}): Promise<WebmasterPageRecord> {
  await ensureWebmasterSchema();
  const id = randomUUID();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO webmaster_pages
      (id, organization_id, site_id, created_by_id, updated_by_id, page_title, page_slug, page_path, page_status, content_json, seo_title, seo_description, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    params.organizationId,
    params.siteId,
    params.createdById ?? null,
    params.updatedById ?? null,
    params.title,
    params.slug,
    params.path,
    params.status ?? "DRAFT",
    params.contentJson ? JSON.stringify(params.contentJson) : null,
    params.seoTitle?.trim() || null,
    params.seoDescription?.trim() || null,
    params.status === "PUBLISHED" ? new Date() : null,
  );

  const created = await getWebmasterPageById({ organizationId: params.organizationId, pageId: id });
  if (!created) {
    throw new Error("Created page could not be reloaded.");
  }
  return created;
}

/** Updates mutable page metadata for one persisted record. */
export async function updateWebmasterPage(params: {
  organizationId: string;
  pageId: string;
  updatedById?: string;
  title?: string;
  slug?: string;
  path?: string;
  status?: WebmasterPageStatus;
  seoTitle?: string;
  seoDescription?: string;
  contentJson?: Record<string, unknown>;
}): Promise<WebmasterPageRecord> {
  await ensureWebmasterSchema();

  await prisma.$executeRawUnsafe(
    `
      UPDATE webmaster_pages
      SET page_title = COALESCE(?, page_title),
          page_slug = COALESCE(?, page_slug),
          page_path = COALESCE(?, page_path),
          page_status = COALESCE(?, page_status),
          seo_title = COALESCE(?, seo_title),
          seo_description = COALESCE(?, seo_description),
          content_json = COALESCE(?, content_json),
          updated_by_id = ?,
          published_at = CASE
            WHEN ? = 'PUBLISHED' THEN CURRENT_TIMESTAMP
            WHEN ? = 'DRAFT' THEN NULL
            ELSE published_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND id = ?
    `,
    params.title ?? null,
    params.slug ?? null,
    params.path ?? null,
    params.status ?? null,
    params.seoTitle ?? null,
    params.seoDescription ?? null,
    params.contentJson ? JSON.stringify(params.contentJson) : null,
    params.updatedById ?? null,
    params.status ?? null,
    params.status ?? null,
    params.organizationId,
    params.pageId,
  );

  const updated = await getWebmasterPageById({ organizationId: params.organizationId, pageId: params.pageId });
  if (!updated) {
    throw new Error("Updated page could not be reloaded.");
  }
  return updated;
}

/** Searches persisted sites for module search. */
export async function searchWebmasterSites(params: {
  organizationId: string;
  query: string;
  limit: number;
}): Promise<WebmasterSiteRecord[]> {
  return listWebmasterSites({ organizationId: params.organizationId, query: params.query, limit: params.limit });
}

/** Searches persisted pages for module search. */
export async function searchWebmasterPages(params: {
  organizationId: string;
  query: string;
  limit: number;
}): Promise<WebmasterPageRecord[]> {
  await ensureWebmasterSchema();

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT p.id, p.organization_id, p.site_id, s.site_name, p.created_by_id, p.updated_by_id,
             p.page_title, p.page_slug, p.page_path, p.page_status, p.content_json, p.seo_title,
             p.seo_description, p.published_at, p.created_at, p.updated_at
      FROM webmaster_pages p
      INNER JOIN webmaster_sites s ON s.id = p.site_id
      WHERE p.organization_id = ?
        AND (
          p.page_title LIKE CONCAT('%', ?, '%')
          OR p.page_slug LIKE CONCAT('%', ?, '%')
          OR p.page_path LIKE CONCAT('%', ?, '%')
          OR s.site_name LIKE CONCAT('%', ?, '%')
        )
      ORDER BY p.updated_at DESC
      LIMIT ?
    `,
    params.organizationId,
    params.query,
    params.query,
    params.query,
    params.query,
    params.limit,
  );

  return rows.map(mapPageRow);
}

/** Lists pages in one status for Webmaster notifications. */
export async function listWebmasterPagesByStatus(params: {
  organizationId: string;
  status: WebmasterPageStatus;
  limit: number;
}): Promise<WebmasterPageRecord[]> {
  await ensureWebmasterSchema();

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT p.id, p.organization_id, p.site_id, s.site_name, p.created_by_id, p.updated_by_id,
             p.page_title, p.page_slug, p.page_path, p.page_status, p.content_json, p.seo_title,
             p.seo_description, p.published_at, p.created_at, p.updated_at
      FROM webmaster_pages p
      INNER JOIN webmaster_sites s ON s.id = p.site_id
      WHERE p.organization_id = ? AND p.page_status = ?
      ORDER BY p.updated_at DESC
      LIMIT ?
    `,
    params.organizationId,
    params.status,
    params.limit,
  );

  return rows.map(mapPageRow);
}

/** Lists sites in one status for Webmaster notifications. */
export async function listWebmasterSitesByStatus(params: {
  organizationId: string;
  status: WebmasterSiteStatus;
  limit: number;
}): Promise<WebmasterSiteRecord[]> {
  return listWebmasterSites({
    organizationId: params.organizationId,
    status: params.status,
    limit: params.limit,
  });
}

/** Persists one immutable publish snapshot for later rollback. */
export async function createWebmasterPublishVersion(params: {
  organizationId: string;
  siteId: string;
  createdById?: string;
  note?: string;
  rollbackFromVersionId?: string;
}): Promise<WebmasterPublishVersionRecord> {
  await ensureWebmasterSchema();

  const site = await getWebmasterSiteById({ organizationId: params.organizationId, siteId: params.siteId });
  if (!site) {
    throw new Error("Site not found for publish snapshot.");
  }

  const pages = await listWebmasterPages({ organizationId: params.organizationId, siteId: params.siteId, limit: 500 });
  const id = randomUUID();
  const versionLabel = `v${Date.now()}`;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO webmaster_publish_versions
      (id, organization_id, site_id, version_label, note, rollback_from_version_id, snapshot_json, created_by_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    id,
    params.organizationId,
    params.siteId,
    versionLabel,
    params.note?.trim() || null,
    params.rollbackFromVersionId?.trim() || null,
    JSON.stringify({ site, pages }),
    params.createdById ?? null,
  );

  const created = await getWebmasterPublishVersionById({ organizationId: params.organizationId, versionId: id });
  if (!created) {
    throw new Error("Publish version snapshot could not be reloaded.");
  }

  return created;
}

/** Lists publish version snapshots for one site. */
export async function listWebmasterPublishVersions(params: {
  organizationId: string;
  siteId: string;
  limit?: number;
}): Promise<WebmasterPublishVersionRecord[]> {
  await ensureWebmasterSchema();
  const limit = Math.min(Math.max(params.limit ?? 30, 1), 120);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, organization_id, site_id, version_label, note, rollback_from_version_id, snapshot_json, created_by_id, created_at
      FROM webmaster_publish_versions
      WHERE organization_id = ? AND site_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    params.organizationId,
    params.siteId,
    limit,
  );

  return rows.map(mapPublishVersionRow);
}

/** Gets one publish-version snapshot scoped by organization. */
export async function getWebmasterPublishVersionById(params: {
  organizationId: string;
  versionId: string;
}): Promise<WebmasterPublishVersionRecord | null> {
  await ensureWebmasterSchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, organization_id, site_id, version_label, note, rollback_from_version_id, snapshot_json, created_by_id, created_at
      FROM webmaster_publish_versions
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    params.organizationId,
    params.versionId,
  );

  if (rows.length === 0) return null;
  return mapPublishVersionRow(rows[0]);
}
