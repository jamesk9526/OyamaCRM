/**
 * Authentication routes for OyamaCRM.
 * Handles user login, email-MFA challenge verification, password reset,
 * JWT refresh token rotation, logout, and current-user lookup.
 * Access tokens are returned in the JSON response body; refresh tokens are stored
 * in an HTTP-only cookie (`oyama_refresh`) to prevent XSS access.
 *
 * Routes:
 *   POST /api/auth/login   — credential validation and token issuance
 *   POST /api/auth/mfa/verify — validate one email MFA code and finish login
 *   POST /api/auth/forgot-password — issue one password reset email
 *   POST /api/auth/reset-password — consume reset token and update password
 *   POST /api/auth/refresh — silent access-token renewal via refresh cookie
 *   POST /api/auth/logout  — revoke refresh token and clear cookie
 *   GET  /api/auth/me      — return the authenticated user's profile
 *
 * @module routes/auth
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTIONS,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { logAudit } from "../lib/audit.js";
import { getAuthSecuritySettingsForOrganization } from "../services/auth-security.js";
import { sendOrganizationEmail } from "../services/smtp-service.js";

const router = Router();
const PASSWORD_RESET_PREFIX = "auth-password-reset:token:";
const MFA_CHALLENGE_PREFIX = "auth-mfa:ticket:";

interface PasswordResetTokenConfig {
  kind: "PASSWORD_RESET";
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  requestedIp?: string;
  usedAt?: string;
}

interface MfaChallengeConfig {
  kind: "EMAIL_MFA";
  userId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  destinationHint: string;
  ipAddress?: string;
}

/** Computes one deterministic SHA-256 hash for reset tokens and MFA codes. */
function hashSecret(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

/** Returns a short masked email hint for challenge UI messaging. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "hidden@email";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Builds one 6-digit code used for email-based second-step verification. */
function createMfaCode(): string {
  return Array.from({ length: 6 }, () => randomInt(0, 10)).join("");
}

/** Returns a short, actionable password-policy error when requirements are not met. */
function getPasswordPolicyIssue(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const categoryCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (categoryCount < 3) {
    return "Password must include at least 3 of: lowercase, uppercase, number, symbol.";
  }
  return null;
}

/** Builds a plugin key for one password reset token hash row. */
function passwordResetPluginKey(tokenHash: string): string {
  return `${PASSWORD_RESET_PREFIX}${tokenHash}`;
}

/** Builds a plugin key for one email MFA login challenge ticket. */
function mfaChallengePluginKey(ticket: string): string {
  return `${MFA_CHALLENGE_PREFIX}${ticket}`;
}

/** Runtime validation for password-reset token config loaded from plugin settings JSON. */
function parsePasswordResetConfig(value: unknown): PasswordResetTokenConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.kind !== "PASSWORD_RESET"
    || typeof raw.userId !== "string"
    || typeof raw.email !== "string"
    || typeof raw.tokenHash !== "string"
    || typeof raw.expiresAt !== "string"
    || typeof raw.createdAt !== "string"
  ) {
    return null;
  }
  return {
    kind: "PASSWORD_RESET",
    userId: raw.userId,
    email: raw.email,
    tokenHash: raw.tokenHash,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
    requestedIp: typeof raw.requestedIp === "string" ? raw.requestedIp : undefined,
    usedAt: typeof raw.usedAt === "string" ? raw.usedAt : undefined,
  };
}

/** Runtime validation for email-MFA challenge config loaded from plugin settings JSON. */
function parseMfaChallengeConfig(value: unknown): MfaChallengeConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    raw.kind !== "EMAIL_MFA"
    || typeof raw.userId !== "string"
    || typeof raw.codeHash !== "string"
    || typeof raw.expiresAt !== "string"
    || typeof raw.attempts !== "number"
    || typeof raw.destinationHint !== "string"
  ) {
    return null;
  }
  return {
    kind: "EMAIL_MFA",
    userId: raw.userId,
    codeHash: raw.codeHash,
    expiresAt: raw.expiresAt,
    attempts: raw.attempts,
    destinationHint: raw.destinationHint,
    ipAddress: typeof raw.ipAddress === "string" ? raw.ipAddress : undefined,
  };
}

/** Deletes all prior reset-token rows for one user so only one active reset remains. */
async function clearExistingPasswordResetTokens(organizationId: string, userId: string): Promise<void> {
  const rows = await prisma.pluginSetting.findMany({
    where: {
      organizationId,
      pluginKey: { startsWith: PASSWORD_RESET_PREFIX },
    },
    select: { id: true, config: true },
    take: 200,
  });

  const staleIds = rows
    .filter((row) => parsePasswordResetConfig(row.config)?.userId === userId)
    .map((row) => row.id);

  if (staleIds.length === 0) return;

  await prisma.pluginSetting.deleteMany({
    where: {
      id: { in: staleIds },
    },
  });
}

