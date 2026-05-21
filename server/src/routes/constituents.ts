/**
 * Constituent (contact) management routes for OyamaCRM.
 * Provides CRUD operations for the core nonprofit constituent record —
 * donors, volunteers, members, and prospects.
 * Includes automatic Household record creation when a constituent of type
 * HOUSEHOLD is created or updated.
 *
 * Routes:
 *   GET    /api/constituents         — list/search constituents
 *   GET    /api/constituents/:id     — full constituent profile with donations, tasks, tags, household
 *   POST   /api/constituents         — create a new constituent
 *   POST   /api/constituents/import  — batch-import from mapped CSV (dry-run supported)
 *   GET    /api/constituents/import/history — recent import runs with rollback status
 *   POST   /api/constituents/import/:runId/rollback/preview — rollback safety preview
 *   POST   /api/constituents/import/:runId/rollback — execute guarded rollback
 *   PUT    /api/constituents/:id     — update an existing constituent
 *   DELETE /api/constituents/:id     — delete a constituent
 *
 * @module routes/constituents
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { executeStewardPathsForTrigger } from "../services/stewardPathsEngine.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import type { DonorStatus, ConstituentType, ActivityType, Prisma, Tag } from "@prisma/client";

const router = Router();

// All constituent routes require a valid JWT — applied once for the entire router.
router.use(requireAuth);

// Fine-grained permission checks by HTTP method keep role defaults + explicit overrides in sync.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:constituents")(req, res, next);
  }
  if (req.method === "POST" && req.path === "/import") {
    return requirePermission("import:data")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    return requirePermission("edit:constituents")(req, res, next);
  }
  if (req.method === "DELETE") {
    return requirePermission("delete:constituents")(req, res, next);
  }
  return next();
});

/**
 * Minimal field set returned in list responses and household member arrays.
 * Keeps payload size small when full profile data is not needed.
 */
const CONSTITUENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  employer: true,
  occupation: true,
  city: true,
  state: true,
  type: true,
  donorStatus: true,
  totalLifetimeGiving: true,
  totalYtdGiving: true,
  lastGiftDate: true,
  lastGiftAmount: true,
  giftCount: true,
  engagementScore: true,
  tags: { include: { tag: { select: { name: true, color: true } } } },
};

/**
 * Compact field set used when a constituent appears as a household member.
 * Avoids over-fetching nested data in relationship views.
 */
const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  prefix: true,
  email: true,
  phone: true,
  type: true,
  donorStatus: true,
  isPrimaryContact: true,
  totalLifetimeGiving: true,
};

const normalizeTagNames = (values: unknown, limit = 30): string[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim().slice(0, 80))
        .filter(Boolean),
    ),
  ).slice(0, limit);
};

const normalizeTagColor = (value: unknown, fallback = "#16a34a"): string => {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
};

type ConstituentSearchSortable = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function constituentSearchRank(row: ConstituentSearchSortable, query: string): number {
  const q = normalizeSearchText(query);
  const first = normalizeSearchText(row.firstName);
  const last = normalizeSearchText(row.lastName);
  const full = `${first} ${last}`.trim();
  const email = normalizeSearchText(row.email);
  const phone = normalizeSearchText(row.phone);

  if (!q) return 999;
  if (first.startsWith(q)) return 0;
  if (last.startsWith(q)) return 1;
  if (full.startsWith(q)) return 2;
  if (first.includes(q)) return 3;
  if (last.includes(q)) return 4;
  if (email.startsWith(q)) return 5;
  if (phone.startsWith(q)) return 6;
  if (email.includes(q)) return 7;
  if (phone.includes(q)) return 8;
  return 999;
}

function sortConstituentsBySearchRelevance<T extends ConstituentSearchSortable>(rows: T[], query: string): T[] {
  const q = normalizeSearchText(query);
  if (!q) return rows;

  const withRank = rows.map((row) => ({
    row,
    rank: constituentSearchRank(row, q),
    name: `${normalizeSearchText(row.firstName)} ${normalizeSearchText(row.lastName)}`.trim(),
  }));

  const nameMatched = withRank.filter((entry) => entry.rank <= 4);
  const otherMatched = withRank.filter((entry) => entry.rank > 4);
  const rankThenName = (a: (typeof withRank)[number], b: (typeof withRank)[number]) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.name.localeCompare(b.name);
  };

  // Single/short queries should prioritize actual name matches over email-domain noise.
  if (q.length <= 2 && nameMatched.length > 0) {
    return nameMatched.sort(rankThenName).map((entry) => entry.row);
  }

  return [
    ...nameMatched.sort(rankThenName),
    ...otherMatched.sort(rankThenName),
  ].map((entry) => entry.row);
}

const CONSTITUENT_IMPORT_ROLLBACK_WINDOW_HOURS = 72;
const CONSTITUENT_IMPORT_MAX_UPDATED_SNAPSHOTS = 1000;
const CONSTITUENT_IMPORT_ROLLBACK_CONFIRM_PREFIX = "ROLLBACK-CONSTITUENT-IMPORT";
const CONSTITUENT_IMPORT_ROLLBACK_CHANGE_TOLERANCE_MS = 2_000;

const CONSTITUENT_IMPORT_ROLLBACK_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  prefix: true,
  email: true,
  email2: true,
  phone: true,
  mobile: true,
  phone2: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  country: true,
  birthDate: true,
  employer: true,
  occupation: true,
  doNotEmail: true,
  doNotCall: true,
  doNotMail: true,
  doNotContact: true,
  emailOptOut: true,
  notes: true,
  donorStatus: true,
  externalId: true,
  type: true,
  tags: { select: { tagId: true } },
} as const;

type ConstituentImportRollbackRecord = Prisma.ConstituentGetPayload<{
  select: typeof CONSTITUENT_IMPORT_ROLLBACK_SELECT;
}>;

const CONSTITUENT_IMPORT_DELETE_GUARD_SELECT = {
  id: true,
  updatedAt: true,
  headOf: { select: { id: true } },
  _count: {
    select: {
      donations: true,
      tasks: true,
      meetings: true,
      activities: true,
      eventAttendances: true,
      eventOrders: true,
      eventGuests: true,
      eventSponsors: true,
      volunteerHours: true,
      pledges: true,
      compassionClients: true,
      stewardPathEnrollments: true,
      stewardPathEmailDrafts: true,
      generatedLetters: true,
      emailSubscriptions: true,
      emailConsentEvents: true,
      emailSuppressions: true,
      emailSendRecipients: true,
    },
  },
} as const;

type ConstituentImportDeleteGuardRecord = Prisma.ConstituentGetPayload<{
  select: typeof CONSTITUENT_IMPORT_DELETE_GUARD_SELECT;
}>;

type ConstituentImportMode = "create_only" | "upsert" | "update_only";

interface ConstituentRollbackScalarSnapshot {
  firstName: string;
  lastName: string;
  prefix: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  mobile: string | null;
  phone2: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  birthDate: string | null;
  employer: string | null;
  occupation: string | null;
  doNotEmail: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
  notes: string | null;
  donorStatus: DonorStatus;
  externalId: string | null;
  type: ConstituentType;
}

interface ConstituentImportUpdatedSnapshot {
  id: string;
  before: ConstituentRollbackScalarSnapshot;
  tagIds: string[];
}

interface ConstituentImportRollbackSummary {
  deletedCreated: number;
  restoredUpdated: number;
  blockedCreated: number;
  blockedUpdated: number;
}

interface ConstituentImportRunMetadata {
  importRunId: string;
  source: "constituents_csv";
  mode: ConstituentImportMode;
  recordCount: number;
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  duplicatesInFile: number;
  createdIds: string[];
  updatedSnapshots: ConstituentImportUpdatedSnapshot[];
  rollbackSupported: boolean;
  rollbackTrackingTruncated: boolean;
  completedAt: string;
  rollbackEligibleUntil: string;
  rolledBackAt?: string;
  rolledBackBy?: string;
  rollbackSummary?: ConstituentImportRollbackSummary;
}

