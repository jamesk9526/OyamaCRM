/** Email preference routes for tokenized unsubscribe/preferences flows and staff preference management. */
import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { EmailCategory, EmailPreferenceStatus, EmailSubscriptionStatus } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import {
  hashPublicEmailToken,
  parseEmailPurpose,
} from "../services/email-compliance.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

const ALL_EMAIL_CATEGORIES: EmailCategory[] = [
  "NEWSLETTER",
  "FUNDRAISING_APPEAL",
  "EVENT_INVITATION",
  "VOLUNTEER_UPDATES",
  "PRAYER_MINISTRY_UPDATES",
  "RECEIPTS",
  "THANK_YOU_EMAILS",
  "GRANT_SPONSOR_COMMUNICATION",
  "ADMINISTRATIVE_NOTICE",
  "PERSONAL_STAFF_EMAIL",
];

/** Returns a masked email string suitable for public preference pages. */
function maskEmail(email: string): string {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) return "hidden@email";

  const localStart = localPart.slice(0, 2);
  const localMasked = `${localStart}${"*".repeat(Math.max(localPart.length - 2, 1))}`;
  const domainPieces = domainPart.split(".");
  const domainRoot = domainPieces[0] || "domain";
  const domainTld = domainPieces.slice(1).join(".") || "com";
  const rootMasked = `${domainRoot.slice(0, 1)}${"*".repeat(Math.max(domainRoot.length - 1, 1))}`;

  return `${localMasked}@${rootMasked}.${domainTld}`;
}

/** Creates a URL-safe random token used for public preference and unsubscribe endpoints. */
function createPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Validates and normalizes EmailSubscriptionStatus from request payloads. */
function parseGlobalStatus(raw: unknown): EmailSubscriptionStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase() as EmailSubscriptionStatus;
  const allowed: EmailSubscriptionStatus[] = [
    "SUBSCRIBED",
    "UNSUBSCRIBED",
    "PARTIALLY_SUBSCRIBED",
    "BOUNCED",
    "SUPPRESSED",
    "PENDING_CONFIRMATION",
    "UNKNOWN",
  ];
  return allowed.includes(value) ? value : null;
}

/** Validates and normalizes EmailPreferenceStatus from request payloads. */
function parsePreferenceStatus(raw: unknown): EmailPreferenceStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase() as EmailPreferenceStatus;
  return value === "SUBSCRIBED" || value === "UNSUBSCRIBED" ? value : null;
}

/** Validates and normalizes EmailCategory from request payloads. */
function parseEmailCategory(raw: unknown): EmailCategory | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase() as EmailCategory;
  return ALL_EMAIL_CATEGORIES.includes(value) ? value : null;
}

/** Builds category preference payload, defaulting missing rows to SUBSCRIBED. */
function buildCategoryPreferences(existing: Array<{ category: EmailCategory; status: EmailPreferenceStatus }>) {
  const byCategory = new Map(existing.map((row) => [row.category, row.status]));
  return ALL_EMAIL_CATEGORIES.map((category) => ({
    category,
    status: byCategory.get(category) ?? "SUBSCRIBED",
  }));
}

