/**
 * Donation management routes for OyamaCRM.
 * Provides paginated listing and CRUD operations for donation records.
 * Supports filtering by constituent, campaign, designation, status, and date range,
 * as well as full-text search across the linked constituent's name and email.
 *
 * Routes:
 *   GET  /api/donations      — paginated list with filters
 *   GET  /api/donations/:id  — single donation with related pledge
 *   POST /api/donations      — record a new donation
 *   PUT  /api/donations/:id  — update a donation
 *   DELETE /api/donations/:id — delete a donation (admin / batch entry corrections)
 *
 * @module routes/donations
 */
import { Router } from "express";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";

const router = Router();

// All donation routes require authentication.
router.use(requireAuth);

/**
 * Standard relations to include on every donation response.
 * Provides a summary of the linked constituent, campaign, and designation
 * without fetching their full records.
 */
const INCLUDE = {
  constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
  campaign:    { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
};

/** GET /api/donations — Paginated donation list with optional filters for constituent, campaign, date range, and status. */
router.get("/", async (req, res) => {
  const { constituentId, campaignId, designationId, status, from, to, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {
    ...(constituentId && { constituentId }),
    ...(campaignId    && { campaignId }),
    ...(designationId && { designationId }),
    ...(status        && { status }),
    // Build date range filter only when at least one bound is supplied
    ...((from || to)  && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to) }),
      },
    }),
    // Search is applied as a filter on the related constituent record
    ...(search && {
      constituent: {
        OR: [
          { firstName: { contains: search } },
          { lastName:  { contains: search } },
          { email:     { contains: search } },
        ],
      },
    }),
  };

  // Run the list query and count in parallel to avoid two sequential round-trips
  const [items, total] = await Promise.all([
    prisma.donation.findMany({ where, skip, take: parseInt(limit), orderBy: { date: "desc" }, include: INCLUDE }),
    prisma.donation.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

/** GET /api/donations/:id — Fetch a single donation including its linked pledge if present. */
router.get("/:id", async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: { ...INCLUDE, pledge: true },
  });
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

/** POST /api/donations — Record a new donation. Defaults: paymentMethod=ONLINE, status=COMPLETED, taxDeductible=true. */
router.post("/", async (req, res) => {
  const {
    constituentId, campaignId, designationId, pledgeId,
    amount, date, paymentMethod, checkNumber, isRecurring,
    frequency, status, taxDeductible, notes,
  } = req.body;

  const donation = await prisma.donation.create({
    data: {
      constituentId,
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      pledgeId:      pledgeId      || undefined,
      amount,
      date:          date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || "ONLINE",
      checkNumber:   checkNumber   || undefined,
      isRecurring:   isRecurring   ?? false,
      frequency:     frequency     || undefined,
      status:        status        || "COMPLETED",
      taxDeductible: taxDeductible ?? true,
      notes:         notes         || undefined,
    },
    include: INCLUDE,
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "DONATION",
      description: `Donation recorded: $${Number(donation.amount).toFixed(2)}`,
      metadata: { source: "api/donations:create" },
    },
  });

  // Audit trail for new donation
  logAudit({
    action: "DONATION_CREATED",
    entity: "Donation",
    entityId: donation.id,
    userId: req.user?.sub,
    metadata: { amount: Number(donation.amount), status: donation.status, constituentId: donation.constituentId },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json(donation);
});

/** PUT /api/donations/:id — Update mutable fields on an existing donation (amount, date, status, etc.). */
router.put("/:id", async (req, res) => {
  const {
    campaignId, designationId, amount, date, paymentMethod,
    checkNumber, isRecurring, frequency, status, taxDeductible, notes,
  } = req.body;

  const donation = await prisma.donation.update({
    where: { id: req.params.id },
    data: {
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      amount:        amount        || undefined,
      date:          date ? new Date(date) : undefined,
      paymentMethod: paymentMethod || undefined,
      checkNumber:   checkNumber   || undefined,
      isRecurring,
      frequency:     frequency     || undefined,
      status:        status        || undefined,
      taxDeductible,
      notes:         notes         || undefined,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "NOTE",
      description: "Donation record updated",
      metadata: { source: "api/donations:update" },
    },
  });

  res.json(donation);
});

/**
 * POST /api/donations/import — Bulk-import historical donation records from a CSV wizard.
 *
 * Accepts an array of mapped row objects (from the DonationImportWizard) and:
 *   1. Resolves each donation to an existing constituent via email, externalId, or name
 *   2. Optionally deduplicates by receiptNumber
 *   3. Normalizes paymentMethod, amount, date, status, frequency
 *   4. Creates Donation records and creates Campaign/Designation on-the-fly by name
 *   5. Updates constituent giving statistics (totalLifetimeGiving, firstGiftDate, lastGiftDate, giftCount, lastGiftAmount)
 *   6. Writes an audit log entry
 *
 * Request body:
 *   records           — array of mapped row objects (donation field keys → string values)
 *   dryRun            — true = simulate only, false = write to DB
 *   matchEmail        — try to match constituent by email
 *   matchExternalId   — try to match constituent by externalId
 *   matchName         — try to match constituent by firstName + lastName
 *   skipUnmatched     — skip rows where no constituent match is found (default false)
 *   dedupByReceipt    — skip rows whose receiptNumber already exists in the DB (default true)
 *
 * Response: { created, skipped, errors, unmatched, dryRun, errorMessages }
 *
 * Requires: role manager or higher.
 */
router.post("/import", requireRole("manager"), async (req, res) => {
  const {
    records,
    dryRun         = true,
    matchEmail     = true,
    matchExternalId = true,
    matchName      = true,
    skipUnmatched  = false,
    dedupByReceipt = true,
  } = req.body as {
    records: Array<Record<string, string>>;
    dryRun: boolean;
    matchEmail: boolean;
    matchExternalId: boolean;
    matchName: boolean;
    skipUnmatched: boolean;
    dedupByReceipt: boolean;
  };

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: { code: "NO_RECORDS", message: "No records provided." } });
    return;
  }

  // Resolve the organization from the authenticated user (falls back to DB lookup)
  const resolvedOrgId = await resolveOrganizationId({ req, requestedOrganizationId: undefined });
  if (!resolvedOrgId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }
  // Narrowed to string so closures below can capture it without null-check noise
  const orgId: string = resolvedOrgId;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Parse a dollar-amount string to a float, stripping $, commas, and whitespace. */
  function parseAmount(raw: string): number | null {
    if (!raw?.trim()) return null;
    const n = parseFloat(raw.replace(/[$,\s]/g, "").trim());
    return isNaN(n) || n < 0 ? null : n;
  }

  /** Parse a date string (MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.) into a Date object. */
  function parseDate(raw: string): Date | null {
    if (!raw?.trim()) return null;
    const direct = new Date(raw);
    if (!isNaN(direct.getTime())) return direct;
    const parts = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (parts) {
      const year = parts[3].length === 2 ? 2000 + parseInt(parts[3]) : parseInt(parts[3]);
      const d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  /** Normalize a free-text payment method string to a Prisma PaymentMethod enum value. */
  function normalizePaymentMethod(raw: string): "CHECK" | "CREDIT_CARD" | "ACH" | "WIRE" | "STOCK" | "IN_KIND" | "CASH" | "ONLINE" {
    if (!raw?.trim()) return "ONLINE";
    const v = raw.trim();
    if (/check|cheque/i.test(v))                             return "CHECK";
    if (/credit|visa|mastercard|amex|discover|card/i.test(v)) return "CREDIT_CARD";
    if (/ach|eft|bank transfer|electronic/i.test(v))         return "ACH";
    if (/wire/i.test(v))                                      return "WIRE";
    if (/stock|securities|equity/i.test(v))                  return "STOCK";
    if (/in.?kind|inkind|goods|services/i.test(v))           return "IN_KIND";
    if (/cash/i.test(v))                                      return "CASH";
    return "ONLINE";
  }

  /** Normalize a status string to a Prisma DonationStatus enum value. */
  function normalizeStatus(raw: string): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
    const v = (raw ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    if (v === "PENDING")  return "PENDING";
    if (v === "FAILED")   return "FAILED";
    if (v === "REFUNDED") return "REFUNDED";
    return "COMPLETED";
  }

  /** Normalize a recurring frequency string to a Prisma RecurringFrequency enum value or null. */
  function normalizeFrequency(raw: string): "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null {
    const v = (raw ?? "").toLowerCase().trim();
    if (/weekly|week/.test(v))        return "WEEKLY";
    if (/monthly|month/.test(v))      return "MONTHLY";
    if (/quarterly|quarter/.test(v))  return "QUARTERLY";
    if (/annual|yearly|year/.test(v)) return "ANNUALLY";
    return null;
  }

  /**
   * Look up an existing constituent by email, externalId, or name (in priority order).
   * Returns null if no match is found. Uses the org-scoped constituent lookup.
   */
  async function resolveConstituent(rec: Record<string, string>): Promise<{ id: string } | null> {
    if (matchExternalId && rec.constituentExternalId?.trim()) {
      const found = await prisma.constituent.findFirst({
        where: { externalId: rec.constituentExternalId.trim(), organizationId: orgId },
        select: { id: true },
      });
      if (found) return found;
    }
    if (matchEmail && rec.constituentEmail?.trim()) {
      const found = await prisma.constituent.findFirst({
        where: { email: rec.constituentEmail.trim().toLowerCase(), organizationId: orgId },
        select: { id: true },
      });
      if (found) return found;
    }
    if (matchName) {
      // Try to split constituentName into first/last if constituentFirstName is absent
      let firstName = rec.constituentFirstName?.trim() ?? "";
      let lastName  = rec.constituentLastName?.trim() ?? "";
      if (!firstName && !lastName && rec.constituentName?.trim()) {
        const parts = rec.constituentName.trim().split(/\s+/);
        firstName = parts[0] ?? "";
        lastName  = parts.slice(1).join(" ");
      }
      if (firstName || lastName) {
        const found = await prisma.constituent.findFirst({
          where: {
            organizationId: orgId,
            ...(firstName && { firstName: { equals: firstName } }),
            ...(lastName  && { lastName:  { equals: lastName } }),
          },
          select: { id: true },
        });
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find or create a Campaign by name within the organization.
   * Creates a basic ANNUAL_FUND campaign if none exists.
   */
  async function resolveCampaign(name: string): Promise<string | undefined> {
    if (!name?.trim()) return undefined;
    const existing = await prisma.campaign.findFirst({
      where: { name: { equals: name.trim() }, organizationId: orgId },
      select: { id: true },
    });
    if (existing) return existing.id;
    // Auto-create with sensible defaults — user can edit campaign details afterward
    const created = await prisma.campaign.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        startDate: new Date(),
        category: "ANNUAL_FUND",
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Find or create a Designation by name within the organization.
   */
  async function resolveDesignation(name: string): Promise<string | undefined> {
    if (!name?.trim()) return undefined;
    const existing = await prisma.designation.findFirst({
      where: { name: { equals: name.trim() } },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.designation.create({
      data: { name: name.trim() },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Recalculate and update a constituent's denormalized giving summary fields
   * after a new donation is inserted. Runs in the same transaction context.
   */
  async function updateConstituentStats(constituentId: string): Promise<void> {
    const agg = await prisma.donation.aggregate({
      where: { constituentId, status: "COMPLETED" },
      _sum:   { amount: true },
      _count: { id: true },
      _min:   { date: true },
      _max:   { date: true },
    });
    // Get the last gift amount separately
    const lastGift = await prisma.donation.findFirst({
      where: { constituentId, status: "COMPLETED" },
      orderBy: { date: "desc" },
      select: { amount: true },
    });
    await prisma.constituent.update({
      where: { id: constituentId },
      data: {
        totalLifetimeGiving: agg._sum.amount ?? 0,
        giftCount:           agg._count.id,
        firstGiftDate:       agg._min.date ?? undefined,
        lastGiftDate:        agg._max.date ?? undefined,
        lastGiftAmount:      lastGift?.amount ?? undefined,
      },
    });
  }

  // ─── Main import loop ─────────────────────────────────────────────────────────

  let created = 0;
  let skipped = 0;
  let unmatched = 0;
  const errorMessages: string[] = [];

  for (const rec of records) {
    try {
      // ── Parse required fields ───────────────────────────────────────────────
      const amount = parseAmount(rec.amount ?? "");
      if (amount === null) { skipped++; continue; }

      const date = parseDate(rec.date ?? "");
      if (!date) { skipped++; continue; }

      // ── Deduplication by receipt number ────────────────────────────────────
      if (dedupByReceipt && rec.receiptNumber?.trim()) {
        const exists = await prisma.donation.findFirst({
          where: { receiptNumber: rec.receiptNumber.trim() },
          select: { id: true },
        });
        if (exists) { skipped++; continue; }
      }

      // ── Constituent matching ────────────────────────────────────────────────
      const constituent = await resolveConstituent(rec);
      if (!constituent) {
        unmatched++;
        if (skipUnmatched) { skipped++; continue; }
        // Import without a constituent link if skipUnmatched is false (orphan donation)
        // Orphan donations are skipped anyway — they have no constituentId FK
        // so we skip rather than insert invalid data
        skipped++;
        continue;
      }

      // ── Campaign and Designation resolution ────────────────────────────────
      const campaignId    = dryRun ? undefined : await resolveCampaign(rec.campaignName ?? "");
      const designationId = dryRun ? undefined : await resolveDesignation(rec.designationName ?? "");

      if (dryRun) {
        // Dry run: count what would happen, no writes
        created++;
        continue;
      }

      // ── Create donation ─────────────────────────────────────────────────────
      const isRecurring = /^(true|yes|1)$/i.test(rec.isRecurring ?? "");
      const taxDeductible = !/^(false|no|0)$/i.test(rec.taxDeductible ?? "true"); // default true

      await prisma.donation.create({
        data: {
          constituentId:    constituent.id,
          campaignId,
          designationId,
          amount,
          date,
          paymentMethod:    normalizePaymentMethod(rec.paymentMethod ?? ""),
          checkNumber:      rec.checkNumber?.trim()  || undefined,
          transactionId:    rec.transactionId?.trim() || undefined,
          receiptNumber:    rec.receiptNumber?.trim() || undefined,
          feeAmount:        parseAmount(rec.feeAmount ?? "") ?? 0,
          status:           normalizeStatus(rec.status ?? ""),
          taxDeductible,
          isRecurring,
          frequency:        isRecurring ? (normalizeFrequency(rec.frequency ?? "") ?? undefined) : undefined,
          notes:            rec.notes?.trim()                || undefined,
          inKindDescription: rec.inKindDescription?.trim()  || undefined,
        },
      });

      // Update donor giving stats to reflect newly imported history
      await updateConstituentStats(constituent.id);

      created++;
    } catch (err) {
      errorMessages.push(err instanceof Error ? err.message : String(err));
    }
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────
  if (!dryRun) {
    logAudit({
      action: "DONATIONS_IMPORTED",
      entity: "Donation",
      userId: req.user?.sub,
      organizationId: resolvedOrgId,
      metadata: { created, skipped, unmatched, errors: errorMessages.length },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  res.json({ created, skipped, errors: errorMessages.length, unmatched, dryRun, errorMessages });
});


/**
 * DELETE /api/donations/:id — Permanently delete a donation record. Admin-only.
 * Used for batch-entry corrections; logs a NOTE activity on the donor's timeline
 * before deletion so the gift removal is auditable.
 */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.donation.findUnique({
    where: { id },
    select: { id: true, constituentId: true, amount: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  // Best-effort audit trail before the delete — keep history of what was removed.
  await prisma.activity.create({
    data: {
      constituentId: existing.constituentId,
      type: "NOTE",
      description: `Donation deleted: $${Number(existing.amount).toFixed(2)}`,
      metadata: { source: "api/donations:delete", donationId: existing.id },
    },
  });

  await prisma.donation.delete({ where: { id } });

  // Audit trail for donation deletion
  logAudit({
    action: "DONATION_DELETED",
    entity: "Donation",
    entityId: existing.id,
    userId: req.user?.sub,
    metadata: { amount: Number(existing.amount), constituentId: existing.constituentId },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(204).send();
});

export default router;
