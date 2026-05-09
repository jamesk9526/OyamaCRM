/**
 * OyamaCRM API server entry point.
 * Configures and starts the Express application with CORS, cookie parsing,
 * JSON body parsing, and all API route modules.
 * Also exposes a `/health` endpoint for liveness/readiness probes.
 *
 * Environment variables:
 *   API_PORT            — port to listen on (default: 4000)
 *   NEXT_PUBLIC_API_URL — additional CORS origin allowed alongside localhost:3000
 *   NODE_ENV            — controls logging verbosity and secure cookie flag
 *
 * @module index
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

import authRoutes from "./routes/auth.js";
import constituentRoutes from "./routes/constituents.js";
import donationRoutes from "./routes/donations.js";
import campaignRoutes from "./routes/campaigns.js";
import designationRoutes from "./routes/designations.js";
import taskRoutes from "./routes/tasks.js";
import reportRoutes from "./routes/reports.js";
import householdRoutes from "./routes/households.js";
import emailCampaignRoutes from "./routes/email-campaigns.js";
import settingsRoutes from "./routes/settings.js";
import automationRoutes from "./routes/automations.js";
import eventRoutes from "./routes/events.js";
import setupRoutes from "./routes/setup.js";
import userRoutes from "./routes/users.js";
import auditLogRoutes from "./routes/audit-logs.js";
import customFieldRoutes from "./routes/custom-fields.js";
import grantRoutes from "./routes/grants.js";
import meetingRoutes from "./routes/meetings.js";
import compassionRoutes from "./routes/compassion.js";
import quickbooksRoutes from "./routes/quickbooks.js";
import { prisma } from "./lib/prisma.js";
import { getAppInfo } from "./lib/app-info.js";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 4000;
const startTime = Date.now();

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Global rate limiter — 200 requests per minute per IP.
 * Auth routes use a tighter limiter (20/min) defined below.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests — please slow down." } },
});

/** Tight rate limiter for auth endpoints to limit brute-force attempts. */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many auth attempts — try again in a minute." } },
});

app.use(globalLimiter);

app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_API_URL
      ? [process.env.NEXT_PUBLIC_API_URL, "http://localhost:3000"]
      : "http://localhost:3000",
    credentials: true,
  })
);

// Import endpoint can receive 800+ records as JSON — raise the limit to 20 MB.
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
app.disable("x-powered-by");

// ─── Health / readiness ───────────────────────────────────────────────────────

/** Shared health handler for liveness/readiness probes. */
async function healthHandler(_req: express.Request, res: express.Response) {
  let dbStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }
  const appInfo = getAppInfo();
  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    appName: appInfo.appName,
    version: appInfo.version,
    buildDate: appInfo.buildDate,
    gitCommit: appInfo.gitCommit,
    releaseChannel: appInfo.releaseChannel,
    database: dbStatus,
    environment: appInfo.environment,
    lastAuditDate: appInfo.lastAuditDate,
    uptimeSec: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}

/** GET /health — Liveness/readiness probe used by process managers and local development. */
app.get("/health", healthHandler);

/** GET /api/health — API-prefixed health probe for frontend/admin diagnostics. */
app.get("/api/health", healthHandler);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes get a stricter rate limit to prevent brute-force
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/constituents", constituentRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/households", householdRoutes);
app.use("/api/email-campaigns", emailCampaignRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/setup", setupRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/custom-fields", customFieldRoutes);
app.use("/api/grants", grantRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/compassion", compassionRoutes);
app.use("/api/quickbooks", quickbooksRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // In production, suppress stack traces from stderr to avoid leaking internals.
  // In development, log the full stack for easier debugging.
  if (process.env.NODE_ENV === "production") {
    console.error(`[ERROR] ${err.name}: ${err.message}`);
  } else {
    console.error(err.stack);
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
});

// ─── Start ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[API] OyamaCRM API server running on http://localhost:${PORT}`);
  });
}

export default app;