/** Resolves one public token row with subscription + category preferences if valid and not expired. */
async function resolveToken(token: string) {
  const tokenHash = hashPublicEmailToken(token);
  const row = await prisma.emailUnsubscribeToken.findUnique({
    where: { tokenHash },
    include: {
      organization: {
        select: { id: true, name: true },
      },
      subscription: {
        include: {
          preferences: {
            select: {
              category: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  return row;
}

/** GET /api/email/preferences/:token — load public preferences for one recipient token without requiring login. */
router.get("/preferences/:token", async (req, res) => {
  try {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Token is required" } });
      return;
    }

    const tokenRow = await resolveToken(token);
    if (!tokenRow) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Preference link is invalid or expired" } });
      return;
    }

    res.json({
      organizationName: tokenRow.organization.name,
      emailMasked: maskEmail(tokenRow.subscription.email),
      email: tokenRow.subscription.email,
      globalStatus: tokenRow.subscription.globalStatus,
      categoryHint: tokenRow.category,
      categoryPreferences: buildCategoryPreferences(tokenRow.subscription.preferences),
      expiresAt: tokenRow.expiresAt,
      usedAt: tokenRow.usedAt,
    });
  } catch (err) {
    console.error("[email-preferences] GET /preferences/:token error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load preferences" } });
  }
});

/** POST /api/email/preferences/:token — update category and global subscription preferences for one token. */
router.post("/preferences/:token", async (req, res) => {
  try {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Token is required" } });
      return;
    }

    const tokenRow = await resolveToken(token);
    if (!tokenRow) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Preference link is invalid or expired" } });
      return;
    }

    const requestedStatus = parseGlobalStatus(req.body?.globalStatus);
    const requestedPreferences = Array.isArray(req.body?.categoryPreferences)
      ? req.body.categoryPreferences as Array<{ category?: unknown; status?: unknown }>
      : [];

    const updates = requestedPreferences
      .map((row) => ({
        category: parseEmailCategory(row.category),
        status: parsePreferenceStatus(row.status),
      }))
      .filter((row): row is { category: EmailCategory; status: EmailPreferenceStatus } => Boolean(row.category && row.status));

    await prisma.$transaction(async (tx) => {
      if (updates.length > 0) {
        for (const update of updates) {
          await tx.emailPreference.upsert({
            where: {
              subscriptionId_category: {
                subscriptionId: tokenRow.subscriptionId,
                category: update.category,
              },
            },
            create: {
              organizationId: tokenRow.organizationId,
              subscriptionId: tokenRow.subscriptionId,
              category: update.category,
              status: update.status,
            },
            update: {
              status: update.status,
            },
          });

          await tx.emailConsentEvent.create({
            data: {
              organizationId: tokenRow.organizationId,
              constituentId: tokenRow.subscription.constituentId,
              subscriptionId: tokenRow.subscriptionId,
              email: tokenRow.subscription.email,
              eventType: "PREFERENCE_UPDATED",
              category: update.category,
              source: "public-preferences",
              ipAddress: req.ip ?? null,
              userAgent: req.get("user-agent") ?? null,
              metadata: {
                status: update.status,
              },
            },
          });
        }
      }

      if (requestedStatus) {
        await tx.emailSubscription.update({
          where: { id: tokenRow.subscriptionId },
          data: {
            globalStatus: requestedStatus,
            subscribedAt: requestedStatus === "SUBSCRIBED" ? new Date() : undefined,
            unsubscribedAt: requestedStatus === "UNSUBSCRIBED" ? new Date() : undefined,
          },
        });

        if (requestedStatus === "UNSUBSCRIBED") {
          if (tokenRow.subscription.constituentId) {
            await tx.constituent.update({
              where: { id: tokenRow.subscription.constituentId },
              data: { emailOptOut: true },
            }).catch(() => {
              // Ignore missing constituent edge cases.
            });
          }

          const existingSuppression = await tx.emailSuppression.findFirst({
            where: {
              organizationId: tokenRow.organizationId,
              email: tokenRow.subscription.email,
              reason: "UNSUBSCRIBED",
            },
            select: { id: true },
          });

          if (existingSuppression) {
            await tx.emailSuppression.update({
              where: { id: existingSuppression.id },
              data: {
                active: true,
                constituentId: tokenRow.subscription.constituentId,
                source: "public-unsubscribe",
                notes: "Updated from public preference center",
              },
            });
          } else {
            await tx.emailSuppression.create({
              data: {
                organizationId: tokenRow.organizationId,
                constituentId: tokenRow.subscription.constituentId,
                email: tokenRow.subscription.email,
                reason: "UNSUBSCRIBED",
                source: "public-unsubscribe",
                active: true,
                notes: "Created from public preference center",
              },
            });
          }
        }

        if (requestedStatus === "SUBSCRIBED") {
          if (tokenRow.subscription.constituentId) {
            await tx.constituent.update({
              where: { id: tokenRow.subscription.constituentId },
              data: { emailOptOut: false },
            }).catch(() => {
              // Ignore missing constituent edge cases.
            });
          }

          await tx.emailSuppression.updateMany({
            where: {
              organizationId: tokenRow.organizationId,
              email: tokenRow.subscription.email,
              reason: "UNSUBSCRIBED",
              active: true,
            },
            data: {
              active: false,
              notes: "Cleared by public resubscribe",
            },
          });
        }

        await tx.emailConsentEvent.create({
          data: {
            organizationId: tokenRow.organizationId,
            constituentId: tokenRow.subscription.constituentId,
            subscriptionId: tokenRow.subscriptionId,
            email: tokenRow.subscription.email,
            eventType: requestedStatus === "SUBSCRIBED" ? "RESUBSCRIBED" : "OPT_OUT",
            source: "public-preferences",
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            metadata: {
              globalStatus: requestedStatus,
            },
          },
        });
      }

      await tx.emailUnsubscribeToken.update({
        where: { id: tokenRow.id },
        data: {
          usedAt: new Date(),
        },
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[email-preferences] POST /preferences/:token error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update preferences" } });
  }
});

/** POST /api/email/unsubscribe/:token — one-click unsubscribe endpoint for CAN-SPAM style footer links. */
router.post("/unsubscribe/:token", async (req, res) => {
  try {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Token is required" } });
      return;
    }

    const tokenRow = await resolveToken(token);
    if (!tokenRow) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Unsubscribe link is invalid or expired" } });
      return;
    }

    const scopeRaw = typeof req.body?.scope === "string" ? req.body.scope.trim().toLowerCase() : "all";
    const scope = scopeRaw === "category" ? "category" : "all";

    await prisma.$transaction(async (tx) => {
      if (scope === "category" && tokenRow.category) {
        await tx.emailPreference.upsert({
          where: {
            subscriptionId_category: {
              subscriptionId: tokenRow.subscriptionId,
              category: tokenRow.category,
            },
          },
          create: {
            organizationId: tokenRow.organizationId,
            subscriptionId: tokenRow.subscriptionId,
            category: tokenRow.category,
            status: "UNSUBSCRIBED",
          },
          update: {
            status: "UNSUBSCRIBED",
          },
        });

        await tx.emailSubscription.update({
          where: { id: tokenRow.subscriptionId },
          data: {
            globalStatus: "PARTIALLY_SUBSCRIBED",
          },
        });

        await tx.emailConsentEvent.create({
          data: {
            organizationId: tokenRow.organizationId,
            constituentId: tokenRow.subscription.constituentId,
            subscriptionId: tokenRow.subscriptionId,
            email: tokenRow.subscription.email,
            eventType: "OPT_OUT",
            category: tokenRow.category,
            source: "public-unsubscribe",
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            metadata: {
              scope,
            },
          },
        });
      } else {
        await tx.emailSubscription.update({
          where: { id: tokenRow.subscriptionId },
          data: {
            globalStatus: "UNSUBSCRIBED",
            unsubscribedAt: new Date(),
          },
        });

        if (tokenRow.subscription.constituentId) {
          await tx.constituent.update({
            where: { id: tokenRow.subscription.constituentId },
            data: { emailOptOut: true },
          }).catch(() => {
            // Ignore missing constituent edge cases.
          });
        }

        const existingSuppression = await tx.emailSuppression.findFirst({
          where: {
            organizationId: tokenRow.organizationId,
            email: tokenRow.subscription.email,
            reason: "UNSUBSCRIBED",
          },
          select: { id: true },
        });

        if (existingSuppression) {
          await tx.emailSuppression.update({
            where: { id: existingSuppression.id },
            data: {
              active: true,
              constituentId: tokenRow.subscription.constituentId,
              source: "public-unsubscribe",
              notes: "Updated from one-click unsubscribe",
            },
          });
        } else {
          await tx.emailSuppression.create({
            data: {
              organizationId: tokenRow.organizationId,
              constituentId: tokenRow.subscription.constituentId,
              email: tokenRow.subscription.email,
              reason: "UNSUBSCRIBED",
              source: "public-unsubscribe",
              active: true,
              notes: "Created from one-click unsubscribe",
            },
          });
        }

        await tx.emailConsentEvent.create({
          data: {
            organizationId: tokenRow.organizationId,
            constituentId: tokenRow.subscription.constituentId,
            subscriptionId: tokenRow.subscriptionId,
            email: tokenRow.subscription.email,
            eventType: "OPT_OUT",
            source: "public-unsubscribe",
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            metadata: {
              scope: "all",
            },
          },
        });
      }

      await tx.emailUnsubscribeToken.update({
        where: { id: tokenRow.id },
        data: {
          usedAt: new Date(),
        },
      });
    });

    res.json({
      success: true,
      unsubscribedScope: scope === "category" && tokenRow.category ? "category" : "all",
    });
  } catch (err) {
    console.error("[email-preferences] POST /unsubscribe/:token error", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to unsubscribe" } });
  }
});

/** Applies auth middleware for internal subscription management endpoints only. */
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:constituents")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    return requirePermission("edit:communications")(req, res, next);
  }
  return next();
});

/**
 * GET /api/email/subscriptions/by-constituent/:constituentId
 * Returns one constituent subscription status with all category preferences.
 */
router.get("/subscriptions/by-constituent/:constituentId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured" } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: {
      id: req.params.constituentId,
      organizationId,
    },
    select: {
      id: true,
      email: true,
      doNotEmail: true,
      doNotContact: true,
      emailOptOut: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const email = constituent.email?.trim().toLowerCase();
  if (!email) {
    res.json({
      constituent,
      subscription: null,
      categoryPreferences: ALL_EMAIL_CATEGORIES.map((category) => ({
        category,
        status: "SUBSCRIBED",
      })),
    });
    return;
  }

  const subscription = await prisma.emailSubscription.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
    create: {
      organizationId,
      constituentId: constituent.id,
      email,
      globalStatus: "UNKNOWN",
      source: "constituent-profile",
    },
    update: {
      constituentId: constituent.id,
    },
    include: {
      preferences: {
        select: {
          category: true,
          status: true,
        },
      },
    },
  });

  const suppressions = await prisma.emailSuppression.findMany({
    where: {
      organizationId,
      active: true,
      email,
    },
    select: {
      id: true,
      reason: true,
      source: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    constituent,
    subscription: {
      id: subscription.id,
      email: subscription.email,
      globalStatus: subscription.globalStatus,
      subscribedAt: subscription.subscribedAt,
      unsubscribedAt: subscription.unsubscribedAt,
      updatedAt: subscription.updatedAt,
    },
    categoryPreferences: buildCategoryPreferences(subscription.preferences),
    suppressions,
  });
});