interface ConstituentImportRollbackPlan {
  canRollback: boolean;
  blockedReasons: string[];
  safeDeleteCreatedIds: string[];
  safeRestoreUpdatedSnapshots: ConstituentImportUpdatedSnapshot[];
  blockedCreated: Array<{ id: string; reason: string }>;
  blockedUpdated: Array<{ id: string; reason: string }>;
}

function normalizeImportValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeImportPhoneDigits(raw?: string): string {
  return (raw ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function buildConstituentInFileDedupKey(rec: Record<string, string>): string {
  const extId = normalizeImportValue(rec.externalId ?? "");
  if (extId) return `ext:${extId}`;

  const email = normalizeImportValue(rec.email ?? "");
  if (email) return `email:${email}`;

  const phone = normalizeImportPhoneDigits(rec.phone ?? rec.mobilePhone ?? rec.workPhone);
  if (phone.length >= 7) return `phone:${phone}`;

  const normalizedEntries = Object.entries(rec)
    .filter(([key, value]) => key !== "_isOrg" && (value ?? "").trim().length > 0)
    .map(([key, value]) => `${key}=${normalizeImportValue(value ?? "")}`)
    .sort();

  return `row:${normalizedEntries.join("|")}`;
}

function toConstituentRollbackSnapshot(record: ConstituentImportRollbackRecord): ConstituentRollbackScalarSnapshot {
  return {
    firstName: record.firstName,
    lastName: record.lastName,
    prefix: record.prefix,
    email: record.email,
    email2: record.email2,
    phone: record.phone,
    mobile: record.mobile,
    phone2: record.phone2,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    zip: record.zip,
    country: record.country,
    birthDate: record.birthDate ? record.birthDate.toISOString() : null,
    employer: record.employer,
    occupation: record.occupation,
    doNotEmail: record.doNotEmail,
    doNotCall: record.doNotCall,
    doNotMail: record.doNotMail,
    doNotContact: record.doNotContact,
    emailOptOut: record.emailOptOut,
    notes: record.notes,
    donorStatus: record.donorStatus,
    externalId: record.externalId,
    type: record.type,
  };
}

function snapshotToConstituentUpdateData(snapshot: ConstituentRollbackScalarSnapshot): Prisma.ConstituentUpdateInput {
  return {
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    prefix: snapshot.prefix,
    email: snapshot.email,
    email2: snapshot.email2,
    phone: snapshot.phone,
    mobile: snapshot.mobile,
    phone2: snapshot.phone2,
    addressLine1: snapshot.addressLine1,
    addressLine2: snapshot.addressLine2,
    city: snapshot.city,
    state: snapshot.state,
    zip: snapshot.zip,
    country: snapshot.country,
    birthDate: snapshot.birthDate ? new Date(snapshot.birthDate) : null,
    employer: snapshot.employer,
    occupation: snapshot.occupation,
    doNotEmail: snapshot.doNotEmail,
    doNotCall: snapshot.doNotCall,
    doNotMail: snapshot.doNotMail,
    doNotContact: snapshot.doNotContact,
    emailOptOut: snapshot.emailOptOut,
    notes: snapshot.notes,
    donorStatus: snapshot.donorStatus,
    externalId: snapshot.externalId,
    type: snapshot.type,
  };
}

function readConstituentImportRunMetadata(raw: Prisma.JsonValue | null): ConstituentImportRunMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Partial<ConstituentImportRunMetadata>;
  if (typeof candidate.importRunId !== "string") return null;
  if (!Array.isArray(candidate.createdIds) || !Array.isArray(candidate.updatedSnapshots)) return null;
  return {
    importRunId: candidate.importRunId,
    source: "constituents_csv",
    mode: (candidate.mode ?? "create_only") as ConstituentImportMode,
    recordCount: Number(candidate.recordCount ?? 0),
    created: Number(candidate.created ?? 0),
    updated: Number(candidate.updated ?? 0),
    skipped: Number(candidate.skipped ?? 0),
    errorCount: Number(candidate.errorCount ?? 0),
    duplicatesInFile: Number(candidate.duplicatesInFile ?? 0),
    createdIds: candidate.createdIds.filter((id): id is string => typeof id === "string"),
    updatedSnapshots: candidate.updatedSnapshots as ConstituentImportUpdatedSnapshot[],
    rollbackSupported: Boolean(candidate.rollbackSupported),
    rollbackTrackingTruncated: Boolean(candidate.rollbackTrackingTruncated),
    completedAt: String(candidate.completedAt ?? ""),
    rollbackEligibleUntil: String(candidate.rollbackEligibleUntil ?? ""),
    rolledBackAt: typeof candidate.rolledBackAt === "string" ? candidate.rolledBackAt : undefined,
    rolledBackBy: typeof candidate.rolledBackBy === "string" ? candidate.rolledBackBy : undefined,
    rollbackSummary: candidate.rollbackSummary,
  };
}

function countConstituentDeleteGuards(row: ConstituentImportDeleteGuardRecord): number {
  const relationCount = row._count.donations
    + row._count.tasks
    + row._count.meetings
    + row._count.activities
    + row._count.eventAttendances
    + row._count.eventOrders
    + row._count.eventGuests
    + row._count.eventSponsors
    + row._count.volunteerHours
    + row._count.pledges
    + row._count.compassionClients
    + row._count.stewardPathEnrollments
    + row._count.stewardPathEmailDrafts
    + row._count.generatedLetters
    + row._count.emailSubscriptions
    + row._count.emailConsentEvents
    + row._count.emailSuppressions
    + row._count.emailSendRecipients;
  return relationCount + (row.headOf ? 1 : 0);
}

async function buildConstituentImportRollbackPlan(params: {
  organizationId: string;
  metadata: ConstituentImportRunMetadata;
}): Promise<ConstituentImportRollbackPlan> {
  const { organizationId, metadata } = params;
  const blockedReasons: string[] = [];
  const safeDeleteCreatedIds: string[] = [];
  const safeRestoreUpdatedSnapshots: ConstituentImportUpdatedSnapshot[] = [];
  const blockedCreated: Array<{ id: string; reason: string }> = [];
  const blockedUpdated: Array<{ id: string; reason: string }> = [];

  if (!metadata.rollbackSupported) {
    blockedReasons.push("Rollback is unavailable for this run because safety snapshots were truncated.");
    return { canRollback: false, blockedReasons, safeDeleteCreatedIds, safeRestoreUpdatedSnapshots, blockedCreated, blockedUpdated };
  }

  if (metadata.rolledBackAt) {
    blockedReasons.push("This import run has already been rolled back.");
    return { canRollback: false, blockedReasons, safeDeleteCreatedIds, safeRestoreUpdatedSnapshots, blockedCreated, blockedUpdated };
  }

  const completedAt = new Date(metadata.completedAt);
  const rollbackEligibleUntil = new Date(metadata.rollbackEligibleUntil);
  if (Number.isNaN(completedAt.getTime())) {
    blockedReasons.push("Import metadata is missing a valid completion timestamp.");
    return { canRollback: false, blockedReasons, safeDeleteCreatedIds, safeRestoreUpdatedSnapshots, blockedCreated, blockedUpdated };
  }
  if (!Number.isNaN(rollbackEligibleUntil.getTime()) && Date.now() > rollbackEligibleUntil.getTime()) {
    blockedReasons.push("Rollback window expired for this import run.");
    return { canRollback: false, blockedReasons, safeDeleteCreatedIds, safeRestoreUpdatedSnapshots, blockedCreated, blockedUpdated };
  }

  const [createdRows, updatedRows] = await Promise.all([
    metadata.createdIds.length > 0
      ? prisma.constituent.findMany({
          where: { organizationId, id: { in: metadata.createdIds } },
          select: CONSTITUENT_IMPORT_DELETE_GUARD_SELECT,
        })
      : Promise.resolve([]),
    metadata.updatedSnapshots.length > 0
      ? prisma.constituent.findMany({
          where: { organizationId, id: { in: metadata.updatedSnapshots.map((snapshot) => snapshot.id) } },
          select: { id: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const createdMap = new Map(createdRows.map((row) => [row.id, row]));
  for (const createdId of metadata.createdIds) {
    const row = createdMap.get(createdId);
    if (!row) {
      blockedCreated.push({ id: createdId, reason: "Record no longer exists in the organization." });
      continue;
    }
    if (row.updatedAt.getTime() > completedAt.getTime() + CONSTITUENT_IMPORT_ROLLBACK_CHANGE_TOLERANCE_MS) {
      blockedCreated.push({ id: createdId, reason: "Record changed after import and cannot be auto-deleted safely." });
      continue;
    }
    const guardCount = countConstituentDeleteGuards(row);
    if (guardCount > 0) {
      blockedCreated.push({ id: createdId, reason: "Record has linked CRM data and cannot be auto-deleted safely." });
      continue;
    }
    safeDeleteCreatedIds.push(createdId);
  }

  const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
  for (const snapshot of metadata.updatedSnapshots) {
    const row = updatedMap.get(snapshot.id);
    if (!row) {
      blockedUpdated.push({ id: snapshot.id, reason: "Record no longer exists in the organization." });
      continue;
    }
    if (row.updatedAt.getTime() > completedAt.getTime() + CONSTITUENT_IMPORT_ROLLBACK_CHANGE_TOLERANCE_MS) {
      blockedUpdated.push({ id: snapshot.id, reason: "Record changed after import and cannot be restored automatically." });
      continue;
    }
    safeRestoreUpdatedSnapshots.push(snapshot);
  }

  if (safeDeleteCreatedIds.length === 0 && safeRestoreUpdatedSnapshots.length === 0) {
    blockedReasons.push("No rollback-safe records remain for this import run.");
  }

  return {
    canRollback: blockedReasons.length === 0,
    blockedReasons,
    safeDeleteCreatedIds,
    safeRestoreUpdatedSnapshots,
    blockedCreated,
    blockedUpdated,
  };
}

/** GET /api/constituents — List constituents with optional search, type, and status filters. */
router.get("/", async (req, res) => {
  const {
    search,
    type,
    status,
    limit = "50",
    page,
    pageSize,
  } = req.query as Record<string, string | undefined>;
  const organizationId = await resolveOrganizationId({ req });
  const hasPagination = Boolean(page || pageSize);

  if (!organizationId) {
    res.json(hasPagination
      ? {
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
          totalPages: 0,
          summary: { total: 0, active: 0, lapsed: 0, prospects: 0 },
        }
      : []);
    return;
  }

  const where: Prisma.ConstituentWhereInput = {
    organizationId,
    ...(search && {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    }),
    ...(type && { type: type as never }),
    ...(status && { donorStatus: status as never }),
  };

  if (hasPagination) {
    const normalizedPage = Math.max(Number.parseInt(page ?? "1", 10) || 1, 1);
    const normalizedPageSize = Math.min(Math.max(Number.parseInt(pageSize ?? "50", 10) || 50, 1), 500);
    const skip = (normalizedPage - 1) * normalizedPageSize;

    const [items, total, active, lapsed, prospects] = await Promise.all([
      prisma.constituent.findMany({
        where,
        skip,
        take: normalizedPageSize,
        orderBy: { lastName: "asc" },
        select: CONSTITUENT_SELECT,
      }),
      prisma.constituent.count({ where }),
      prisma.constituent.count({
        where: {
          ...where,
          donorStatus: { in: ["ACTIVE", "MAJOR_DONOR"] },
        },
      }),
      prisma.constituent.count({
        where: {
          ...where,
          donorStatus: "LAPSED",
        },
      }),
      prisma.constituent.count({
        where: {
          ...where,
          type: "PROSPECT",
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedPageSize);
    const safePage = totalPages > 0 ? Math.min(normalizedPage, totalPages) : 1;

    res.json({
      items,
      page: safePage,
      pageSize: normalizedPageSize,
      total,
      totalPages,
      summary: {
        total,
        active,
        lapsed,
        prospects,
      },
    });
    return;
  }

  const normalizedLimit = limit.toLowerCase() === "all" ? undefined : Math.min(Number.parseInt(limit, 10) || 50, 2000);

  if (search?.trim()) {
    const effectiveLimit = normalizedLimit ?? 2000;
    const searchWindow = Math.min(Math.max(effectiveLimit * 6, 150), 1200);

    const searchCandidates = await prisma.constituent.findMany({
      where,
      take: searchWindow,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: CONSTITUENT_SELECT,
    });

    const ranked = sortConstituentsBySearchRelevance(searchCandidates, search).slice(0, effectiveLimit);
    res.json(ranked);
    return;
  }

  const items = await prisma.constituent.findMany({
    where,
    ...(normalizedLimit ? { take: normalizedLimit } : {}),
    orderBy: { lastName: "asc" },
    select: CONSTITUENT_SELECT,
  });

  res.json(items);
});

/** GET /api/constituents/tags/catalog — Lists tags used by constituents in the active organization. */
router.get("/tags/catalog", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const tags = await prisma.tag.findMany({
    where: {
      OR: [
        {
          constituents: {
            some: {
              constituent: { organizationId },
            },
          },
        },
        { constituents: { none: {} } },
      ],
    },
    include: {
      constituents: {
        where: { constituent: { organizationId } },
        select: { constituentId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  res.json(tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    constituentsCount: tag.constituents.length,
  })));
});

/** POST /api/constituents/tags/catalog — Creates or updates a reusable tag definition. */
router.post("/tags/catalog", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  if (!name) {
    res.status(400).json({ error: { code: "INVALID_TAG", message: "Tag name is required." } });
    return;
  }

  const color = normalizeTagColor(req.body?.color, name.toLowerCase().includes("non") ? "#64748b" : "#16a34a");
  const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 500) : "";
  const existing = await prisma.tag.findFirst({
    where: { name },
    include: {
      constituents: {
        where: { constituent: { organizationId } },
        select: { constituentId: true },
      },
    },
  });
  const tag = existing
    ? await prisma.tag.update({
        where: { id: existing.id },
        data: { color, description: description || null },
      })
    : await prisma.tag.create({
        data: { name, color, description: description || null },
      });

  await logAudit({
    action: existing ? "CONSTITUENT_TAG_CATALOG_UPDATED" : "CONSTITUENT_TAG_CATALOG_CREATED",
    entity: "Tag",
    entityId: tag.id,
    organizationId,
    userId: req.user?.sub,
    metadata: { name: tag.name, color: tag.color },
  });

  res.status(existing ? 200 : 201).json({ ...tag, constituentsCount: existing?.constituents.length ?? 0 });
});

/** PATCH /api/constituents/tags/catalog/:tagId — Updates tag color/description metadata for segmentation and AI context. */
router.patch("/tags/catalog/:tagId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.tag.findFirst({
    where: {
      id: req.params.tagId,
      OR: [
        { constituents: { some: { constituent: { organizationId } } } },
        { constituents: { none: {} } },
      ],
    },
    include: {
      constituents: {
        where: { constituent: { organizationId } },
        select: { constituentId: true },
      },
    },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Tag not found." } });
    return;
  }

  const name = typeof req.body?.name === "string" && req.body.name.trim()
    ? req.body.name.trim().slice(0, 80)
    : existing.name;
  const color = req.body?.color !== undefined ? normalizeTagColor(req.body.color, existing.color) : existing.color;
  const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 500) : existing.description;
  const updated = await prisma.tag.update({
    where: { id: existing.id },
    data: { name, color, description: description || null },
  });

  await logAudit({
    action: "CONSTITUENT_TAG_CATALOG_UPDATED",
    entity: "Tag",
    entityId: updated.id,
    organizationId,
    userId: req.user?.sub,
    metadata: { name: updated.name, color: updated.color },
  });

  res.json({ ...updated, constituentsCount: existing.constituents.length });
});

/** POST /api/constituents/tags/bulk-actions — Adds or removes tags across selected constituents. */
router.post("/tags/bulk-actions", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const action = req.body?.action === "REMOVE" ? "REMOVE" : "ADD";
  const constituentIds = normalizeTagNames(req.body?.constituentIds, 500);
  const tagNames = normalizeTagNames(req.body?.tagNames, 30);
  if (constituentIds.length === 0 || tagNames.length === 0) {
    res.status(400).json({ error: { code: "INVALID_BULK_TAGS", message: "Select at least one constituent and one tag." } });
    return;
  }

  const constituents = await prisma.constituent.findMany({
    where: { id: { in: constituentIds }, organizationId },
    select: { id: true },
  });
  const safeConstituentIds = constituents.map((constituent) => constituent.id);
  if (safeConstituentIds.length === 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No matching constituents found." } });
    return;
  }

  const tags: Tag[] = [];
  for (const name of tagNames) {
    let tag = await prisma.tag.findFirst({ where: { name } });
    if (!tag && action === "ADD") {
      tag = await prisma.tag.create({ data: { name, color: name.toLowerCase().includes("non") ? "#64748b" : "#16a34a" } });
    }
    if (tag) tags.push(tag);
  }
  if (tags.length === 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No matching tags found." } });
    return;
  }

  if (action === "ADD") {
    await prisma.constituentTag.createMany({
      data: safeConstituentIds.flatMap((constituentId) => tags.map((tag) => ({ constituentId, tagId: tag.id }))),
      skipDuplicates: true,
    });
  } else {
    await prisma.constituentTag.deleteMany({
      where: {
        constituentId: { in: safeConstituentIds },
        tagId: { in: tags.map((tag) => tag.id) },
      },
    });
  }

  await logAudit({
    action: "CONSTITUENT_TAGS_BULK_UPDATED",
    entity: "Constituent",
    organizationId,
    userId: req.user?.sub,
    metadata: { action, tagNames, constituentsCount: safeConstituentIds.length },
  });

  res.json({ success: true, action, tagNames, updatedCount: safeConstituentIds.length });
});

/** PUT /api/constituents/:id/tags — Replaces one constituent's tag list, creating missing tags by name. */
router.put("/:id/tags", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found." } });
    return;
  }

  const uniqueNames = normalizeTagNames(req.body?.tagNames);

  const tags: Tag[] = [];
  for (const name of uniqueNames) {
    const existing = await prisma.tag.findFirst({ where: { name } });
    if (existing) {
      tags.push(existing);
      continue;
    }
    tags.push(await prisma.tag.create({ data: { name, color: name.toLowerCase().includes("non") ? "#64748b" : "#16a34a" } }));
  }

  await prisma.constituentTag.deleteMany({ where: { constituentId: constituent.id } });
  if (tags.length > 0) {
    await prisma.constituentTag.createMany({
      data: tags.map((tag) => ({ constituentId: constituent.id, tagId: tag.id })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    action: "CONSTITUENT_TAGS_UPDATED",
    entity: "Constituent",
    entityId: constituent.id,
    organizationId,
    userId: req.user?.sub,
    metadata: { tagNames: uniqueNames },
  });

  res.json({ id: constituent.id, tagNames: uniqueNames });
});

/** GET /api/constituents/:id — Full constituent profile including donation history, tasks, tags, and household. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      donations: {
        orderBy: { date: "desc" },
        take: 50,
        include: {
          campaign: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
        include: { assignee: { select: { firstName: true, lastName: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      tags: { include: { tag: { select: { name: true, color: true } } } },
      // Household where this constituent is the head
      headOf: {
        include: {
          members: {
            select: MEMBER_SELECT,
            orderBy: { lastName: "asc" },
          },
        },
      },
      // Household this constituent belongs to (as a member)
      household: {
        include: {
          head: { select: { id: true, firstName: true, lastName: true, prefix: true } },
        },
      },
    },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }
  res.json(constituent);
});

/** POST /api/constituents — Create a new constituent. Auto-creates a Household record for HOUSEHOLD type. */
router.post("/", async (req, res) => {
  const {
    firstName, lastName, prefix, email, email2, phone, phone2, mobile,
    addressLine1, addressLine2, city, state, zip, country,
    type, donorStatus, employer, occupation, notes,
    doNotEmail, doNotCall, doNotMail, organizationId,
  } = req.body;

  const resolvedOrganizationId = await resolveOrganizationId({
    req,
    requestedOrganizationId: organizationId,
  });
  if (!resolvedOrganizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const constituent = await prisma.constituent.create({
    data: {
      firstName, lastName, prefix, email, email2, phone, phone2, mobile,
      addressLine1, addressLine2, city, state, zip,
      country: country ?? "US",
      type: type ?? "DONOR",
      donorStatus: donorStatus ?? "NEW",
      employer, occupation, notes,
      doNotEmail: doNotEmail ?? false,
      doNotCall: doNotCall ?? false,
      doNotMail: doNotMail ?? false,
      organizationId: resolvedOrganizationId,
    },
  });

  // Auto-create a Household record when type is HOUSEHOLD
  if ((type ?? "DONOR") === "HOUSEHOLD") {
    await prisma.household.create({
      data: {
        name: `${lastName} Household`,
        headConstituentId: constituent.id,
        addressLine1: addressLine1 ?? null,
        addressLine2: addressLine2 ?? null,
        city: city ?? null,
        state: state ?? null,
        zip: zip ?? null,
        country: country ?? "US",
      },
    });
  }

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: "Constituent profile created",
      metadata: { source: "api/constituents:create", type: constituent.type },
    },
  });

  // Audit trail for constituent creation
  logAudit({
    action: "CONSTITUENT_CREATED",
    entity: "Constituent",
    entityId: constituent.id,
    userId: req.user?.sub,
    organizationId: resolvedOrganizationId,
    metadata: { type: constituent.type, name: `${constituent.firstName} ${constituent.lastName}` },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Execute Steward Paths for new constituent onboarding.
  await executeStewardPathsForTrigger({
    organizationId: resolvedOrganizationId,
    trigger: "CONSTITUENT_CREATED",
    constituentId: constituent.id,
    userId: req.user?.sub,
    source: "api/constituents:create",
  });

  res.status(201).json(constituent);
});

/** PUT /api/constituents/:id — Update constituent fields. Ensures a Household record exists if switching to HOUSEHOLD type. */
router.put("/:id", async (req, res) => {
  const {
    firstName, lastName, prefix, email, email2, phone, phone2, mobile,
    addressLine1, addressLine2, city, state, zip, country,
    type, donorStatus, employer, occupation, notes,
    doNotEmail, doNotCall, doNotMail,
  } = req.body;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.constituent.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const constituent = await prisma.constituent.update({
    where: { id: req.params.id },
    data: {
      firstName, lastName, prefix, email, email2, phone, phone2, mobile,
      addressLine1, addressLine2, city, state, zip, country,
      type, donorStatus, employer, occupation, notes,
      doNotEmail, doNotCall, doNotMail,
    },
  });

  // If switching to HOUSEHOLD type, ensure a Household record exists
  if (type === "HOUSEHOLD") {
    const existing = await prisma.household.findUnique({
      where: { headConstituentId: req.params.id },
    });
    if (!existing) {
      await prisma.household.create({
        data: {
          name: `${lastName} Household`,
          headConstituentId: req.params.id,
          addressLine1: addressLine1 ?? null,
          addressLine2: addressLine2 ?? null,
          city: city ?? null,
          state: state ?? null,
          zip: zip ?? null,
          country: country ?? "US",
        },
      });
    }
  }

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: "Constituent profile updated",
      metadata: { source: "api/constituents:update" },
    },
  });

  // Audit trail for constituent update
  logAudit({
    action: "CONSTITUENT_UPDATED",
    entity: "Constituent",
    entityId: constituent.id,
    userId: req.user?.sub,
    metadata: { source: "api/constituents:update" },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json(constituent);
});

/**
 * POST /api/constituents/import — Batch-import constituent records from a mapped CSV.
 *
 * Accepts an array of mapped records (CRM field keys as object keys) plus
 * import-mode options sent by the VisualImportMapper wizard.
 *
 * Behaviour:
 *   dryRun = true  → validate + count without writing to the database; returns a preview summary.
 *   dryRun = false → insert/upsert records according to importMode.
 *
 * Supported importMode values:
 *   "create_only"  — skip any record that would match an existing one
 *   "upsert"       — insert new, update matching records
 *   "update_only"  — only update records that already exist; skip new ones
 *
 * Duplicate matching uses (in priority order):
 *   1. externalId (DirID) when matchExtId = true
 *   2. email when matchEmail = true
 *   3. phone when matchPhone = true
 *
 * Response: {
 *   created,
 *   updated,
 *   skipped,
 *   errors,
 *   duplicatesInFile,
 *   dryRun,
 *   importRunId?,
 *   rollbackSupported?,
 *   rollbackEligibleUntil?
 * }
 */
router.post("/import", async (req, res) => {
  const {
    records,
    mode = "create_only",
    dryRun = true,
    matchExtId = true,
    matchEmail = true,
    matchPhone = true,
    duplicateResolution = "merge",
    allowOrgImport = true,
  } = req.body as {
    records: Array<Record<string, string>>;
    mode: ConstituentImportMode;
    dryRun: boolean;
    matchExtId: boolean;
    matchEmail: boolean;
    matchPhone?: boolean;
    duplicateResolution?: "merge" | "skip";
    /** When true, records tagged _isOrg="true" by the wizard are imported as ORGANIZATION constituents */
    allowOrgImport: boolean;
  };

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: { code: "NO_RECORDS", message: "No records to import." } });
    return;
  }

  const resolvedOrgId = await resolveOrganizationId({ req, requestedOrganizationId: undefined });
  if (!resolvedOrgId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let duplicatesInFile = 0;
  const errors: string[] = [];
  const seenInFileDedupKeys = new Set<string>();

  const importRunId = dryRun ? undefined : `constituent-import-${randomUUID()}`;
  const createdConstituentIds: string[] = [];
  const updatedSnapshots: ConstituentImportUpdatedSnapshot[] = [];
  let rollbackTrackingTruncated = false;

  /** Parse common CSV booleans like True/False, Yes/No, 1/0. */
  const parseBool = (raw?: string): boolean | undefined => {
    if (raw == null) return undefined;
    const v = raw.trim().toLowerCase();
    if (!v) return undefined;
    if (["true", "yes", "y", "1"].includes(v)) return true;
    if (["false", "no", "n", "0"].includes(v)) return false;
    return undefined;
  };

  /** Parse common date strings; undefined when blank/invalid. */
  const parseDateOrUndefined = (raw?: string): Date | undefined => {
    if (!raw?.trim()) return undefined;
    const d = new Date(raw.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const normalizeCountry = (raw?: string): string => {
    const value = (raw ?? "").trim();
    if (!value) return "US";
    const normalized = value.toLowerCase();
    if (["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america"].includes(normalized)) {
      return "US";
    }
    if (value.length === 2) return value.toUpperCase();
    return value;
  };

  /** Map source status strings into DonorStatus enum values. */
  const normalizeDonorStatus = (raw?: string): DonorStatus => {
    const v = (raw ?? "").trim().toLowerCase();
    if (!v) return "ACTIVE";
    if (v === "new") return "NEW";
    if (v === "active") return "ACTIVE";
    if (v === "inactive" || v === "inactiv" || v === "lapsed") return "LAPSED";
    if (v === "major_donor" || v === "majordonor" || v === "major donor") return "MAJOR_DONOR";
    if (v === "deceased") return "DECEASED";
    return "ACTIVE";
  };

  const normalizePhoneDigits = (raw?: string): string => (raw ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

  const findExistingByPhone = async (rawPhone?: string) => {
    const phoneDigits = normalizePhoneDigits(rawPhone);
    if (!matchPhone || phoneDigits.length < 7) return null;
    const lastFour = phoneDigits.slice(-4);
    const candidates = await prisma.constituent.findMany({
      where: {
        organizationId: resolvedOrgId,
        OR: [{ phone: { contains: lastFour } }, { mobile: { contains: lastFour } }, { phone2: { contains: lastFour } }],
      },
      select: { id: true, phone: true, mobile: true, phone2: true },
      take: 25,
    });
    return candidates.find((candidate) => [candidate.phone, candidate.mobile, candidate.phone2].some((value) => normalizePhoneDigits(value ?? undefined) === phoneDigits)) ?? null;
  };

  /** Map import contact-type labels into ConstituentType, using PROSPECT for generic non-donor contacts. */
  const normalizeConstituentType = (raw: string | undefined, isOrg: boolean): ConstituentType => {
    const v = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (isOrg) return "ORGANIZATION";
    if (!v) return "DONOR";
    if (["non_donor", "nondonor", "contact", "newsletter", "prospect"].includes(v)) return "PROSPECT";
    if (v === "volunteer") return "VOLUNTEER";
    if (v === "member") return "MEMBER";
    if (v === "sponsor") return "SPONSOR";
    if (v === "board" || v === "board_member") return "BOARD_MEMBER";
    if (v === "foundation") return "FOUNDATION";
    if (v === "organization" || v === "company") return "ORGANIZATION";
    return "DONOR";
  };

  /** Applies imported tag text plus donor/non-donor classification tags to one constituent. */
  const applyImportedTags = async (constituentId: string, rawTags: string | undefined, type: ConstituentType, rec: Record<string, string>) => {
    const names = [
      ...(rawTags ?? "").split(/[,;\n]+/).map((tag) => tag.trim()).filter(Boolean),
      type === "DONOR" ? "Donor" : "Non-Donor",
    ];
    const haystack = [rawTags, rec.organizationName, rec.churchAffiliation, rec.displayName, rec.lastName].filter(Boolean).join(" ");
    if (/newsletter/i.test(haystack)) names.push("Newsletter");
    if (/church|chapel|ministry|parish|congregation|fellowship|worship/i.test(haystack)) names.push("Church", "Organization");
    if (/business|company|co\.|inc|llc|ltd|corp/i.test(haystack)) names.push("Business", "Organization");
    const uniqueNames = Array.from(new Set(names.map((name) => name.slice(0, 80))));
    for (const name of uniqueNames) {
      let tag = await prisma.tag.findFirst({ where: { name } });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name, color: name === "Non-Donor" ? "#64748b" : "#16a34a" } });
      }
      await prisma.constituentTag.upsert({
        where: { constituentId_tagId: { constituentId, tagId: tag.id } },
        update: {},
        create: { constituentId, tagId: tag.id },
      });
    }
  };

  /** Build an import metadata note so non-modeled source fields are not silently dropped. */
  const buildImportNotes = (rec: Record<string, string>): string | undefined => {
    const parts: string[] = [];
    if (rec.website?.trim()) parts.push(`Website: ${rec.website.trim()}`);
    if (rec.spouseName?.trim()) parts.push(`Spouse: ${rec.spouseName.trim()}`);
    if (rec.formalName?.trim()) parts.push(`Formal Name: ${rec.formalName.trim()}`);
    if (rec.greetingName?.trim()) parts.push(`Greeting Name: ${rec.greetingName.trim()}`);
    if (rec.gender?.trim()) parts.push(`Gender: ${rec.gender.trim()}`);
    if (rec.sourceCreatedDate?.trim()) parts.push(`Source Created: ${rec.sourceCreatedDate.trim()}`);
    if (rec.sourceModifiedDate?.trim()) parts.push(`Source Modified: ${rec.sourceModifiedDate.trim()}`);
    if (rec.sourceLastUpdatedBy?.trim()) parts.push(`Source Last Updated By: ${rec.sourceLastUpdatedBy.trim()}`);
    if (rec.tags?.trim()) parts.push(`Source Tags: ${rec.tags.trim()}`);
    if (rec.deceased?.trim() && parseBool(rec.deceased)) parts.push("Source Deceased Flag: true");
    if (rec.spouseDeceased?.trim() && parseBool(rec.spouseDeceased)) parts.push("Source Spouse Deceased Flag: true");
    return parts.length > 0 ? parts.join("\n") : undefined;
  };

  for (const rec of records) {
    try {
      const inFileDedupKey = buildConstituentInFileDedupKey(rec);
      if (seenInFileDedupKeys.has(inFileDedupKey)) {
        duplicatesInFile++;
        skipped++;
        continue;
      }
      seenInFileDedupKeys.add(inFileDedupKey);

      // Map imported CRM field keys → Prisma Constituent fields
      // _isOrg is set by the wizard when a record had no firstName/lastName but had an org name
      const isOrg = allowOrgImport && rec["_isOrg"] === "true";

      const communicationRaw = rec.communicationPreferences?.trim() || "";
      const communicationTokens = communicationRaw
        ? communicationRaw.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)
        : [];
      const hasExplicitPrefs = communicationTokens.length > 0;
      const blocksEmail = communicationTokens.some((t) => /no_email|no email|do_not_email|do not email|opted_out|opted out|unsubscribe|unsubscribed/.test(t));
      const allowsEmail = !blocksEmail && communicationTokens.some((t) => t.includes("email"));
      const allowsPhone = communicationTokens.some((t) => t.includes("phone") || t.includes("call") || t.includes("voice"));
      const allowsMail = communicationTokens.some((t) => t.includes("mail") || t.includes("postal"));

      const sourceDoNotMail = parseBool(rec.doNotMail) ?? parseBool(rec.holdMail);
      const sourceDoNotEmail = parseBool(rec.doNotEmail);
      const sourceDoNotCall = parseBool(rec.doNotCall);
      const sourceDoNotContact = parseBool(rec.doNotContact);
      const sourceEmailOptOut = parseBool(rec.emailOptOut);

      const doNotMail = sourceDoNotMail ?? (hasExplicitPrefs ? !allowsMail : false);
      const doNotEmail = sourceDoNotEmail ?? sourceEmailOptOut ?? (hasExplicitPrefs ? !allowsEmail : false);
      const doNotCall = sourceDoNotCall ?? (hasExplicitPrefs ? !allowsPhone : false);
      const doNotContact = sourceDoNotContact ?? (doNotMail && doNotEmail && doNotCall);
      const emailOptOut = sourceEmailOptOut ?? doNotEmail;

      const birthDate = parseDateOrUndefined(rec.birthDate);
      const importNotes = buildImportNotes(rec);
      const deceasedFlag = parseBool(rec.deceased) === true;

      const data = {
        firstName:    rec.firstName    || "",
        lastName:     rec.lastName     || "",
        prefix:       rec.prefix       || undefined,
        email:        rec.email        || undefined,
        email2:       rec.spouseEmail  || undefined,
        phone:        rec.phone        || undefined,
        mobile:       rec.mobilePhone  || undefined,
        phone2:       rec.workPhone    || undefined,
        addressLine1: rec.address1     || undefined,
        addressLine2: rec.address2     || undefined,
        city:         rec.city         || undefined,
        state:        rec.state        || undefined,
        zip:          rec.zip          || undefined,
        country:      normalizeCountry(rec.country),
        birthDate,
        employer:     rec.organizationName || undefined,
        occupation:   rec.occupation   || undefined,
        doNotMail,
        doNotEmail,
        doNotCall,
        doNotContact,
        emailOptOut,
        notes:        [deceasedFlag ? "DECEASED" : undefined, importNotes].filter(Boolean).join("\n") || undefined,
        donorStatus:  normalizeDonorStatus(rec.constituentStatus),
        externalId:   rec.externalId   || undefined,
        type:         normalizeConstituentType(rec.type, isOrg),
        organizationId: resolvedOrgId,
      };

      // Skip records that are truly nameless (wizard should have caught these, but guard here)
      if (!data.firstName && !data.lastName) { skipped++; continue; }

      /** Shared scalar fields (no relation keys) — safe for both create and update */
      const scalars = {
        firstName:    data.firstName,
        lastName:     data.lastName,
        prefix:       data.prefix,
        email:        data.email,
        email2:       data.email2,
        phone:        data.phone,
        mobile:       data.mobile,
        phone2:       data.phone2,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city:         data.city,
        state:        data.state,
        zip:          data.zip,
        country:      data.country,
        birthDate:    data.birthDate,
        employer:     data.employer,
        occupation:   data.occupation,
        doNotEmail:   data.doNotEmail,
        doNotCall:    data.doNotCall,
        doNotMail:    data.doNotMail,
        doNotContact: data.doNotContact,
        emailOptOut:  data.emailOptOut,
        notes:        data.notes,
        donorStatus:  data.donorStatus,
        externalId:   data.externalId,
        type:         data.type,
      };

      if (dryRun) {
        // Dry-run: just tally what would happen without writing
        const existingByExtId = matchExtId && data.externalId
          ? await prisma.constituent.findFirst({ where: { externalId: data.externalId, organizationId: resolvedOrgId }, select: { id: true } })
          : null;
        const existingByEmail = !existingByExtId && matchEmail && data.email
          ? await prisma.constituent.findFirst({ where: { email: data.email, organizationId: resolvedOrgId }, select: { id: true } })
          : null;
        const existingByPhone = !existingByExtId && !existingByEmail ? await findExistingByPhone(data.phone) : null;

        const exists = existingByExtId ?? existingByEmail ?? existingByPhone;
        if (exists) {
          duplicateResolution === "skip" || mode === "create_only" ? skipped++ : updated++;
        } else {
          mode === "update_only" ? skipped++ : created++;
        }
        continue;
      }

      // Real import — find potential duplicate
      const existingByExtId = matchExtId && data.externalId
        ? await prisma.constituent.findFirst({ where: { externalId: data.externalId, organizationId: resolvedOrgId }, select: { id: true } })
        : null;
      const existingByEmail = !existingByExtId && matchEmail && data.email
        ? await prisma.constituent.findFirst({ where: { email: data.email, organizationId: resolvedOrgId }, select: { id: true } })
        : null;
      const existingByPhone = !existingByExtId && !existingByEmail ? await findExistingByPhone(data.phone) : null;
      const existing = existingByExtId ?? existingByEmail ?? existingByPhone;

      if (existing) {
        if (mode === "create_only" || duplicateResolution === "skip") { skipped++; continue; }

        let rollbackSnapshot: ConstituentImportUpdatedSnapshot | null = null;
        if (importRunId && !rollbackTrackingTruncated) {
          const before = await prisma.constituent.findFirst({
            where: { id: existing.id, organizationId: resolvedOrgId },
            select: CONSTITUENT_IMPORT_ROLLBACK_SELECT,
          });
          if (before) {
            rollbackSnapshot = {
              id: before.id,
              before: toConstituentRollbackSnapshot(before),
              tagIds: before.tags.map((tag) => tag.tagId),
            };
          }
        }

        // upsert / update_only — update the existing record (do not change organizationId)
        await prisma.constituent.update({ where: { id: existing.id }, data: scalars });
        await applyImportedTags(existing.id, rec.tags, data.type, rec);

        if (rollbackSnapshot) {
          if (updatedSnapshots.length >= CONSTITUENT_IMPORT_MAX_UPDATED_SNAPSHOTS) {
            rollbackTrackingTruncated = true;
          } else {
            updatedSnapshots.push(rollbackSnapshot);
          }
        }

        updated++;
      } else {
        if (mode === "update_only") { skipped++; continue; }
        // Create new constituent — include organizationId relation key
        const createdConstituent = await prisma.constituent.create({ data: { ...scalars, organizationId: resolvedOrgId } });
        await applyImportedTags(createdConstituent.id, rec.tags, data.type, rec);
        createdConstituentIds.push(createdConstituent.id);
        created++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!dryRun) {
    const completedAt = new Date();
    const rollbackEligibleUntil = new Date(completedAt.getTime() + CONSTITUENT_IMPORT_ROLLBACK_WINDOW_HOURS * 60 * 60 * 1000);
    const rollbackSupported = !rollbackTrackingTruncated;

    if (importRunId) {
      const runMetadata: ConstituentImportRunMetadata = {
        importRunId,
        source: "constituents_csv",
        mode,
        recordCount: records.length,
        created,
        updated,
        skipped,
        errorCount: errors.length,
        duplicatesInFile,
        createdIds: createdConstituentIds,
        updatedSnapshots,
        rollbackSupported,
        rollbackTrackingTruncated,
        completedAt: completedAt.toISOString(),
        rollbackEligibleUntil: rollbackEligibleUntil.toISOString(),
      };

      await prisma.auditLog.create({
        data: {
          action: "CONSTITUENT_IMPORT_RUN",
          entity: "ConstituentImportRun",
          entityId: importRunId,
          userId: req.user?.sub ?? null,
          organizationId: resolvedOrgId,
          metadata: runMetadata as unknown as Prisma.InputJsonValue,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] ?? null,
        },
      });
    }

    logAudit({
      action: "CONSTITUENT_IMPORTED",
      entity: "Constituent",
      userId: req.user?.sub,
      organizationId: resolvedOrgId,
      metadata: {
        created,
        updated,
        skipped,
        duplicatesInFile,
        errorCount: errors.length,
        mode,
        importRunId,
        rollbackSupported,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      created,
      updated,
      skipped,
      errors: errors.length,
      duplicatesInFile,
      dryRun,
      importRunId,
      rollbackSupported,
      rollbackEligibleUntil: rollbackEligibleUntil.toISOString(),
    });
    return;
  }

  res.json({ created, updated, skipped, errors: errors.length, duplicatesInFile, dryRun });
});

/** GET /api/constituents/import/history — recent live import runs with rollback status metadata. */
router.get("/import/history", requirePermission("import:data"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "10"), 10) || 10, 1), 50);
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "CONSTITUENT_IMPORT_RUN",
      entity: "ConstituentImportRun",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  const items = rows.flatMap((row) => {
    const metadata = readConstituentImportRunMetadata(row.metadata);
    if (!metadata) return [];
    return [{
      runId: metadata.importRunId,
      mode: metadata.mode,
      recordCount: metadata.recordCount,
      created: metadata.created,
      updated: metadata.updated,
      skipped: metadata.skipped,
      errors: metadata.errorCount,
      duplicatesInFile: metadata.duplicatesInFile,
      rollbackSupported: metadata.rollbackSupported,
      rollbackTrackingTruncated: metadata.rollbackTrackingTruncated,
      rollbackEligibleUntil: metadata.rollbackEligibleUntil,
      rolledBackAt: metadata.rolledBackAt ?? null,
      createdAt: row.createdAt.toISOString(),
      startedBy: row.user ? {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`.trim(),
        email: row.user.email,
      } : null,
    }];
  });

  res.json({ items });
});

/** POST /api/constituents/import/:runId/rollback/preview — evaluate which rows can be rolled back safely. */
router.post("/import/:runId/rollback/preview", requirePermission("import:data"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const runId = String(req.params.runId ?? "").trim();
  if (!runId) {
    res.status(400).json({ error: { code: "RUN_ID_REQUIRED", message: "Import run ID is required." } });
    return;
  }

  const runLog = await prisma.auditLog.findFirst({
    where: {
      organizationId,
      action: "CONSTITUENT_IMPORT_RUN",
      entity: "ConstituentImportRun",
      entityId: runId,
    },
  });
  if (!runLog) {
    res.status(404).json({ error: { code: "IMPORT_RUN_NOT_FOUND", message: "Import run not found." } });
    return;
  }

  const metadata = readConstituentImportRunMetadata(runLog.metadata);
  if (!metadata) {
    res.status(422).json({ error: { code: "IMPORT_RUN_METADATA_INVALID", message: "Import run metadata is invalid." } });
    return;
  }

  const plan = await buildConstituentImportRollbackPlan({ organizationId, metadata });
  const confirmationText = `${CONSTITUENT_IMPORT_ROLLBACK_CONFIRM_PREFIX}:${runId}`;

  res.json({
    runId,
    rollbackSupported: metadata.rollbackSupported,
    alreadyRolledBack: Boolean(metadata.rolledBackAt),
    rollbackEligibleUntil: metadata.rollbackEligibleUntil,
    confirmationText,
    summary: {
      trackedCreated: metadata.createdIds.length,
      trackedUpdated: metadata.updatedSnapshots.length,
      canDeleteCreated: plan.safeDeleteCreatedIds.length,
      canRestoreUpdated: plan.safeRestoreUpdatedSnapshots.length,
      blockedCreated: plan.blockedCreated.length,
      blockedUpdated: plan.blockedUpdated.length,
    },
    blockedReasons: plan.blockedReasons,
    blockedCreated: plan.blockedCreated.slice(0, 25),
    blockedUpdated: plan.blockedUpdated.slice(0, 25),
    canRollback: plan.canRollback,
  });
});

/** POST /api/constituents/import/:runId/rollback — execute a guarded rollback for one import run. */
router.post("/import/:runId/rollback", requirePermission("import:data"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const runId = String(req.params.runId ?? "").trim();
  if (!runId) {
    res.status(400).json({ error: { code: "RUN_ID_REQUIRED", message: "Import run ID is required." } });
    return;
  }

  const body = (req.body ?? {}) as { confirm?: boolean; confirmationText?: string };
  const expectedConfirmation = `${CONSTITUENT_IMPORT_ROLLBACK_CONFIRM_PREFIX}:${runId}`;
  if (body.confirm !== true || body.confirmationText !== expectedConfirmation) {
    res.status(400).json({
      error: {
        code: "ROLLBACK_CONFIRMATION_REQUIRED",
        message: `Set confirm=true and confirmationText="${expectedConfirmation}" to execute rollback.`,
      },
    });
    return;
  }

  const runLog = await prisma.auditLog.findFirst({
    where: {
      organizationId,
      action: "CONSTITUENT_IMPORT_RUN",
      entity: "ConstituentImportRun",
      entityId: runId,
    },
  });
  if (!runLog) {
    res.status(404).json({ error: { code: "IMPORT_RUN_NOT_FOUND", message: "Import run not found." } });
    return;
  }

  const metadata = readConstituentImportRunMetadata(runLog.metadata);
  if (!metadata) {
    res.status(422).json({ error: { code: "IMPORT_RUN_METADATA_INVALID", message: "Import run metadata is invalid." } });
    return;
  }

  const plan = await buildConstituentImportRollbackPlan({ organizationId, metadata });
  if (!plan.canRollback) {
    res.status(409).json({
      error: { code: "ROLLBACK_NOT_SAFE", message: "Rollback cannot run safely for this import run." },
      blockedReasons: plan.blockedReasons,
      blockedCreated: plan.blockedCreated,
      blockedUpdated: plan.blockedUpdated,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const snapshot of plan.safeRestoreUpdatedSnapshots) {
      await tx.constituent.update({
        where: { id: snapshot.id },
        data: snapshotToConstituentUpdateData(snapshot.before),
      });

      await tx.constituentTag.deleteMany({ where: { constituentId: snapshot.id } });
      if (snapshot.tagIds.length > 0) {
        await tx.constituentTag.createMany({
          data: snapshot.tagIds.map((tagId) => ({ constituentId: snapshot.id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    if (plan.safeDeleteCreatedIds.length > 0) {
      await tx.constituent.deleteMany({
        where: {
          organizationId,
          id: { in: plan.safeDeleteCreatedIds },
        },
      });
    }
  });

  const rolledBackAt = new Date().toISOString();
  const rollbackSummary: ConstituentImportRollbackSummary = {
    deletedCreated: plan.safeDeleteCreatedIds.length,
    restoredUpdated: plan.safeRestoreUpdatedSnapshots.length,
    blockedCreated: plan.blockedCreated.length,
    blockedUpdated: plan.blockedUpdated.length,
  };

  const updatedRunMetadata: ConstituentImportRunMetadata = {
    ...metadata,
    rolledBackAt,
    rolledBackBy: req.user?.sub,
    rollbackSummary,
  };

  await prisma.auditLog.update({
    where: { id: runLog.id },
    data: { metadata: updatedRunMetadata as unknown as Prisma.InputJsonValue },
  });

  await logAudit({
    action: "CONSTITUENT_IMPORT_RUN_ROLLBACK",
    entity: "ConstituentImportRun",
    entityId: runId,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      deletedCreated: rollbackSummary.deletedCreated,
      restoredUpdated: rollbackSummary.restoredUpdated,
      blockedCreated: rollbackSummary.blockedCreated,
      blockedUpdated: rollbackSummary.blockedUpdated,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ runId, rolledBackAt, ...rollbackSummary });
});

/** POST /api/constituents/merge — Review-approved merge of one duplicate constituent into a kept record. */
router.post("/merge", async (req, res) => {
  const { keepId, mergeId } = req.body as { keepId?: string; mergeId?: string };
  if (!keepId || !mergeId || keepId === mergeId) {
    res.status(400).json({ error: { code: "INVALID_MERGE", message: "Keep and merge constituent IDs are required." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const [keep, source] = await Promise.all([
    prisma.constituent.findFirst({ where: { id: keepId, organizationId }, include: { tags: true } }),
    prisma.constituent.findFirst({ where: { id: mergeId, organizationId }, include: { tags: true } }),
  ]);
  if (!keep || !source) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "One or both constituents were not found." } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const fill = <T>(current: T | null | undefined, incoming: T | null | undefined): T | undefined => {
      if (current !== null && current !== undefined && String(current).trim() !== "") return undefined;
      return incoming !== null && incoming !== undefined && String(incoming).trim() !== "" ? incoming : undefined;
    };

    await tx.constituent.update({
      where: { id: keep.id },
      data: {
        email: fill(keep.email, source.email),
        email2: fill(keep.email2, source.email2),
        phone: fill(keep.phone, source.phone),
        phone2: fill(keep.phone2, source.phone2),
        mobile: fill(keep.mobile, source.mobile),
        addressLine1: fill(keep.addressLine1, source.addressLine1),
        addressLine2: fill(keep.addressLine2, source.addressLine2),
        city: fill(keep.city, source.city),
        state: fill(keep.state, source.state),
        zip: fill(keep.zip, source.zip),
        employer: fill(keep.employer, source.employer),
        occupation: fill(keep.occupation, source.occupation),
        externalId: fill(keep.externalId, source.externalId),
        doNotEmail: keep.doNotEmail || source.doNotEmail,
        doNotCall: keep.doNotCall || source.doNotCall,
        doNotMail: keep.doNotMail || source.doNotMail,
        doNotContact: keep.doNotContact || source.doNotContact,
        emailOptOut: keep.emailOptOut || source.emailOptOut,
        notes: [keep.notes, source.notes ? `Merged duplicate ${source.firstName} ${source.lastName} (${source.id}):\n${source.notes}` : `Merged duplicate ${source.firstName} ${source.lastName} (${source.id}).`].filter(Boolean).join("\n\n"),
      },
    });

    for (const tag of source.tags) {
      await tx.constituentTag.upsert({
        where: { constituentId_tagId: { constituentId: keep.id, tagId: tag.tagId } },
        update: {},
        create: { constituentId: keep.id, tagId: tag.tagId },
      });
    }

    await tx.donation.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.pledge.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.task.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.meeting.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.activity.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.eventAttendance.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.eventOrder.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.eventGuest.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.eventSponsor.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.volunteerHour.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.stewardPathEnrollment.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.stewardPathEmailDraft.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.generatedLetter.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.emailSubscription.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.emailSuppression.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.emailConsentEvent.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.emailSendRecipient.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.compassionClient.updateMany({ where: { constituentId: source.id }, data: { constituentId: keep.id } });
    await tx.constituentTag.deleteMany({ where: { constituentId: source.id } });
    await tx.constituent.delete({ where: { id: source.id } });
    await tx.activity.create({
      data: {
        constituentId: keep.id,
        type: "NOTE",
        description: `Merged duplicate constituent ${source.firstName} ${source.lastName}.`,
        metadata: { source: "contacts-manager:duplicate-merge", mergedConstituentId: source.id },
      },
    });
  });

  logAudit({
    action: "CONSTITUENT_MERGED",
    entity: "Constituent",
    entityId: keep.id,
    userId: req.user?.sub,
    organizationId,
    metadata: { mergedConstituentId: source.id, keptName: `${keep.firstName} ${keep.lastName}`, mergedName: `${source.firstName} ${source.lastName}` },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ merged: true, keepId: keep.id, mergeId: source.id });
});


router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.constituent.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  await prisma.constituent.delete({ where: { id } });
  logAudit({
    action: "CONSTITUENT_DELETED",
    entity: "Constituent",
    entityId: id,
    userId: req.user?.sub,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.status(204).send();
});

/**
 * POST /api/constituents/:id/activities — Log a manual activity entry (call, meeting, email, note)
 * against a constituent's timeline.
 *
 * Body: { type: string, description: string, metadata?: object }
 * Returns the created Activity record.
 */
router.post("/:id/activities", async (req, res) => {
  const id = req.params.id as string;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { type = "NOTE", description, metadata } = req.body as {
    type?: string;
    description: string;
    metadata?: Record<string, unknown>;
  };

  if (!description?.trim()) {
    res.status(400).json({ error: { code: "DESCRIPTION_REQUIRED", message: "description is required" } });
    return;
  }

  // Verify the constituent exists before creating the activity
  const exists = await prisma.constituent.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const activity = await prisma.activity.create({
    data: {
      constituentId: id,
      type: type as ActivityType,
      description: description.trim(),
      metadata: (metadata ?? { source: "manual" }) as Prisma.InputJsonValue,
      userId: req.user?.sub ?? undefined,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  res.status(201).json(activity);
});

/**
 * PATCH /api/constituents/:id/notes — Quickly update only the notes field on a constituent.
 * This avoids sending the full PUT body when only saving a notes change.
 *
 * Body: { notes: string }
 */
router.patch("/:id/notes", async (req, res) => {
  const id = req.params.id as string;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { notes } = req.body as { notes: string };

  const exists = await prisma.constituent.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const updated = await prisma.constituent.update({
    where: { id },
    data: { notes: notes ?? "" },
    select: { id: true, notes: true },
  });

  res.json(updated);
});

/**
 * GET /api/constituents/:id/events — List events this constituent attended or registered for.
 *
 * Returns an array of { event, guest } objects so the UI can display
 * event history with check-in status, RSVP status, and payment status.
 */
router.get("/:id/events", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  // Verify constituent exists and belongs to this org
  const constituent = await prisma.constituent.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const eventGuests = await prisma.eventGuest.findMany({
    where: {
      constituentId: req.params.id,
      event: { organizationId },
    },
    include: {
      event: { select: { id: true, name: true, startDate: true, type: true } },
      ticketType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Shape the response to a clean { event, guest } pair per record
  const result = eventGuests.map((g) => ({
    event: g.event,
    guest: {
      id: g.id,
      checkedIn: g.checkedIn,
      checkedInAt: g.checkedInAt,
      paymentStatus: g.paymentStatus,
      rsvpStatus: g.rsvpStatus,
      ticketType: g.ticketType,
    },
  }));

  res.json(result);
});

export default router;
