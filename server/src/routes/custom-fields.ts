/**
 * Custom Fields routes for OyamaCRM.
 * Allows organizations to define and manage additional fields beyond the built-in data model.
 * Fields are scoped to entity types: constituent, donation, campaign, event.
 * Values are stored separately in CustomFieldValue per entity instance.
 *
 * Routes:
 *   GET    /api/custom-fields                              — list fields (filter by entityType)
 *   POST   /api/custom-fields                              — create a field (manager+)
 *   PUT    /api/custom-fields/:id                          — update a field (manager+)
 *   DELETE /api/custom-fields/:id                          — delete a field and all values (admin)
 *   GET    /api/custom-fields/values/:entityType/:entityId — get values for an entity
 *   PUT    /api/custom-fields/values/:entityType/:entityId — upsert values for an entity
 *
 * @module routes/custom-fields
 */
import { Router, Request, Response } from "express";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// All custom field routes require authentication.
router.use(requireAuth);

/** Valid entity types that can have custom fields attached. */
const VALID_ENTITY_TYPES = ["constituent", "donation", "campaign", "event"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

/** Valid field types supported by the custom field system. */
const VALID_FIELD_TYPES = [
  "text", "textarea", "number", "boolean",
  "date", "select", "multiselect",
  "url", "email", "phone",
] as const;

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/custom-fields — List custom fields for the authenticated user's organization.
 * Optional query params:
 *   ?entityType=constituent|donation|campaign|event
 *   ?includeInactive=true to include inactive fields
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    // Safely extract string query params
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const includeInactive = req.query.includeInactive === "true";

    if (entityType && !VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
      res.status(400).json({
        error: { code: "INVALID_ENTITY_TYPE", message: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` },
      });
      return;
    }

    const where = {
      organizationId: orgId,
      ...(entityType ? { entityType } : {}),
      ...(!includeInactive ? { active: true } : {}),
    };

    const fields = await prisma.customField.findMany({
      where,
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    res.json({ data: fields, total: fields.length });
  } catch (err) {
    console.error("[custom-fields] GET /", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list custom fields" } });
  }
});

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * POST /api/custom-fields — Create a new custom field for the organization.
 * Requires manager or admin role.
 *
 * Body: { entityType, name, key, fieldType, options?, required?, description?, placeholder?, defaultValue?, sortOrder? }
 */
router.post("/", requireRole("manager"), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    const {
      entityType, name, key, fieldType,
      options, required, description,
      placeholder, defaultValue, sortOrder,
    } = req.body as {
      entityType?: string;
      name?: string;
      key?: string;
      fieldType?: string;
      options?: string[];
      required?: boolean;
      description?: string;
      placeholder?: string;
      defaultValue?: string;
      sortOrder?: number;
    };

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
      res.status(400).json({ error: { code: "INVALID_ENTITY_TYPE", message: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` } });
      return;
    }
    if (!name?.trim()) {
      res.status(400).json({ error: { code: "NAME_REQUIRED", message: "name is required" } });
      return;
    }
    if (!key?.trim()) {
      res.status(400).json({ error: { code: "KEY_REQUIRED", message: "key is required" } });
      return;
    }
    if (!fieldType || !VALID_FIELD_TYPES.includes(fieldType as (typeof VALID_FIELD_TYPES)[number])) {
      res.status(400).json({ error: { code: "INVALID_FIELD_TYPE", message: `fieldType must be one of: ${VALID_FIELD_TYPES.join(", ")}` } });
      return;
    }
    // Validate key format: camelCase only
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
      res.status(400).json({ error: { code: "INVALID_KEY", message: "key must be camelCase (letters and digits only, starting with a lowercase letter)" } });
      return;
    }
    if ((fieldType === "select" || fieldType === "multiselect") && (!options || options.length === 0)) {
      res.status(400).json({ error: { code: "OPTIONS_REQUIRED", message: "options array is required for select/multiselect fields" } });
      return;
    }

    const field = await prisma.customField.create({
      data: {
        organizationId: orgId,
        entityType,
        name: name.trim(),
        key: key.trim(),
        fieldType,
        options: options ? JSON.stringify(options) : null,
        required: required ?? false,
        description: description?.trim() ?? null,
        placeholder: placeholder?.trim() ?? null,
        defaultValue: defaultValue?.trim() ?? null,
        sortOrder: sortOrder ?? 0,
        active: true,
      },
    });

    await logAudit({
      userId,
      organizationId: orgId,
      action: "custom_field.create",
      entity: "CustomField",
      entityId: field.id,
      metadata: { entityType, name, key, fieldType },
      ipAddress: req.ip,
    });

    res.status(201).json({ data: field });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      res.status(409).json({ error: { code: "KEY_CONFLICT", message: "A field with that key already exists for this entity type" } });
      return;
    }
    console.error("[custom-fields] POST /", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create custom field" } });
  }
});

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * PUT /api/custom-fields/:id — Update a custom field's metadata.
 * key and entityType cannot change after creation (would break stored values).
 * Requires manager or admin role.
 */