/**
 * PUT /api/email/subscriptions/by-constituent/:constituentId
 * Updates global and category subscription settings from donor profile communication controls.
 */
router.put("/subscriptions/by-constituent/:constituentId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured" } });
    return;
  }

  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: {
      id: req.params.constituentId,
      organizationId,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const email = constituent.email?.trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Constituent does not have an email address" } });
    return;
  }

  const globalStatus = parseGlobalStatus(req.body?.globalStatus);
  const updates = Array.isArray(req.body?.categoryPreferences)
    ? req.body.categoryPreferences as Array<{ category?: unknown; status?: unknown }>
    : [];

  const normalizedUpdates = updates
    .map((row) => ({
      category: parseEmailCategory(row.category),
      status: parsePreferenceStatus(row.status),
    }))
    .filter((row): row is { category: EmailCategory; status: EmailPreferenceStatus } => Boolean(row.category && row.status));

  const subscription = await prisma.emailSubscription.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
    create: {
      organizationId,
      constituentId: constituent.id,
      email,
      globalStatus: globalStatus ?? "UNKNOWN",
      source: "constituent-profile",
    },
    update: {
      constituentId: constituent.id,
      globalStatus: globalStatus ?? undefined,
      subscribedAt: globalStatus === "SUBSCRIBED" ? new Date() : undefined,
      unsubscribedAt: globalStatus === "UNSUBSCRIBED" ? new Date() : undefined,
    },
  });

  for (const update of normalizedUpdates) {
    await prisma.emailPreference.upsert({
      where: {
        subscriptionId_category: {
          subscriptionId: subscription.id,
          category: update.category,
        },
      },
      create: {
        organizationId,
        subscriptionId: subscription.id,
        category: update.category,
        status: update.status,
      },
      update: {
        status: update.status,
      },
    });

    await prisma.emailConsentEvent.create({
      data: {
        organizationId,
        constituentId: constituent.id,
        subscriptionId: subscription.id,
        email,
        eventType: "PREFERENCE_UPDATED",
        category: update.category,
        source: "constituent-profile",
        createdById: userId,
        metadata: {
          status: update.status,
        },
      },
    });
  }

  if (globalStatus) {
    await prisma.emailConsentEvent.create({
      data: {
        organizationId,
        constituentId: constituent.id,
        subscriptionId: subscription.id,
        email,
        eventType: globalStatus === "SUBSCRIBED" ? "RESUBSCRIBED" : "OPT_OUT",
        source: "constituent-profile",
        createdById: userId,
        metadata: {
          globalStatus,
        },
      },
    });
  }

  await logAudit({
    action: "EMAIL_SUBSCRIPTION_UPDATED",
    entity: "Constituent",
    entityId: constituent.id,
    userId,
    organizationId,
    metadata: {
      globalStatus,
      categoryUpdates: normalizedUpdates.length,
    },
  });

  res.json({ success: true });
});

