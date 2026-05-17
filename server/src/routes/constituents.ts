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
 *   PUT    /api/constituents/:id     — update an existing constituent
 *   DELETE /api/constituents/:id     — delete a constituent
 *
 * @module routes/constituents
 */
import { Router } from "express";
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
 * Response: { created, updated, skipped, errors, dryRun }
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
    mode: "create_only" | "upsert" | "update_only";
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
  const errors: string[] = [];

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

      const sourceDoNotMail = parseBool(rec.holdMail);
      const doNotMail = sourceDoNotMail ?? (hasExplicitPrefs ? !allowsMail : false);
      const doNotEmail = hasExplicitPrefs ? !allowsEmail : false;
      const doNotCall = hasExplicitPrefs ? !allowsPhone : false;

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
        country:      "US",
        birthDate,
        employer:     rec.organizationName || undefined,
        occupation:   rec.occupation   || undefined,
        doNotMail,
        doNotEmail,
        doNotCall,
        doNotContact: doNotMail && doNotEmail && doNotCall,
        emailOptOut:  doNotEmail,
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
        // upsert / update_only — update the existing record (do not change organizationId)
        await prisma.constituent.update({ where: { id: existing.id }, data: scalars });
        await applyImportedTags(existing.id, rec.tags, data.type, rec);
        updated++;
      } else {
        if (mode === "update_only") { skipped++; continue; }
        // Create new constituent — include organizationId relation key
        const createdConstituent = await prisma.constituent.create({ data: { ...scalars, organizationId: resolvedOrgId } });
        await applyImportedTags(createdConstituent.id, rec.tags, data.type, rec);
        created++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!dryRun) {
    logAudit({
      action: "CONSTITUENT_IMPORTED",
      entity: "Constituent",
      userId: req.user?.sub,
      organizationId: resolvedOrgId,
      metadata: { created, updated, skipped, errorCount: errors.length, mode },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  res.json({ created, updated, skipped, errors: errors.length, dryRun });
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
