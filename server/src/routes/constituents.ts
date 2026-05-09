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
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import type { DonorStatus, ConstituentType } from "@prisma/client";

const router = Router();

// All constituent routes require a valid JWT — applied once for the entire router.
router.use(requireAuth);

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

/** GET /api/constituents — List constituents with optional search, type, and status filters. */
router.get("/", async (req, res) => {
  const { search, type, status, limit = "50" } = req.query as Record<string, string>;

  const where = {
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

  const items = await prisma.constituent.findMany({
    where,
    take: Math.min(parseInt(limit), 500),
    orderBy: { lastName: "asc" },
    select: CONSTITUENT_SELECT,
  });

  res.json(items);
});

/** GET /api/constituents/:id — Full constituent profile including donation history, tasks, tags, and household. */
router.get("/:id", async (req, res) => {
  const constituent = await prisma.constituent.findUnique({
    where: { id: req.params.id },
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
 *
 * Response: { created, updated, skipped, errors, dryRun }
 */
router.post("/import", requireRole("manager"), async (req, res) => {
  const {
    records,
    mode = "create_only",
    dryRun = true,
    matchExtId = true,
    matchEmail = true,
    allowOrgImport = true,
  } = req.body as {
    records: Array<Record<string, string>>;
    mode: "create_only" | "upsert" | "update_only";
    dryRun: boolean;
    matchExtId: boolean;
    matchEmail: boolean;
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

  for (const rec of records) {
    try {
      // Map imported CRM field keys → Prisma Constituent fields
      // _isOrg is set by the wizard when a record had no firstName/lastName but had an org name
      const isOrg = allowOrgImport && rec["_isOrg"] === "true";

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
        city:         rec.city         || undefined,
        state:        rec.state        || undefined,
        zip:          rec.zip          || undefined,
        employer:     rec.organizationName || undefined,
        occupation:   rec.occupation   || undefined,
        // Map "HoldMail" boolean string → doNotMail
        doNotMail:    rec.holdMail === "true",
        // Map DeceasedDesc boolean string → notes annotation if deceased
        notes:        rec.deceased === "true" ? "DECEASED" : undefined,
        donorStatus:  (rec.constituentStatus === "InActive" ? "LAPSED" : "ACTIVE") as DonorStatus,
        externalId:   rec.externalId   || undefined,
        // Set constituent type: org-flagged records → ORGANIZATION, others → DONOR
        type:         (isOrg ? "ORGANIZATION" : "DONOR") as ConstituentType,
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
        city:         data.city,
        state:        data.state,
        zip:          data.zip,
        employer:     data.employer,
        occupation:   data.occupation,
        doNotMail:    data.doNotMail,
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

        const exists = existingByExtId ?? existingByEmail;
        if (exists) {
          mode === "create_only" ? skipped++ : updated++;
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
      const existing = existingByExtId ?? existingByEmail;

      if (existing) {
        if (mode === "create_only") { skipped++; continue; }
        // upsert / update_only — update the existing record (do not change organizationId)
        await prisma.constituent.update({ where: { id: existing.id }, data: scalars });
        updated++;
      } else {
        if (mode === "update_only") { skipped++; continue; }
        // Create new constituent — include organizationId relation key
        await prisma.constituent.create({ data: { ...scalars, organizationId: resolvedOrgId } });
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


router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id as string;
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

export default router;