/** Issues access + refresh tokens and writes associated session/audit records. */
async function issueSessionForUser(input: {
  req: Request;
  res: Response;
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  loginAction: "LOGIN" | "LOGIN_MFA";
}): Promise<void> {
  const accessToken = signAccessToken({
    sub: input.user.id,
    email: input.user.email,
    role: input.user.role,
    orgId: input.user.organizationId,
  });

  const refreshToken = signRefreshToken(input.user.id);

  await prisma.refreshToken.create({
    data: {
      userId: input.user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.user.update({ where: { id: input.user.id }, data: { lastLoginAt: new Date() } });

  await logAudit({
    action: input.loginAction,
    entity: "User",
    entityId: input.user.id,
    userId: input.user.id,
    organizationId: input.user.organizationId,
    ipAddress: input.req.ip,
    userAgent: input.req.headers["user-agent"],
  });

  input.res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

  input.res.json({
    data: {
      accessToken,
      user: {
        id: input.user.id,
        email: input.user.email,
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        role: input.user.role,
        organizationId: input.user.organizationId,
        avatarUrl: input.user.avatarUrl,
      },
    },
  });
}

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

  const authSecurity = await getAuthSecuritySettingsForOrganization(user.organizationId);

  if (authSecurity.emailMfaEnabled) {
    const ticket = randomBytes(24).toString("base64url");
    const code = createMfaCode();
    const codeHash = hashSecret(code);
    const expiresAt = new Date(Date.now() + authSecurity.mfaCodeTtlMinutes * 60 * 1000);

    const challengeConfig: MfaChallengeConfig = {
      kind: "EMAIL_MFA",
      userId: user.id,
      codeHash,
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      destinationHint: maskEmail(user.email),
      ipAddress: req.ip,
    };

    await prisma.pluginSetting.upsert({
      where: {
        organizationId_pluginKey: {
          organizationId: user.organizationId,
          pluginKey: mfaChallengePluginKey(ticket),
        },
      },
      create: {
        organizationId: user.organizationId,
        pluginKey: mfaChallengePluginKey(ticket),
        enabled: true,
        config: challengeConfig,
      },
      update: {
        enabled: true,
        config: challengeConfig,
      },
    });

    try {
      await sendOrganizationEmail({
        organizationId: user.organizationId,
        to: user.email,
        subject: "Your OyamaCRM sign-in code",
        text: `Your sign-in code is ${code}. It expires in ${authSecurity.mfaCodeTtlMinutes} minutes.`,
        html: `<p>Your sign-in code is <strong>${code}</strong>.</p><p>This code expires in ${authSecurity.mfaCodeTtlMinutes} minutes.</p>`,
      });
    } catch {
      await prisma.pluginSetting.deleteMany({
        where: {
          organizationId: user.organizationId,
          pluginKey: mfaChallengePluginKey(ticket),
        },
      });

      await logAudit({
        action: "LOGIN_MFA_SEND_FAILED",
        entity: "User",
        entityId: user.id,
        organizationId: user.organizationId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.status(503).json({
        error: {
          code: "MFA_EMAIL_FAILED",
          message: "Email-based MFA is enabled but verification email could not be sent. Check SMTP settings.",
        },
      });
    }

    await logAudit({
      action: "LOGIN_MFA_CHALLENGE_SENT",
      entity: "User",
      entityId: user.id,
      organizationId: user.organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      data: {
        mfaRequired: true,
        mfaTicket: ticket,
        destinationHint: maskEmail(user.email),
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  await issueSessionForUser({
    req,
    res,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      avatarUrl: user.avatarUrl,
    },
    loginAction: "LOGIN",
  });
});

/** POST /api/auth/mfa/verify — Validate one email MFA challenge and complete login session issuance. */
router.post("/mfa/verify", async (req: Request, res: Response) => {
  const ticket = typeof req.body?.ticket === "string" ? req.body.ticket.trim() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

  if (!ticket || !code) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "ticket and code are required" },
    });
  }

  const challenge = await prisma.pluginSetting.findFirst({
    where: { pluginKey: mfaChallengePluginKey(ticket) },
    select: { id: true, organizationId: true, pluginKey: true, config: true },
  });

  if (!challenge) {
    return res.status(401).json({ error: { code: "MFA_INVALID", message: "Verification code is invalid or expired" } });
  }

  const config = parseMfaChallengeConfig(challenge.config);
  if (!config) {
    await prisma.pluginSetting.delete({ where: { id: challenge.id } }).catch(() => {});
    return res.status(401).json({ error: { code: "MFA_INVALID", message: "Verification code is invalid or expired" } });
  }

  if (new Date(config.expiresAt).getTime() <= Date.now()) {
    await prisma.pluginSetting.delete({ where: { id: challenge.id } }).catch(() => {});
    return res.status(401).json({ error: { code: "MFA_EXPIRED", message: "Verification code has expired" } });
  }

  const submittedHash = hashSecret(code);
  if (submittedHash !== config.codeHash) {
    const nextAttempts = config.attempts + 1;
    if (nextAttempts >= 5) {
      await prisma.pluginSetting.delete({ where: { id: challenge.id } }).catch(() => {});
    } else {
      await prisma.pluginSetting.update({
        where: { id: challenge.id },
        data: {
          config: {
            ...config,
            attempts: nextAttempts,
          },
        },
      });
    }

    await logAudit({
      action: "LOGIN_MFA_FAILED",
      entity: "User",
      entityId: config.userId,
      organizationId: challenge.organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { attempts: nextAttempts },
    });

    return res.status(401).json({ error: { code: "MFA_INVALID", message: "Verification code is invalid or expired" } });
  }

  const user = await prisma.user.findUnique({ where: { id: config.userId } });
  if (!user || !user.active) {
    await prisma.pluginSetting.delete({ where: { id: challenge.id } }).catch(() => {});
    return res.status(401).json({ error: { code: "USER_INACTIVE", message: "Account is inactive" } });
  }

  await prisma.pluginSetting.delete({ where: { id: challenge.id } }).catch(() => {});

  await issueSessionForUser({
    req,
    res,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      avatarUrl: user.avatarUrl,
    },
    loginAction: "LOGIN_MFA",
  });
});

/** POST /api/auth/forgot-password — Issues a password-reset email if account exists. */
router.post("/forgot-password", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const genericResponse = {
    data: {
      message: "If that email exists, a password reset link has been sent.",
    },
  };

  if (!email) {
    return res.json(genericResponse);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return res.json(genericResponse);
  }

  const authSecurity = await getAuthSecuritySettingsForOrganization(user.organizationId);
  if (!authSecurity.passwordResetEnabled) {
    return res.json(genericResponse);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + authSecurity.passwordResetTtlMinutes * 60 * 1000);

  await clearExistingPasswordResetTokens(user.organizationId, user.id);

  const config: PasswordResetTokenConfig = {
    kind: "PASSWORD_RESET",
    userId: user.id,
    email: user.email,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    requestedIp: req.ip,
  };

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId: user.organizationId,
        pluginKey: passwordResetPluginKey(tokenHash),
      },
    },
    create: {
      organizationId: user.organizationId,
      pluginKey: passwordResetPluginKey(tokenHash),
      enabled: true,
      config,
    },
    update: {
      enabled: true,
      config,
    },
  });

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const resetUrl = `${appBase}/login/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendOrganizationEmail({
      organizationId: user.organizationId,
      to: user.email,
      subject: "Reset your OyamaCRM password",
      text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in ${authSecurity.passwordResetTtlMinutes} minutes.`,
      html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in ${authSecurity.passwordResetTtlMinutes} minutes.</p>`,
    });

    await logAudit({
      action: "PASSWORD_RESET_REQUESTED",
      entity: "User",
      entityId: user.id,
      organizationId: user.organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch {
    await logAudit({
      action: "PASSWORD_RESET_EMAIL_FAILED",
      entity: "User",
      entityId: user.id,
      organizationId: user.organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  return res.json(genericResponse);
});

/** POST /api/auth/reset-password — Consumes one reset token and updates password securely. */
router.post("/reset-password", async (req: Request, res: Response) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!token || !newPassword) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "token and newPassword are required" },
    });
  }

  const passwordIssue = getPasswordPolicyIssue(newPassword);
  if (passwordIssue) {
    return res.status(400).json({
      error: { code: "WEAK_PASSWORD", message: passwordIssue },
    });
  }

  const tokenHash = hashSecret(token);
  const row = await prisma.pluginSetting.findFirst({
    where: { pluginKey: passwordResetPluginKey(tokenHash) },
    select: { id: true, organizationId: true, config: true },
  });

  if (!row) {
    return res.status(400).json({
      error: { code: "RESET_TOKEN_INVALID", message: "Reset token is invalid or expired" },
    });
  }

  const config = parsePasswordResetConfig(row.config);
  if (!config || config.tokenHash !== tokenHash || new Date(config.expiresAt).getTime() <= Date.now() || config.usedAt) {
    await prisma.pluginSetting.delete({ where: { id: row.id } }).catch(() => {});
    return res.status(400).json({
      error: { code: "RESET_TOKEN_INVALID", message: "Reset token is invalid or expired" },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: config.userId } });
  if (!user || !user.active) {
    await prisma.pluginSetting.delete({ where: { id: row.id } }).catch(() => {});
    return res.status(400).json({
      error: { code: "RESET_TOKEN_INVALID", message: "Reset token is invalid or expired" },
    });
  }

  const nextHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.pluginSetting.delete({ where: { id: row.id } }),
  ]);

  await clearExistingPasswordResetTokens(row.organizationId, user.id);

  await logAudit({
    action: "PASSWORD_RESET_COMPLETED",
    entity: "User",
    entityId: user.id,
    organizationId: row.organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.json({ data: { message: "Password updated successfully." } });
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