router.put("/:id", requireRole("manager"), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    const fieldId = req.params.id as string;

    const existing = await prisma.customField.findFirst({
      where: { id: fieldId, organizationId: orgId },
    });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Custom field not found" } });
      return;
    }

    const {
      name, options, required, description,
      placeholder, defaultValue, sortOrder, active,
    } = req.body as {
      name?: string;
      options?: string[];
      required?: boolean;
      description?: string;
      placeholder?: string;
      defaultValue?: string;
      sortOrder?: number;
      active?: boolean;
    };

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(options !== undefined ? { options: JSON.stringify(options) } : {}),
        ...(required !== undefined ? { required } : {}),
        ...(description !== undefined ? { description: description.trim() || null } : {}),
        ...(placeholder !== undefined ? { placeholder: placeholder.trim() || null } : {}),
        ...(defaultValue !== undefined ? { defaultValue: defaultValue.trim() || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });

    await logAudit({
      userId,
      organizationId: orgId,
      action: "custom_field.update",
      entity: "CustomField",
      entityId: fieldId,
      metadata: req.body as Record<string, unknown>,
      ipAddress: req.ip,
    });

    res.json({ data: updated });
  } catch (err) {
    console.error("[custom-fields] PUT /:id", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update custom field" } });
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * DELETE /api/custom-fields/:id — Permanently delete a custom field and all its values.
 * Cascaded delete of CustomFieldValue is handled by Prisma schema (onDelete: Cascade).
 * Admin-only.
 */
router.delete("/:id", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    const fieldId = req.params.id as string;

    const existing = await prisma.customField.findFirst({
      where: { id: fieldId, organizationId: orgId },
    });
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Custom field not found" } });
      return;
    }

    await prisma.customField.delete({ where: { id: fieldId } });

    await logAudit({
      userId,
      organizationId: orgId,
      action: "custom_field.delete",
      entity: "CustomField",
      entityId: fieldId,
      metadata: { name: existing.name, key: existing.key, entityType: existing.entityType },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[custom-fields] DELETE /:id", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete custom field" } });
  }
});

// ─── Values: Get ──────────────────────────────────────────────────────────────

/**
 * GET /api/custom-fields/values/:entityType/:entityId
 * Returns all active custom field values for one entity instance.
 * Response: { data: Record<fieldKey, value>, fields: CustomField[] }
 */
router.get("/values/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;

    if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
      res.status(400).json({ error: { code: "INVALID_ENTITY_TYPE", message: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` } });
      return;
    }

    const fields = await prisma.customField.findMany({
      where: { organizationId: orgId, entityType, active: true },
    });

    const fieldIds = fields.map((f) => f.id);

    const storedValues = await prisma.customFieldValue.findMany({
      where: { entityId, entityType, fieldId: { in: fieldIds } },
    });

    // Build key→parsed-value map
    const valuesByKey: Record<string, unknown> = {};
    for (const f of fields) {
      const v = storedValues.find((sv) => sv.fieldId === f.id);
      if (v?.value !== null && v?.value !== undefined) {
        try { valuesByKey[f.key] = JSON.parse(v.value); } catch { valuesByKey[f.key] = v.value; }
      } else {
        valuesByKey[f.key] = null;
      }
    }

    res.json({ data: valuesByKey, fields });
  } catch (err) {
    console.error("[custom-fields] GET /values/:entityType/:entityId", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get custom field values" } });
  }
});

// ─── Values: Upsert ───────────────────────────────────────────────────────────

/**
 * PUT /api/custom-fields/values/:entityType/:entityId
 * Upsert custom field values for one entity instance.
 * Body: { values: Record<fieldKey, value> } — unknown keys are silently ignored.
 */
router.put("/values/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization context" } });
      return;
    }

    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const { values } = req.body as { values?: Record<string, unknown> };

    if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
      res.status(400).json({ error: { code: "INVALID_ENTITY_TYPE", message: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` } });
      return;
    }
    if (!values || typeof values !== "object") {
      res.status(400).json({ error: { code: "VALUES_REQUIRED", message: "values object is required in the request body" } });
      return;
    }

    const fields = await prisma.customField.findMany({
      where: { organizationId: orgId, entityType, active: true },
    });

    const fieldsByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

    const upsertOps = Object.entries(values)
      .filter(([key]) => key in fieldsByKey)
      .map(([key, val]) => {
        const f = fieldsByKey[key];
        const serialized = val !== null && val !== undefined ? JSON.stringify(val) : null;
        return prisma.customFieldValue.upsert({
          where: { fieldId_entityId: { fieldId: f.id, entityId } },
          create: { fieldId: f.id, entityId, entityType, value: serialized },
          update: { value: serialized },
        });
      });

    await prisma.$transaction(upsertOps);

    res.json({ success: true, updated: upsertOps.length });
  } catch (err) {
    console.error("[custom-fields] PUT /values/:entityType/:entityId", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to save custom field values" } });
  }
});

export default router;
