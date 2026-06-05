/**
 * OyamaPASSWORD routes.
 * Authenticated users can securely store, reveal, and share encrypted credentials.
 */
import { Router } from "express";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createOyamaPasswordBackup,
  createOyamaPasswordEntry,
  deleteOyamaPasswordEntry,
  getOyamaPasswordEntry,
  getOyamaPasswordHealth,
  getOyamaPasswordPinStatus,
  listOyamaPasswordBackups,
  listOyamaPasswordEntries,
  listOyamaPasswordShares,
  removeOyamaPasswordShare,
  restoreOyamaPasswordBackup,
  setupOyamaPasswordPin,
  upsertOyamaPasswordShare,
  updateOyamaPasswordEntry,
  validateOyamaPasswordPinSession,
  verifyOyamaPasswordPin,
} from "../services/oyama-password-store.js";

const router = Router();
router.use(requireAuth);

// Permission guardrails for password vault workflows.
router.use((req, res, next) => {
  if (req.method === "GET" && req.path === "/health") {
    return requirePermission("oyama_password.view")(req, res, next);
  }

  if (req.path.startsWith("/pin/")) {
    return requirePermission("oyama_password.view")(req, res, next);
  }

  if (req.method === "GET" && (req.path === "/users" || req.path === "/entries" || req.path.startsWith("/entries/"))) {
    return requirePermission("oyama_password.view")(req, res, next);
  }

  if (req.method === "POST" && req.path === "/entries") {
    return requirePermission("oyama_password.create")(req, res, next);
  }

  if (req.method === "POST" && req.path.endsWith("/reveal")) {
    return requirePermission("oyama_password.reveal")(req, res, next);
  }

  if (req.method === "PATCH" && req.path.startsWith("/entries/")) {
    return requirePermission("oyama_password.edit")(req, res, next);
  }

  if (req.method === "DELETE" && req.path.startsWith("/entries/") && req.path.includes("/shares/")) {
    return requirePermission("oyama_password.share")(req, res, next);
  }

  if (req.method === "POST" && req.path.endsWith("/shares")) {
    return requirePermission("oyama_password.share")(req, res, next);
  }

  if (req.method === "DELETE" && req.path.startsWith("/entries/")) {
    return requirePermission("oyama_password.delete")(req, res, next);
  }

  if (req.path.startsWith("/backups") && req.method === "GET") {
    return requirePermission("oyama_password.backup")(req, res, next);
  }

  if (req.path === "/backups" && req.method === "POST") {
    return requirePermission("oyama_password.backup")(req, res, next);
  }

  if (req.path === "/backups/restore" && req.method === "POST") {
    return requirePermission("oyama_password.restore")(req, res, next);
  }

  return next();
});

router.use(async (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/pin/")) {
    next();
    return;
  }

  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  const sessionToken = String(req.headers["x-oyama-password-pin-session"] ?? "").trim();

  if (!userId || !organizationId || !sessionToken) {
    res.status(423).json({
      error: {
        code: "PASSWORD_VAULT_PIN_REQUIRED",
        message: "Unlock the vault with your PIN before accessing vault records.",
      },
    });
    return;
  }

  const valid = await validateOyamaPasswordPinSession({ organizationId, userId, sessionToken });
  if (!valid) {
    res.status(423).json({
      error: {
        code: "PASSWORD_VAULT_PIN_INVALID",
        message: "PIN session expired. Verify your PIN again.",
      },
    });
    return;
  }

  next();
});

router.get("/health", async (_req, res) => {
  const health = await getOyamaPasswordHealth();
  res.json({ health });
});

router.get("/pin/status", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  try {
    const status = await getOyamaPasswordPinStatus({ organizationId, userId });
    res.json(status);
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/pin/setup", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as { pin?: string };
  if (!body.pin?.trim()) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "PIN is required." } });
    return;
  }

  try {
    const session = await setupOyamaPasswordPin({ organizationId, userId, pin: body.pin.trim() });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: { code: "PIN_SETUP_FAILED", message: error instanceof Error ? error.message : "Failed to set PIN." } });
  }
});

router.post("/pin/verify", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as { pin?: string };
  if (!body.pin?.trim()) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "PIN is required." } });
    return;
  }

  try {
    const session = await verifyOyamaPasswordPin({ organizationId, userId, pin: body.pin.trim() });
    res.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid PIN.";
    const statusCode = /locked until/i.test(message) ? 423 : 401;
    res.status(statusCode).json({ error: { code: "PIN_VERIFY_FAILED", message } });
  }
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
    const items = await listOyamaPasswordEntries({ organizationId, userId, role: req.user?.role });
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
    hasMfa?: boolean;
    mfaMethod?: string;
    mfaConnectedTo?: string;
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
      hasMfa: Boolean(body.hasMfa),
      mfaMethod: body.mfaMethod,
      mfaConnectedTo: body.mfaConnectedTo,
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
      role: req.user?.role,
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
      role: req.user?.role,
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
    hasMfa?: boolean;
    mfaMethod?: string;
    mfaConnectedTo?: string;
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
      hasMfa: body.hasMfa,
      mfaMethod: body.mfaMethod,
      mfaConnectedTo: body.mfaConnectedTo,
      role: req.user?.role,
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
      role: req.user?.role,
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
      role: req.user?.role,
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
      role: req.user?.role,
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
      role: req.user?.role,
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

router.get("/backups", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  try {
    const items = await listOyamaPasswordBackups({ organizationId });
    res.json({ items });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/backups", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as { label?: string };

  try {
    const { item, lockedFileContents } = await createOyamaPasswordBackup({
      organizationId,
      userId,
      label: body.label,
    });

    await logAudit({
      action: "OYAMA_PASSWORD_BACKUP_CREATED",
      entity: "OyamaPasswordBackup",
      entityId: item.id,
      userId,
      organizationId,
      metadata: { label: item.label, fileName: item.fileName },
    });

    res.status(201).json({ item, lockedFileContents });
  } catch (error) {
    res.status(503).json({ error: { code: "PASSWORD_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Secure password store unavailable." } });
  }
});

router.post("/backups/restore", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId || !organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Missing auth or organization context." } });
    return;
  }

  const body = req.body as {
    lockedFileContents?: string;
    mode?: "merge" | "replace";
  };

  if (!body.lockedFileContents?.trim()) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "lockedFileContents is required." } });
    return;
  }

  try {
    const result = await restoreOyamaPasswordBackup({
      organizationId,
      userId,
      lockedFileContents: body.lockedFileContents,
      mode: body.mode,
    });

    await logAudit({
      action: "OYAMA_PASSWORD_BACKUP_RESTORED",
      entity: "OyamaPasswordBackup",
      entityId: organizationId,
      userId,
      organizationId,
      metadata: result,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: { code: "PASSWORD_BACKUP_RESTORE_FAILED", message: error instanceof Error ? error.message : "Failed to restore password vault backup." } });
  }
});

export default router;
