/**
 * Authentication routes for OyamaCRM.
 * Handles user login, JWT refresh token rotation, logout, and current-user lookup.
 * Access tokens are returned in the JSON response body; refresh tokens are stored
 * in an HTTP-only cookie (`oyama_refresh`) to prevent XSS access.
 *
 * Routes:
 *   POST /api/auth/login   — credential validation and token issuance
 *   POST /api/auth/refresh — silent access-token renewal via refresh cookie
 *   POST /api/auth/logout  — revoke refresh token and clear cookie
 *   GET  /api/auth/me      — return the authenticated user's profile
 *
 * @module routes/auth
 */
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/** POST /api/auth/login — Validate email/password, issue access + refresh tokens. */
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email and password are required" } });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user || !user.active) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ error: { code: "NO_PASSWORD", message: "Account has no password set. Contact your administrator." } });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    // Log the failed attempt before returning generic error to avoid leaking user existence
    await logAudit({
      action: "LOGIN_FAILED",
      entity: "User",
      entityId: user.id,
      organizationId: user.organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
  }

  // Issue tokens
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.organizationId,
  });

  const refreshToken = signRefreshToken(user.id);

  // Persist refresh token so it can be validated and rotated on /refresh.
  // The token includes a random jti claim so it is always unique even under concurrent logins.
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Update last login
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await logAudit({
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
    userId: user.id,
    organizationId: user.organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

  return res.json({
    data: {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        avatarUrl: user.avatarUrl,
      },
    },
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

/**
 * POST /api/auth/refresh — Rotate refresh token and issue a new access token.
 * Implements refresh token rotation: the old token is deleted from the DB
 * and a new one is issued, providing single-use semantics to detect theft.
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if (!token) {
    return res.status(401).json({ error: { code: "NO_REFRESH_TOKEN", message: "No refresh token" } });
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ error: { code: "REFRESH_TOKEN_INVALID", message: "Refresh token is expired or invalid" } });
  }

  // Validate token exists in DB (rotation check)
  // If token is not found it may have already been used (possible token theft)
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.userId !== payload.sub || stored.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return res.status(401).json({ error: { code: "REFRESH_TOKEN_REVOKED", message: "Refresh token has been revoked" } });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    return res.status(401).json({ error: { code: "USER_INACTIVE", message: "Account is inactive" } });
  }

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { token } });

  const newRefresh = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.organizationId,
  });

  res.cookie(REFRESH_COOKIE, newRefresh, REFRESH_COOKIE_OPTIONS);

  return res.json({ data: { accessToken } });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

/** POST /api/auth/logout — Revoke the refresh token cookie and clear the session. */
router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if (token) {
    // Best-effort deletion; ignore if token is already gone
    await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
  }

  await logAudit({
    action: "LOGOUT",
    entity: "User",
    entityId: req.user!.sub,
    userId: req.user!.sub,
    organizationId: req.user!.orgId,
    ipAddress: req.ip,
  });

  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  return res.json({ data: { message: "Logged out" } });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/** GET /api/auth/me — Return the full profile of the currently authenticated user. */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      avatarUrl: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  if (!user || !user.active) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
  }

  return res.json({ data: user });
});

export default router;
