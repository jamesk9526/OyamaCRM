import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();
// Domain-separated signing key: feedback capabilities can never authenticate as CRM users.
const secret = () => crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-jwt-secret-UNSAFE").update("oyama-feedback-capability-v1").digest("hex");
const reasons = new Set(["helpful", "accurate", "clear", "incorrect", "missing_context", "unsafe", "slow", "format", "runtime_error", "other"]);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
async function saveReport(orgId: string, userId: string | null, body: Record<string, unknown>, source: string) {
  const reportId = text(body.reportId, 80);
  const rating = text(body.rating, 12);
  const reason = text(body.reason, 40);
  if (!/^[a-z0-9-]{16,80}$/i.test(reportId) || !["up", "down", "error"].includes(rating) || !reasons.has(reason)) return null;
  const id = `steward-feedback-${reportId}`;
  const metadata = { reportId, rating, reason, source, note: text(body.note, 1500), model: text(body.model, 120), provider: text(body.provider, 60), messageId: text(body.messageId, 100), excerpt: text(body.excerpt, 2000), status: "new" };
  try {
    await prisma.auditLog.create({ data: { id, organizationId: orgId, userId, action: "STEWARD_IMPROVEMENT_REPORT", entity: "StewardFeedback", entityId: reportId, metadata } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.auditLog.findUnique({ where: { id }, select: { organizationId: true } });
    if (existing?.organizationId !== orgId) throw new Error("Report identifier conflict.");
  }
  return reportId;
}

// A purpose-bound capability can only append feedback for its own tenant; it grants no CRM reads.
router.post("/bridge", rateLimit({ windowMs: 60000, limit: 30 }), async (req, res) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
    const claim = jwt.verify(token, secret(), { algorithms: ["HS256"], audience: "oyama-steward-feedback" });
    if (typeof claim === "string" || claim.purpose !== "bridge-feedback" || typeof claim.orgId !== "string") { res.status(401).json({ error: { message: "Invalid feedback connection." } }); return; }
    const id = await saveReport(claim.orgId, null, req.body || {}, "desktop");
    if (!id) { res.status(400).json({ error: { message: "Choose a valid feedback rating and reason." } }); return; }
    res.json({ data: { reportId: id, saved: true } });
  } catch (error) { res.status(error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError ? 401 : 503).json({ error: { message: "Report could not be accepted. Retry or renew the feedback connection." } }); }
});
router.use(requireAuth);
router.post("/", rateLimit({ windowMs: 60000, limit: 30 }), async (req, res) => {
  try {
    if (!req.user?.orgId) { res.status(400).json({ error: { message: "Organization required." } }); return; }
    const id = await saveReport(req.user.orgId, req.user.sub, req.body || {}, "crm");
    if (!id) { res.status(400).json({ error: { message: "Choose a valid feedback rating and reason." } }); return; }
    res.json({ data: { reportId: id, saved: true } });
  } catch { res.status(503).json({ error: { message: "Feedback was not saved. Please retry." } }); }
});
router.get("/", requireRole("admin"), async (req, res) => {
  if (!req.user?.orgId) { res.status(400).json({ error: { message: "Organization required." } }); return; }
  const items = await prisma.auditLog.findMany({ where: { organizationId: req.user!.orgId, action: "STEWARD_IMPROVEMENT_REPORT" }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, createdAt: true, metadata: true } });
  res.json({ data: { items } });
});
router.post("/connection", requireRole("admin"), (req, res) => {
  if (!req.user?.orgId) { res.status(400).json({ error: { message: "Organization required." } }); return; }
  const token = jwt.sign({ purpose: "bridge-feedback", orgId: req.user.orgId, jti: crypto.randomUUID() }, secret(), { algorithm: "HS256", audience: "oyama-steward-feedback", expiresIn: "30d" });
  res.json({ data: { token, expiresInDays: 30 } });
});
export default router;
