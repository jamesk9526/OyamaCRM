/**
 * OyamaPASSWORD routes.
 * Authenticated users can securely store, reveal, and share encrypted credentials.
 */
import { Router } from "express";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createOyamaPasswordEntry,
  deleteOyamaPasswordEntry,
  getOyamaPasswordEntry,
  getOyamaPasswordHealth,
  listOyamaPasswordEntries,
  listOyamaPasswordShares,
  removeOyamaPasswordShare,
  upsertOyamaPasswordShare,
  updateOyamaPasswordEntry,
} from "../services/oyama-password-store.js";

const router = Router();
router.use(requireAuth);

router.get("/health", async (_req, res) => {
  const health = await getOyamaPasswordHealth();
  res.json({ health });
});

router.get("/users", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const users = await prisma.user.findMany({
    where: { organizationId, active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  res.json({ items: users });
});

router.get("/entries", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const items = await listOyamaPasswordEntries({ organizationId, userId });
    res.json({ items });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/entries", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as {
    title?: string;
    username?: string;
    website?: string;
    password?: string;
    notes?: string;
  };

  const title = body.title?.trim() ?? "";
  const password = body.password ?? "";
  if (!title || !password) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "title and password are required.",
      },
    });
    return;
  }

  try {
    const item = await createOyamaPasswordEntry({
      organizationId,
      userId,
      title,
      username: body.username,
      website: body.website,
      password,
      notes: body.notes,
    });

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_CREATED",
      entity: "OyamaPasswordEntry",
      entityId: item.id,
      userId,
      organizationId,
      metadata: { title: item.title },
    });

    res.status(201).json({ item });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.get("/entries/:id", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const item = await getOyamaPasswordEntry({
      organizationId,
      userId,
      id: String(req.params.id ?? ""),
      revealSecret: false,
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found." } });
      return;
    }

    res.json({ item });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/entries/:id/reveal", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const item = await getOyamaPasswordEntry({
      organizationId,
      userId,
      id: String(req.params.id ?? ""),
      revealSecret: true,
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found." } });
      return;
    }

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_REVEALED",
      entity: "OyamaPasswordEntry",
      entityId: item.id,
      userId,
      organizationId,
    });

    res.json({ item });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.patch("/entries/:id", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as {
    title?: string;
    username?: string | null;
    website?: string | null;
    password?: string;
    notes?: string;
  };

  try {
    const item = await updateOyamaPasswordEntry({
      organizationId,
      userId,
      id: String(req.params.id ?? ""),
      title: body.title,
      username: body.username,
      website: body.website,
      password: body.password,
      notes: body.notes,
    });

    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found or not editable." } });
      return;
    }

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_UPDATED",
      entity: "OyamaPasswordEntry",
      entityId: item.id,
      userId,
      organizationId,
    });

    res.json({ item });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.delete("/entries/:id", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const deleted = await deleteOyamaPasswordEntry({
      organizationId,
      userId,
      id: String(req.params.id ?? ""),
    });

    if (!deleted) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found or not owned by user." } });
      return;
    }

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_DELETED",
      entity: "OyamaPasswordEntry",
      entityId: String(req.params.id ?? ""),
      userId,
      organizationId,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.get("/entries/:id/shares", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const items = await listOyamaPasswordShares({
      organizationId,
      userId,
      entryId: String(req.params.id ?? ""),
    });

    if (!items) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found or not editable." } });
      return;
    }

    res.json({ items });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/entries/:id/shares", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as { sharedWithUserId?: string; canEdit?: boolean };
  const sharedWithUserId = body.sharedWithUserId?.trim() ?? "";
  if (!sharedWithUserId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "sharedWithUserId is required." } });
    return;
  }

  try {
    const success = await upsertOyamaPasswordShare({
      organizationId,
      userId,
      entryId: String(req.params.id ?? ""),
      sharedWithUserId,
      canEdit: Boolean(body.canEdit),
    });

    if (!success) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Password entry not found or not editable." } });
      return;
    }

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_SHARED",
      entity: "OyamaPasswordEntry",
      entityId: String(req.params.id ?? ""),
      userId,
      organizationId,
      metadata: { sharedWithUserId, canEdit: Boolean(body.canEdit) },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.delete("/entries/:id/shares/:sharedWithUserId", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const success = await removeOyamaPasswordShare({
      organizationId,
      userId,
      entryId: String(req.params.id ?? ""),
      sharedWithUserId: String(req.params.sharedWithUserId ?? ""),
    });

    if (!success) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Share not found or entry not editable." } });
      return;
    }

    await logAudit({
      action: "OYAMA_PASSWORD_ENTRY_UNSHARED",
      entity: "OyamaPasswordEntry",
      entityId: String(req.params.id ?? ""),
      userId,
      organizationId,
      metadata: { sharedWithUserId: String(req.params.sharedWithUserId ?? "") },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

export default router;