/**
 * POST /api/email/subscriptions/token
 * Creates a public preference token for one recipient email (used by send pipelines and manual workflows).
 */
router.post("/subscriptions/token", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured" } });
    return;
  }

  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email is required" } });
    return;
  }

  const category = parseEmailCategory(req.body?.category);
  const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId : null;
  const expiresDaysRaw = Number.parseInt(String(req.body?.expiresDays ?? "30"), 10);
  const expiresDays = Number.isFinite(expiresDaysRaw) ? Math.min(Math.max(expiresDaysRaw, 1), 365) : 30;
  const expiresAt = new Date(Date.now() + (expiresDays * 24 * 60 * 60 * 1000));

  const linkedConstituent = await prisma.constituent.findFirst({
    where: {
      organizationId,
      email,
    },
    select: {
      id: true,
    },
  });

  const subscription = await prisma.emailSubscription.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
    create: {
      organizationId,
      email,
      constituentId: linkedConstituent?.id ?? null,
      globalStatus: "UNKNOWN",
      source: "token-issue",
    },
    update: {
      constituentId: linkedConstituent?.id ?? undefined,
    },
  });

  const rawToken = createPublicToken();
  const tokenHash = hashPublicEmailToken(rawToken);

  await prisma.emailUnsubscribeToken.create({
    data: {
      organizationId,
      subscriptionId: subscription.id,
      tokenHash,
      email,
      category,
      campaignId,
      expiresAt,
    },
  });

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const unsubscribeUrl = `${appBase}/unsubscribe/${rawToken}`;
  const preferencesUrl = `${appBase}/preferences/${rawToken}`;

  await logAudit({
    action: "EMAIL_PREFERENCE_TOKEN_CREATED",
    entity: "EmailSubscription",
    entityId: subscription.id,
    userId,
    organizationId,
    metadata: {
      email,
      category,
      campaignId,
      purpose: parseEmailPurpose(req.body?.purpose),
      expiresAt: expiresAt.toISOString(),
    },
  });

  res.status(201).json({
    token: rawToken,
    unsubscribeUrl,
    preferencesUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

export default router;
