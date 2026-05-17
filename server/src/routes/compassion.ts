/**
 * Compassion CRM API routes for OyamaCRM.
 * Provides CRUD operations for clients, cases, appointments, services,
 * and follow-ups used by the client-care module. All data is scoped by
 * organizationId and protected by requireAuth.
 *
 * Routes:
 *   GET  /api/compassion/access              — permission/access gate probe for frontend guards
 *   GET  /api/compassion/dashboard-summary   — aggregated metrics for dashboard
 *   GET  /api/compassion/staff               — list compassion staff directory
 *   GET  /api/compassion/staff/user-options  — list existing users for linking
 *   POST /api/compassion/staff               — create compassion staff profile
 *   PATCH /api/compassion/staff/:id          — update compassion staff profile
 *   POST /api/compassion/staff/:id/create-account — create optional linked account
 *   GET  /api/compassion/clients             — list clients
 *   POST /api/compassion/clients             — create client
 *   GET  /api/compassion/clients/:id         — client profile with relations
 *   GET  /api/compassion/clients/:id/activity-entries — client-scoped activity records
 *   POST /api/compassion/clients/:id/activity-entries — create client-scoped activity record
 *   PATCH /api/compassion/clients/:id/activity-entries/:entryId — update activity record
 *   DEL  /api/compassion/clients/:id/activity-entries/:entryId — delete activity record
 *   PUT  /api/compassion/clients/:id         — update client
 *   DEL  /api/compassion/clients/:id         — delete client (admin)
 *   GET  /api/compassion/cases               — list cases
 *   POST /api/compassion/cases               — create case
 *   GET  /api/compassion/cases/:id           — case detail with relations
 *   PUT  /api/compassion/cases/:id           — update case
 *   DEL  /api/compassion/cases/:id           — delete case (admin)
 *   GET  /api/compassion/appointments        — list appointments
 *   POST /api/compassion/appointments        — create appointment
 *   GET  /api/compassion/appointments/:id    — appointment detail
 *   PATCH /api/compassion/appointments/:id   — update appointment
 *   DEL  /api/compassion/appointments/:id    — delete appointment
 *   GET  /api/compassion/follow-ups          — list follow-ups
 *   POST /api/compassion/follow-ups          — create follow-up
 *   PATCH /api/compassion/follow-ups/:id     — update follow-up
 *   DEL  /api/compassion/follow-ups/:id      — delete follow-up
 *   GET  /api/compassion/services            — list services
 *   POST /api/compassion/services            — create service
 *   PATCH /api/compassion/services/:id       — update service
 *   DEL  /api/compassion/services/:id        — delete service (admin)
 *
 * @module routes/compassion
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { hashPassword } from "../lib/auth.js";
import {
  APPOINTMENT_WIDGET_PLUGIN_KEY,
  createWidgetToken,
  parseWidgetConfig,
  type AppointmentWidgetConfig,
} from "../services/compassion-appointment-widget.js";
import { Prisma } from "@prisma/client";
import type {
  CompassionClientStatus,
  CompassionCaseStatus,
  CompassionCaseType,
  CompassionAppointmentType,
  CompassionAppointmentStatus,
  CompassionServiceType,
  CompassionFollowUpStatus,
  CompassionPriority,
} from "@prisma/client";

const router = Router();

const CLIENT_ACTIVITY_ENTRY_TYPES = [
  "CLIENT_NOTE",
  "CLIENT_ASSESSMENT",
  "CLIENT_DOCUMENT",
  "CLIENT_COMMUNICATION",
  "CLIENT_PORTAL_EVENT",
] as const;

const CLIENT_ACTIVITY_ENTRY_TYPE_SET = new Set<string>(CLIENT_ACTIVITY_ENTRY_TYPES);

/** Returns true when the given activity type is allowed for client workspace custom records. */
function isAllowedClientActivityEntryType(activityType: string): boolean {
  return CLIENT_ACTIVITY_ENTRY_TYPE_SET.has(activityType);
}

/** Returns a safe metadata object for Json persistence or null when metadata is not an object. */
function normalizeActivityMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Normalizes mixed payload values into nullable trimmed identifiers. */
function normalizeOptionalId(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

/** Resolves the preferred staff reference from Compassion staff first, then linked platform user. */
function resolveStaffReference(params: {
  assignedCompassionStaff?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName?: string | null;
  } | null;
  assignedStaff?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}) {
  if (params.assignedCompassionStaff) {
    return {
      id: params.assignedCompassionStaff.id,
      firstName: params.assignedCompassionStaff.firstName,
      lastName: params.assignedCompassionStaff.lastName,
      displayName: params.assignedCompassionStaff.displayName ?? null,
    };
  }
  if (params.assignedStaff) {
    return {
      id: params.assignedStaff.id,
      firstName: params.assignedStaff.firstName,
      lastName: params.assignedStaff.lastName,
      displayName: null,
    };
  }
  return null;
}

/** Shapes Compassion staff rows into a consistent API payload used by assignment UIs. */
function mapCompassionStaffRow(staff: {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  supportsScheduling: boolean;
  linkedUserId: string | null;
  notes: string | null;
  linkedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    active: boolean;
  } | null;
}) {
  const fullName = (staff.displayName ?? "").trim() || `${staff.firstName} ${staff.lastName}`.trim();
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    displayName: staff.displayName,
    fullName,
    title: staff.title,
    email: staff.email,
    phone: staff.phone,
    isActive: staff.isActive,
    supportsScheduling: staff.supportsScheduling,
    linkedUserId: staff.linkedUserId,
    hasLinkedAccount: Boolean(staff.linkedUserId),
    notes: staff.notes,
    linkedUser: staff.linkedUser ?? null,
  };
}

/** Validates a Compassion staff directory id and returns the matching staff row when valid. */
async function getValidCompassionStaff(params: {
  organizationId: string;
  compassionStaffId: string | null;
  requireActive?: boolean;
}) {
  if (!params.compassionStaffId) return null;
  return prisma.compassionStaff.findFirst({
    where: {
      id: params.compassionStaffId,
      organizationId: params.organizationId,
      ...(params.requireActive ? { isActive: true } : {}),
    },
    select: {
      id: true,
      linkedUserId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      supportsScheduling: true,
    },
  });
}

/** Validates that a legacy global user staff id belongs to the same organization. */
async function hasValidLegacyStaffUser(params: {
  organizationId: string;
  assignedStaffId: string | null;
}) {
  if (!params.assignedStaffId) return true;
  const match = await prisma.user.findFirst({
    where: {
      id: params.assignedStaffId,
      organizationId: params.organizationId,
    },
    select: { id: true },
  });
  return Boolean(match);
}

/** Returns a canonical key for a family grouping candidate. */
function computeFamilyKey(client: {
  id: string;
  lastName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}): string {
  const address = (client.addressLine1 ?? "").trim().toLowerCase();
  const city = (client.city ?? "").trim().toLowerCase();
  const state = (client.state ?? "").trim().toLowerCase();
  const zip = (client.zip ?? "").trim().toLowerCase();
  const digits = (client.phone ?? "").replace(/\D/g, "");
  const lastName = (client.lastName ?? "").trim().toLowerCase();

  if (address) {
    return `address:${address}|${zip || `${city}|${state}`}`;
  }
  if (digits.length >= 10) {
    return `phone:${digits.slice(-10)}`;
  }
  if (lastName && zip) {
    return `namezip:${lastName}|${zip}`;
  }
  return `client:${client.id}`;
}

// All Compassion CRM routes require auth and explicit Compassion workspace access.
const COMPASSION_BASE_ROLES = new Set(["admin", "manager", "staff", "readonly"]);

/**
 * Allows normal office roles directly and grants report_viewer access only when
 * the user is explicitly linked to an active Compassion staff profile.
 */
async function requireCompassionAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
    return;
  }

  const workspaceSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { compassionWorkspaceEnabled: true },
  });

  // Missing settings rows are treated as enabled for backwards compatibility.
  if (workspaceSettings && !workspaceSettings.compassionWorkspaceEnabled) {
    res.status(403).json({
      error: {
        code: "WORKSPACE_DISABLED",
        message: "Compassion workspace is disabled for this organization.",
      },
    });
    return;
  }

  if (COMPASSION_BASE_ROLES.has(req.user.role)) {
    next();
    return;
  }

  if (req.user.role !== "report_viewer") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Compassion workspace access requires an approved role or a linked Compassion staff account.",
      },
    });
    return;
  }

  const linkedProfile = await prisma.compassionStaff.findFirst({
    where: {
      organizationId,
      linkedUserId: req.user.sub,
      isActive: true,
    },
    select: { id: true },
  });

  if (!linkedProfile) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "This account is not linked to an active Compassion staff profile.",
      },
    });
    return;
  }

  next();
}

router.use(requireAuth, requireCompassionAccess);

/** GET /api/compassion/access — Returns current access resolution for frontend route guards. */
router.get("/access", async (req, res) => {
  res.json({
    allowed: true,
    role: req.user?.role ?? null,
  });
});

// ─── Widget Builder Settings ────────────────────────────────────────────────

/**
 * GET /api/compassion/appointment-widget
 * Returns current authenticated-org widget builder configuration.
 */
router.get("/appointment-widget", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const plugin = await prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
    });

    const config = parseWidgetConfig(plugin?.config ?? null);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3650";
    const publicUrl = `${appUrl.replace(/\/$/, "")}/compassion/public/appointments/${config.token}`;
    const scriptUrl = `${appUrl.replace(/\/$/, "")}/embed/compassion-schedule.js`;

    res.json({
      enabled: plugin?.enabled ?? config.enabled,
      config,
      publicUrl,
      iframeSnippet: `<iframe src="${publicUrl}" width="100%" height="760" style="border:0;border-radius:12px;" title="Appointment Request"></iframe>`,
      scriptSnippet: `<div id="oyama-compassion-schedule"></div>\n<script src="${scriptUrl}" data-token="${config.token}" data-target="oyama-compassion-schedule" async></script>`,
    });
  } catch (err) {
    console.error("[compassion] GET /appointment-widget error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load widget settings" } });
  }
});

/**
 * PUT /api/compassion/appointment-widget
 * Updates the authenticated-org appointment widget builder config. Admin only.
 */
router.put("/appointment-widget", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const existing = await prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
    });

    const base = parseWidgetConfig(existing?.config ?? null);
    const incoming = parseWidgetConfig(req.body?.config ?? req.body ?? null);

    const merged: AppointmentWidgetConfig = {
      ...base,
      ...incoming,
      token: typeof req.body?.regenerateToken === "boolean" && req.body.regenerateToken
        ? createWidgetToken()
        : incoming.token || base.token,
    };

    const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : existing?.enabled ?? merged.enabled;
    const mergedConfigJson = merged as unknown as Prisma.InputJsonValue;

    const saved = await prisma.pluginSetting.upsert({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
      create: {
        organizationId,
        pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        enabled,
        config: mergedConfigJson,
      },
      update: {
        enabled,
        config: mergedConfigJson,
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_WIDGET_UPDATED",
      entity: "PluginSetting",
      entityId: saved.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { enabled },
    });

    res.json({
      enabled: saved.enabled,
      config: parseWidgetConfig(saved.config),
    });
  } catch (err) {
    console.error("[compassion] PUT /appointment-widget error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update widget settings" } });
  }
});

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

/**
 * GET /api/compassion/dashboard-summary
 * Returns aggregated metrics scoped to the authenticated org:
 * client counts, case counts, today's appointments, pending follow-ups,
 * caseload-by-status chart data, cases-by-status chart data,
 * recent activity, today's schedule, and upcoming follow-ups.
 */
router.get("/dashboard-summary", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    // Build today's date range in UTC
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Build this-week date range
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Run all aggregate queries in parallel for performance
    const [
      totalClients,
      activeClients,
      activeCases,
      appointmentsToday,
      pendingFollowUps,
      overdueFollowUps,
      followUpsThisWeek,
      caseloadGroups,
      casesGroups,
      recentActivity,
      todaysAppointments,
      upcomingFollowUps,
    ] = await Promise.all([
      // Total clients
      prisma.compassionClient.count({ where: { organizationId } }),

      // Active clients
      prisma.compassionClient.count({
        where: { organizationId, clientStatus: "ACTIVE" },
      }),

      // Active cases (OPEN or IN_PROGRESS)
      prisma.compassionCase.count({
        where: { organizationId, caseStatus: { in: ["OPEN", "IN_PROGRESS"] } },
      }),

      // Appointments scheduled today
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: "SCHEDULED",
        },
      }),

      // Follow-ups pending (PENDING or IN_PROGRESS)
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Overdue follow-ups (due before now, not completed)
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          dueDate: { lt: now },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Follow-ups due this week
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          dueDate: { gte: todayStart, lte: weekEnd },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Client status distribution for donut chart
      prisma.compassionClient.groupBy({
        by: ["clientStatus"],
        where: { organizationId },
        _count: { clientStatus: true },
      }),

      // Case status distribution for donut chart
      prisma.compassionCase.groupBy({
        by: ["caseStatus"],
        where: { organizationId },
        _count: { caseStatus: true },
      }),

      // Last 10 activity events
      prisma.compassionActivity.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          client: { select: { firstName: true, lastName: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
      }),

      // Today's appointments
      prisma.compassionAppointment.findMany({
        where: {
          organizationId,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startTime: "asc" },
        take: 10,
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignedStaff: { select: { firstName: true, lastName: true } },
          assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
      }),

      // Next 5 upcoming follow-ups
      prisma.compassionFollowUp.findMany({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignedStaff: { select: { firstName: true, lastName: true } },
          assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
      }),
    ]);

    const mappedTodaysAppointments = todaysAppointments.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff
          ? { id: item.assignedStaffId ?? "", firstName: item.assignedStaff.firstName, lastName: item.assignedStaff.lastName }
          : null,
      }),
    }));

    const mappedUpcomingFollowUps = upcomingFollowUps.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff
          ? { id: item.assignedStaffId ?? "", firstName: item.assignedStaff.firstName, lastName: item.assignedStaff.lastName }
          : null,
      }),
    }));

    // Map client status groups to chart-friendly format with brand colors
    const statusColors: Record<string, string> = {
      ACTIVE: "#2563eb",
      INACTIVE: "#93c5fd",
      GRADUATED: "#6ee7b7",
      ARCHIVED: "#e2e8f0",
      PENDING: "#f59e0b",
    };
    const caseloadByStatus = caseloadGroups.map((g) => ({
      label: g.clientStatus.charAt(0) + g.clientStatus.slice(1).toLowerCase(),
      value: g._count.clientStatus,
      color: statusColors[g.clientStatus] ?? "#e2e8f0",
    }));

    // Map case status groups to chart-friendly format
    const caseStatusColors: Record<string, string> = {
      OPEN: "#2563eb",
      IN_PROGRESS: "#7c3aed",
      PENDING: "#f59e0b",
      CLOSED: "#e2e8f0",
      ARCHIVED: "#9ca3af",
    };
    const casesByStatus = casesGroups.map((g) => ({
      label: g.caseStatus === "IN_PROGRESS" ? "In Progress"
           : g.caseStatus.charAt(0) + g.caseStatus.slice(1).toLowerCase(),
      value: g._count.caseStatus,
      color: caseStatusColors[g.caseStatus] ?? "#e2e8f0",
    }));

    res.json({
      totalClients,
      activeClients,
      activeCases,
      appointmentsToday,
      tasksDue: pendingFollowUps,
      overdueFollowUps,
      followUpsThisWeek,
      caseloadByStatus,
      casesByStatus,
      recentActivity,
      todaysAppointments: mappedTodaysAppointments,
      upcomingFollowUps: mappedUpcomingFollowUps,
    });
  } catch (err) {
    console.error("[compassion] dashboard-summary error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load dashboard summary" } });
  }
});

// ─── Families ────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/families
 * Returns household-style family groupings inferred from address/phone/name data.
 */
router.get("/families", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { search, minMembers = "2", limit = "100" } = req.query as Record<string, string>;
    const min = Math.max(parseInt(minMembers || "2", 10) || 2, 1);
    const take = Math.min(Math.max(parseInt(limit || "100", 10) || 100, 1), 250);

    const clients = await prisma.compassionClient.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { addressLine1: { contains: search } },
                { city: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        phone: true,
        email: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
        clientStatus: true,
        intakeDate: true,
      },
    });

    const grouped = new Map<string, typeof clients>();
    for (const client of clients) {
      const key = computeFamilyKey(client);
      const list = grouped.get(key) ?? [];
      list.push(client);
      grouped.set(key, list);
    }

    const families = Array.from(grouped.entries())
      .filter(([, members]) => members.length >= min)
      .map(([key, members]) => {
        const familyName = `${members[0].lastName || members[0].firstName} Family`;
        const location = [members[0].addressLine1, members[0].city, members[0].state, members[0].zip]
          .filter(Boolean)
          .join(", ");
        const activeMembers = members.filter((m) => m.clientStatus === "ACTIVE").length;

        return {
          id: key,
          familyName,
          familyKey: key,
          memberCount: members.length,
          activeMembers,
          location,
          members: members.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            preferredName: member.preferredName,
            clientStatus: member.clientStatus,
            phone: member.phone,
            email: member.email,
            intakeDate: member.intakeDate,
          })),
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount || a.familyName.localeCompare(b.familyName));

    res.json({
      totalFamilies: families.length,
      totalClientsGrouped: families.reduce((sum, family) => sum + family.memberCount, 0),
      families,
    });
  } catch (err) {
    console.error("[compassion] GET /families error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load families" } });
  }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/reports/summary
 * Returns report-oriented KPIs for cases, appointments, and client growth.
 */
router.get("/reports/summary", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalClients,
      activeCases,
      newClientsThisMonth,
      apptsThisMonth,
      apptsLastMonth,
      completedApptsThisMonth,
      casesByType,
      casesByStatus,
      appointmentsByType,
      recentCases,
    ] = await Promise.all([
      prisma.compassionClient.count({ where: { organizationId } }),
      prisma.compassionCase.count({
        where: {
          organizationId,
          caseStatus: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.compassionClient.count({
        where: {
          organizationId,
          intakeDate: { gte: startOfMonth },
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfMonth },
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfMonth },
          status: "COMPLETED",
        },
      }),
      prisma.compassionCase.groupBy({
        by: ["caseType"],
        where: { organizationId },
        _count: { caseType: true },
      }),
      prisma.compassionCase.groupBy({
        by: ["caseStatus"],
        where: { organizationId },
        _count: { caseStatus: true },
      }),
      prisma.compassionAppointment.groupBy({
        by: ["appointmentType"],
        where: {
          organizationId,
          startTime: { gte: startOfLastMonth },
        },
        _count: { appointmentType: true },
      }),
      prisma.compassionCase.findMany({
        where: { organizationId },
        orderBy: { openedAt: "desc" },
        take: 6,
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const completionRate = apptsThisMonth > 0
      ? Math.round((completedApptsThisMonth / apptsThisMonth) * 100)
      : 0;

    const monthDeltaPercent = apptsLastMonth > 0
      ? Math.round(((apptsThisMonth - apptsLastMonth) / apptsLastMonth) * 100)
      : (apptsThisMonth > 0 ? 100 : 0);

    res.json({
      generatedAt: now.toISOString(),
      kpis: {
        totalClients,
        activeCases,
        newClientsThisMonth,
        appointmentsThisMonth: apptsThisMonth,
        appointmentsLastMonth: apptsLastMonth,
        completedAppointmentsThisMonth: completedApptsThisMonth,
        completionRate,
        monthDeltaPercent,
      },
      casesByType: casesByType.map((row) => ({
        label: row.caseType,
        value: row._count.caseType,
      })),
      casesByStatus: casesByStatus.map((row) => ({
        label: row.caseStatus,
        value: row._count.caseStatus,
      })),
      appointmentsByType: appointmentsByType.map((row) => ({
        label: row.appointmentType,
        value: row._count.appointmentType,
      })),
      recentCases: recentCases.map((item) => ({
        id: item.id,
        caseNumber: item.caseNumber,
        caseType: item.caseType,
        caseStatus: item.caseStatus,
        openedAt: item.openedAt,
        clientName: `${item.client.firstName} ${item.client.lastName}`,
      })),
    });
  } catch (err) {
    console.error("[compassion] GET /reports/summary error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load reports summary" } });
  }
});

// ─── Compassion Staff Directory ─────────────────────────────────────────────

/**
 * GET /api/compassion/staff
 * Lists Compassion staff directory records for the authenticated organization.
 * Query params: active=true|false (optional), search, limit.
 */
router.get("/staff", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { active, search, limit = "200" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const activeFilter = active === "true" ? true : active === "false" ? false : undefined;
    const normalizedSearch = (search ?? "").trim();

    const staff = await prisma.compassionStaff.findMany({
      where: {
        organizationId,
        ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { firstName: { contains: normalizedSearch } },
                { lastName: { contains: normalizedSearch } },
                { displayName: { contains: normalizedSearch } },
                { title: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: parsedLimit,
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    res.json(staff.map((item) => mapCompassionStaffRow(item)));
  } catch (err) {
    console.error("[compassion] GET /staff error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load compassion staff" } });
  }
});

/**
 * GET /api/compassion/staff/user-options
 * Lists active platform users in-org so a Compassion staff record can link to an existing account.
 */
router.get("/staff/user-options", requireRole("manager"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId,
        active: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error("[compassion] GET /staff/user-options error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load user options" } });
  }
});

/**
 * POST /api/compassion/staff
 * Creates a Compassion staff directory entry. Accounts remain optional via linkedUserId.
 */
router.post("/staff", requireRole("manager"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();
    const displayName = String(req.body?.displayName ?? "").trim() || null;
    const title = String(req.body?.title ?? "").trim() || null;
    const email = String(req.body?.email ?? "").trim() || null;
    const phone = String(req.body?.phone ?? "").trim() || null;
    const notes = String(req.body?.notes ?? "").trim() || null;
    const linkedUserId = normalizeOptionalId(req.body?.linkedUserId);

    if (!firstName || !lastName) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "firstName and lastName are required" } });
      return;
    }

    if (linkedUserId) {
      const linkedUser = await prisma.user.findFirst({
        where: { id: linkedUserId, organizationId },
        select: { id: true },
      });
      if (!linkedUser) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "linkedUserId is not valid for this organization" } });
        return;
      }
    }

    const created = await prisma.compassionStaff.create({
      data: {
        organizationId,
        firstName,
        lastName,
        displayName,
        title,
        email,
        phone,
        notes,
        linkedUserId,
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
        supportsScheduling: req.body?.supportsScheduling !== undefined
          ? Boolean(req.body.supportsScheduling)
          : true,
      },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    await logAudit({
      action: "COMPASSION_STAFF_CREATED",
      entity: "CompassionStaff",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: created.linkedUserId,
        supportsScheduling: created.supportsScheduling,
      },
    });

    res.status(201).json(mapCompassionStaffRow(created));
  } catch (err) {
    console.error("[compassion] POST /staff error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create compassion staff" } });
  }
});

/**
 * PATCH /api/compassion/staff/:id
 * Updates Compassion staff profile fields and optional linked account reference.
 */
router.patch("/staff/:id", requireRole("manager"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const staffId = String(req.params.id || "").trim();
    if (!staffId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid staff id" } });
      return;
    }

    const linkedUserIdProvided = req.body?.linkedUserId !== undefined;
    const linkedUserId = linkedUserIdProvided ? normalizeOptionalId(req.body?.linkedUserId) : undefined;

    if (linkedUserIdProvided && linkedUserId) {
      const linkedUser = await prisma.user.findFirst({
        where: { id: linkedUserId, organizationId },
        select: { id: true },
      });
      if (!linkedUser) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "linkedUserId is not valid for this organization" } });
        return;
      }
    }

    const updated = await prisma.compassionStaff.updateMany({
      where: { id: staffId, organizationId },
      data: {
        ...(req.body?.firstName !== undefined && { firstName: String(req.body.firstName ?? "").trim() }),
        ...(req.body?.lastName !== undefined && { lastName: String(req.body.lastName ?? "").trim() }),
        ...(req.body?.displayName !== undefined && { displayName: String(req.body.displayName ?? "").trim() || null }),
        ...(req.body?.title !== undefined && { title: String(req.body.title ?? "").trim() || null }),
        ...(req.body?.email !== undefined && { email: String(req.body.email ?? "").trim() || null }),
        ...(req.body?.phone !== undefined && { phone: String(req.body.phone ?? "").trim() || null }),
        ...(req.body?.notes !== undefined && { notes: String(req.body.notes ?? "").trim() || null }),
        ...(req.body?.isActive !== undefined && { isActive: Boolean(req.body.isActive) }),
        ...(req.body?.supportsScheduling !== undefined && { supportsScheduling: Boolean(req.body.supportsScheduling) }),
        ...(linkedUserIdProvided && { linkedUserId: linkedUserId ?? null }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    const staff = await prisma.compassionStaff.findFirst({
      where: { id: staffId, organizationId },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    if (!staff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_STAFF_UPDATED",
      entity: "CompassionStaff",
      entityId: staff.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: staff.linkedUserId,
        supportsScheduling: staff.supportsScheduling,
        isActive: staff.isActive,
      },
    });

    res.json(mapCompassionStaffRow(staff));
  } catch (err) {
    console.error("[compassion] PATCH /staff/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update compassion staff" } });
  }
});

/**
 * POST /api/compassion/staff/:id/create-account
 * Creates an optional linked platform account for a Compassion staff profile.
 * Default role is report_viewer so account access can be limited to Compassion when linked.
 */
router.post("/staff/:id/create-account", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const staffId = String(req.params.id ?? "").trim();
    if (!staffId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid staff id" } });
      return;
    }

    const staff = await prisma.compassionStaff.findFirst({
      where: { id: staffId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        linkedUserId: true,
      },
    });

    if (!staff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    if (staff.linkedUserId) {
      res.status(409).json({ error: { code: "CONFLICT", message: "This staff profile already has a linked account" } });
      return;
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const requestedRole = String(req.body?.role ?? "report_viewer").trim() || "report_viewer";
    const role = requestedRole === "readonly" ? "readonly" : "report_viewer";

    if (!email || !password) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email and password are required" } });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "password must be at least 8 characters" } });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      res.status(409).json({ error: { code: "CONFLICT", message: "A user with that email already exists" } });
      return;
    }

    const passwordHash = await hashPassword(password);
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          email,
          firstName: String(req.body?.firstName ?? "").trim() || staff.firstName,
          lastName: String(req.body?.lastName ?? "").trim() || staff.lastName,
          role,
          active: true,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
        },
      });

      await tx.compassionStaff.update({
        where: { id: staff.id },
        data: { linkedUserId: user.id },
      });

      return user;
    });

    const refreshedStaff = await prisma.compassionStaff.findFirst({
      where: { id: staff.id, organizationId },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    if (!refreshedStaff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_STAFF_ACCOUNT_CREATED",
      entity: "CompassionStaff",
      entityId: refreshedStaff.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: refreshedStaff.linkedUserId,
        createdRole: createdUser.role,
      },
    });

    res.status(201).json({
      staff: mapCompassionStaffRow(refreshedStaff),
      account: createdUser,
    });
  } catch (err) {
    console.error("[compassion] POST /staff/:id/create-account error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create linked staff account" } });
  }
});

// ─── Clients ───────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/clients
 * List clients for the authenticated org.
 *
 * Query params:
 *   search        — full-text-ish match against firstName/lastName/preferredName/email/phone/referralSource
 *   status        — filter by clientStatus enum
 *   staffId       — filter by exact assignedStaffId
 *   assigned      — "true" → only assigned, "false" → only unassigned
 *   missingContact — "true" → only clients with no email AND no phone
 *   intakeWithinDays — number; only clients whose intakeDate is within the last N days
 *   limit         — defaults to 50
 *
 * Defense-in-depth: rows whose firstName or lastName contains a comma are filtered out
 * after the DB query so legacy garbage rows from older imports never surface in the UI.
 */
router.get("/clients", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      search,
      status,
      staffId,
      assigned,
      missingContact,
      intakeWithinDays,
      limit = "50",
    } = req.query as Record<string, string>;

    const intakeFloor =
      intakeWithinDays && /^\d+$/.test(intakeWithinDays)
        ? new Date(Date.now() - Number(intakeWithinDays) * 24 * 60 * 60 * 1000)
        : undefined;

    const andClauses: Array<Record<string, unknown>> = [];

    if (staffId) {
      andClauses.push({
        OR: [
          { assignedCompassionStaffId: staffId },
          { assignedStaffId: staffId },
        ],
      });
    }

    if (assigned === "true") {
      andClauses.push({
        OR: [
          { assignedCompassionStaffId: { not: null } },
          { assignedStaffId: { not: null } },
        ],
      });
    }

    if (assigned === "false") {
      andClauses.push({
        AND: [
          { assignedCompassionStaffId: null },
          { assignedStaffId: null },
        ],
      });
    }

    if (missingContact === "true") {
      andClauses.push({
        AND: [
          { OR: [{ email: null }, { email: "" }] },
          { OR: [{ phone: null }, { phone: "" }] },
        ],
      });
    }

    if (search) {
      andClauses.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { preferredName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { referralSource: { contains: search } },
          { assignedCompassionStaff: { is: { firstName: { contains: search } } } },
          { assignedCompassionStaff: { is: { lastName: { contains: search } } } },
        ],
      });
    }

    const where = {
      organizationId,
      ...(status && { clientStatus: status as CompassionClientStatus }),
      ...(intakeFloor && { intakeDate: { gte: intakeFloor } }),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    };

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const clients = await prisma.compassionClient.findMany({
      where,
      take: parsedLimit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        phone: true,
        clientStatus: true,
        intakeDate: true,
        assignedCompassionStaffId: true,
        assignedStaffId: true,
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        assignedStaff: { select: { firstName: true, lastName: true } },
        _count: { select: { cases: true, appointments: true } },
      },
    });

    // Defensive filter: never return rows whose name field contains comma-separated metadata.
    // This protects users from legacy bad imports that pre-date the importer hardening.
    const safe = clients.filter((c) => {
      const fn = (c.firstName ?? "").trim();
      const ln = (c.lastName ?? "").trim();
      // Comma in a name almost always means metadata leaked in (e.g. "Text,Aurora,False,...").
      if (fn.includes(",") || ln.includes(",")) return false;
      // Em-dash separator from eKYROS report exports.
      if (/\s—\s/.test(fn) || /\s—\s/.test(ln)) return false;
      return true;
    }).map((client) => {
      return {
        ...client,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: client.assignedCompassionStaff,
          assignedStaff: client.assignedStaff
            ? { id: client.assignedStaffId ?? "", firstName: client.assignedStaff.firstName, lastName: client.assignedStaff.lastName }
            : null,
        }),
      };
    });

    res.json(safe);
  } catch (err) {
    console.error("[compassion] GET /clients error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load clients" } });
  }
});

/**
 * POST /api/compassion/clients
 * Create a new client record. Automatically logs a CLIENT_CREATED activity.
 * Body: { firstName, lastName, preferredName?, email?, phone?, dateOfBirth?,
 *          intakeDate?, referralSource?, assignedStaffId?, notes? }
 */
router.post("/clients", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      firstName,
      lastName,
      preferredName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      dateOfBirth,
      intakeDate,
      referralSource,
      assignedCompassionStaffId,
      assignedStaffId,
      privateNotes,
      clientStatus,
    } = req.body;

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      if (!compassionStaff.supportsScheduling) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const client = await prisma.compassionClient.create({
      data: {
        organizationId,
        firstName,
        lastName,
        preferredName: preferredName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        addressLine1: addressLine1 ?? null,
        addressLine2: addressLine2 ?? null,
        city: city ?? null,
        state: state ?? null,
        zip: zip ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        intakeDate: intakeDate ? new Date(intakeDate) : new Date(),
        referralSource: referralSource ?? null,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        privateNotes: privateNotes ?? null,
        clientStatus: clientStatus ?? "ACTIVE",
      },
    });

    // Log creation activity
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: client.id,
        activityType: "CLIENT_CREATED",
        description: `Client record created for ${client.firstName} ${client.lastName}`,
        performedById: req.user?.sub ?? null,
        metadata: {
          source: "api/compassion/clients:create",
          referralSource,
          assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
          assignedStaffId: normalizedAssignedStaffId,
        },
      },
    });

    // Audit log for compliance
    await logAudit({
      action: "COMPASSION_CLIENT_CREATED",
      entity: "CompassionClient",
      entityId: client.id,
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json(client);
  } catch (err) {
    console.error("[compassion] POST /clients error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create client" } });
  }
});

/**
 * GET /api/compassion/clients/:id
 * Full client profile including cases, appointments, services, follow-ups, and activity.
 */
router.get("/clients/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const client = await prisma.compassionClient.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        cases: {
          orderBy: { openedAt: "desc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        appointments: {
          orderBy: { startTime: "desc" },
          take: 20,
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        services: {
          orderBy: { serviceDate: "desc" },
          take: 20,
        },
        followUps: {
          orderBy: { dueDate: "asc" },
          where: { status: { not: "COMPLETED" } },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    res.json({
      ...client,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: client.assignedCompassionStaff,
        assignedStaff: client.assignedStaff,
      }),
      cases: client.cases.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      appointments: client.appointments.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      followUps: client.followUps.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
    });
  } catch (err) {
    console.error("[compassion] GET /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load client" } });
  }
});

/**
 * GET /api/compassion/clients/:id/activity-entries
 * Returns client-scoped custom activity entries (notes, assessments, documents, communication, portal events).
 */
router.get("/clients/:id/activity-entries", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const { types, limit = "100" } = req.query as Record<string, string>;

    const client = await prisma.compassionClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    const requestedTypeTokens = (types ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const requestedTypes = requestedTypeTokens
      .filter((value) => isAllowedClientActivityEntryType(value));

    if (requestedTypeTokens.length > 0 && requestedTypes.length === 0) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `types must include at least one allowed value: ${CLIENT_ACTIVITY_ENTRY_TYPES.join(", ")}`,
        },
      });
      return;
    }

    const activeTypes = requestedTypes.length > 0
      ? requestedTypes
      : [...CLIENT_ACTIVITY_ENTRY_TYPES];

    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 300);

    const entries = await prisma.compassionActivity.findMany({
      where: {
        organizationId,
        clientId,
        activityType: { in: activeTypes },
      },
      orderBy: { createdAt: "desc" },
      take: parsedLimit,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(entries);
  } catch (err) {
    console.error("[compassion] GET /clients/:id/activity-entries error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load client activity entries" } });
  }
});

/**
 * POST /api/compassion/clients/:id/activity-entries
 * Creates a client-scoped custom activity entry.
 * Body: { activityType, description, metadata?, caseId?, appointmentId? }
 */
router.post("/clients/:id/activity-entries", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const activityType = String(req.body?.activityType || "").trim();
    const description = String(req.body?.description || "").trim();
    const caseId = req.body?.caseId ? String(req.body.caseId).trim() : null;
    const appointmentId = req.body?.appointmentId ? String(req.body.appointmentId).trim() : null;
    const metadata = normalizeActivityMetadata(req.body?.metadata);
    const metadataInput = metadata as Prisma.InputJsonValue | undefined;

    if (!isAllowedClientActivityEntryType(activityType)) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `activityType must be one of: ${CLIENT_ACTIVITY_ENTRY_TYPES.join(", ")}`,
        },
      });
      return;
    }

    if (!description) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "description is required" } });
      return;
    }

    const client = await prisma.compassionClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    if (caseId) {
      const linkedCase = await prisma.compassionCase.findFirst({
        where: { id: caseId, organizationId, clientId },
        select: { id: true },
      });
      if (!linkedCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (appointmentId) {
      const linkedAppointment = await prisma.compassionAppointment.findFirst({
        where: { id: appointmentId, organizationId, clientId },
        select: { id: true },
      });
      if (!linkedAppointment) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Appointment not found for this client" } });
        return;
      }
    }

    const created = await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId,
        caseId,
        appointmentId,
        activityType,
        description,
        metadata: metadataInput,
        performedById: req.user?.sub ?? null,
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_CREATED",
      entity: "CompassionActivity",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("[compassion] POST /clients/:id/activity-entries error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create client activity entry" } });
  }
});

/**
 * PATCH /api/compassion/clients/:id/activity-entries/:entryId
 * Updates a client-scoped custom activity entry.
 */
router.patch("/clients/:id/activity-entries/:entryId", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const entryId = String(req.params.entryId || "").trim();
    const description = req.body?.description;
    const metadata = req.body?.metadata;

    const existing = await prisma.compassionActivity.findFirst({
      where: {
        id: entryId,
        organizationId,
        clientId,
      },
      select: { id: true, activityType: true },
    });

    if (!existing || !isAllowedClientActivityEntryType(existing.activityType)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Activity entry not found" } });
      return;
    }

    if (description === undefined && metadata === undefined) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No updatable fields were provided" } });
      return;
    }

    if (description !== undefined && !String(description).trim()) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "description cannot be empty" } });
      return;
    }

    const normalizedMetadata = metadata !== undefined ? normalizeActivityMetadata(metadata) : undefined;
    const metadataUpdate = normalizedMetadata === undefined
      ? undefined
      : normalizedMetadata === null
        ? Prisma.JsonNull
        : (normalizedMetadata as Prisma.InputJsonValue);

    const updated = await prisma.compassionActivity.update({
      where: { id: existing.id },
      data: {
        ...(description !== undefined && { description: String(description).trim() }),
        ...(metadata !== undefined && { metadata: metadataUpdate }),
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_UPDATED",
      entity: "CompassionActivity",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType: updated.activityType },
    });

    res.json(updated);
  } catch (err) {
    console.error("[compassion] PATCH /clients/:id/activity-entries/:entryId error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update client activity entry" } });
  }
});

/**
 * DELETE /api/compassion/clients/:id/activity-entries/:entryId
 * Deletes a client-scoped custom activity entry.
 */
router.delete("/clients/:id/activity-entries/:entryId", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const entryId = String(req.params.entryId || "").trim();

    const existing = await prisma.compassionActivity.findFirst({
      where: {
        id: entryId,
        organizationId,
        clientId,
      },
      select: { id: true, activityType: true },
    });

    if (!existing || !isAllowedClientActivityEntryType(existing.activityType)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Activity entry not found" } });
      return;
    }

    await prisma.compassionActivity.delete({ where: { id: existing.id } });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_DELETED",
      entity: "CompassionActivity",
      entityId: existing.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType: existing.activityType },
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /clients/:id/activity-entries/:entryId error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete client activity entry" } });
  }
});

/**
 * PUT /api/compassion/clients/:id
 * Update a client record. Accepts any subset of client fields.
 */
router.put("/clients/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      firstName, lastName, preferredName, email, phone,
      addressLine1, addressLine2, city, state, zip,
      dateOfBirth, intakeDate, referralSource, assignedStaffId, assignedCompassionStaffId,
      privateNotes, clientStatus,
    } = req.body;

    const compassionStaffProvided = assignedCompassionStaffId !== undefined;
    const legacyStaffProvided = assignedStaffId !== undefined;

    const normalizedAssignedCompassionStaffId = compassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : undefined;
    let normalizedAssignedStaffId = legacyStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : undefined;

    if (compassionStaffProvided) {
      if (normalizedAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: normalizedAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!compassionStaff.supportsScheduling) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        // Clearing Compassion staff assignment also clears the legacy user link unless explicitly provided.
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const client = await prisma.compassionClient.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(preferredName !== undefined && { preferredName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(addressLine1 !== undefined && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2 }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zip !== undefined && { zip }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(intakeDate !== undefined && { intakeDate: new Date(intakeDate) }),
        ...(referralSource !== undefined && { referralSource }),
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(clientStatus !== undefined && { clientStatus: clientStatus as CompassionClientStatus }),
      },
    });

    if (client.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CLIENT_UPDATED",
      entity: "CompassionClient",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
      ipAddress: req.ip,
    });

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PUT /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update client" } });
  }
});

/**
 * DELETE /api/compassion/clients/:id
 * Permanently delete a client record. Admin only.
 */
router.delete("/clients/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionClient.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CLIENT_DELETED",
      entity: "CompassionClient",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
      ipAddress: req.ip,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete client" } });
  }
});

// ─── Cases ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/cases
 * List cases for the authenticated org.
 * Supports query params: clientId, status, limit.
 */
router.get("/cases", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, status, limit = "50" } = req.query as Record<string, string>;

    const cases = await prisma.compassionCase.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(status && { caseStatus: status as CompassionCaseStatus }),
      },
      take: parseInt(limit),
      orderBy: { openedAt: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        _count: { select: { appointments: true, followUps: true } },
      },
    });

    res.json(cases.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff,
      }),
    })));
  } catch (err) {
    console.error("[compassion] GET /cases error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load cases" } });
  }
});

/**
 * POST /api/compassion/cases
 * Create a new case. Auto-generates a CASE-YYYY-NNN case number.
 * Body: { clientId, caseType?, priority?, summary?, assignedStaffId? }
 */
router.post("/cases", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId,
      caseType,
      priority,
      summary,
      assignedStaffId,
      assignedCompassionStaffId,
      privateNotes,
    } = req.body;

    if (!clientId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId is required" } });
      return;
    }

    // Auto-generate case number: CASE-YYYY-NNN
    const count = await prisma.compassionCase.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    const caseNumber = `CASE-${year}-${String(count + 1).padStart(3, "0")}`;

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const compassionCase = await prisma.compassionCase.create({
      data: {
        organizationId,
        clientId,
        caseNumber,
        caseType: (caseType ?? "OTHER") as CompassionCaseType,
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        summary: summary ?? null,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        privateNotes: privateNotes ?? null,
        caseStatus: "OPEN",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    // Log activity on the client record
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId,
        caseId: compassionCase.id,
        activityType: "CASE_OPENED",
        description: `Case ${caseNumber} opened`,
        performedById: req.user?.sub ?? null,
        metadata: { caseType, priority },
      },
    });

    await logAudit({
      action: "COMPASSION_CASE_CREATED",
      entity: "CompassionCase",
      entityId: compassionCase.id,
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
    });

    res.status(201).json({
      ...compassionCase,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: compassionCase.assignedCompassionStaff,
        assignedStaff: compassionCase.assignedStaff,
      }),
    });
  } catch (err) {
    console.error("[compassion] POST /cases error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create case" } });
  }
});

/**
 * GET /api/compassion/cases/:id
 * Full case detail with appointments, services, follow-ups, and activity.
 */
router.get("/cases/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const compassionCase = await prisma.compassionCase.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        appointments: {
          orderBy: { startTime: "desc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        services: { orderBy: { serviceDate: "desc" } },
        followUps: {
          orderBy: { dueDate: "asc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { performedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!compassionCase) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    res.json({
      ...compassionCase,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: compassionCase.assignedCompassionStaff,
        assignedStaff: compassionCase.assignedStaff,
      }),
      appointments: compassionCase.appointments.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      followUps: compassionCase.followUps.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
    });
  } catch (err) {
    console.error("[compassion] GET /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load case" } });
  }
});

/**
 * PUT /api/compassion/cases/:id
 * Update a case (status, type, priority, notes, assignee).
 */
router.put("/cases/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      caseStatus,
      caseType,
      priority,
      summary,
      assignedStaffId,
      assignedCompassionStaffId,
      closedAt,
      privateNotes,
    } = req.body;

    const compassionStaffProvided = assignedCompassionStaffId !== undefined;
    const legacyStaffProvided = assignedStaffId !== undefined;
    const normalizedAssignedCompassionStaffId = compassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : undefined;
    let normalizedAssignedStaffId = legacyStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : undefined;

    if (compassionStaffProvided) {
      if (normalizedAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: normalizedAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const updated = await prisma.compassionCase.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(caseStatus !== undefined && { caseStatus: caseStatus as CompassionCaseStatus }),
        ...(caseType !== undefined && { caseType: caseType as CompassionCaseType }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(summary !== undefined && { summary }),
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
        ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
        ...(privateNotes !== undefined && { privateNotes }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CASE_UPDATED",
      entity: "CompassionCase",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
    });

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PUT /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update case" } });
  }
});

/**
 * DELETE /api/compassion/cases/:id
 * Permanently delete a case. Admin only.
 */
router.delete("/cases/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionCase.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CASE_DELETED",
      entity: "CompassionCase",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete case" } });
  }
});

// ─── Appointments ──────────────────────────────────────────────────────────────

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;
const APPOINTMENT_BLOCKING_STATUSES: CompassionAppointmentStatus[] = ["SCHEDULED", "RESCHEDULED"];

/** Adds a number of minutes to a date and returns a new Date instance. */
function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

/** Clamps user-provided appointment durations to a safe range. */
function sanitizeDurationMinutes(rawValue: unknown): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_APPOINTMENT_DURATION_MINUTES;
  return Math.min(12 * 60, Math.max(5, Math.round(parsed)));
}

/** Normalizes location for conflict comparisons. */
function normalizeLocation(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Resolves an appointment time window from start/end and optional duration. */
function resolveAppointmentWindow(params: {
  startTime: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
}): { start: Date; end: Date; durationMinutes: number } | null {
  const start = new Date(String(params.startTime ?? ""));
  if (Number.isNaN(start.getTime())) return null;

  if (params.endTime !== undefined && params.endTime !== null && params.endTime !== "") {
    const explicitEnd = new Date(String(params.endTime));
    if (Number.isNaN(explicitEnd.getTime()) || explicitEnd <= start) return null;
    const explicitDuration = Math.max(5, Math.round((explicitEnd.getTime() - start.getTime()) / 60_000));
    return { start, end: explicitEnd, durationMinutes: explicitDuration };
  }

  const durationMinutes = sanitizeDurationMinutes(params.durationMinutes);
  return { start, end: addMinutes(start, durationMinutes), durationMinutes };
}

interface AppointmentConflict {
  id: string;
  startTime: string;
  endTime: string;
  reasons: Array<"CLIENT" | "STAFF" | "LOCATION">;
  clientName: string;
  assignedStaffName: string | null;
  location: string | null;
}

/**
 * Finds overlapping appointments that should block scheduling.
 * Conflicts are returned for same client, same staff, or same location.
 */
async function findAppointmentConflicts(params: {
  organizationId: string;
  start: Date;
  end: Date;
  clientId: string;
  assignedCompassionStaffId?: string | null;
  assignedStaffId?: string | null;
  location?: string | null;
  excludeAppointmentId?: string;
}): Promise<AppointmentConflict[]> {
  const where: Prisma.CompassionAppointmentWhereInput = {
    organizationId: params.organizationId,
    status: { in: APPOINTMENT_BLOCKING_STATUSES },
    startTime: { lt: params.end },
    OR: [{ endTime: null }, { endTime: { gt: params.start } }],
    ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
  };

  const candidates = await prisma.compassionAppointment.findMany({
    where,
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedStaff: { select: { firstName: true, lastName: true } },
      assignedCompassionStaff: { select: { firstName: true, lastName: true, displayName: true } },
    },
  });

  const targetLocation = normalizeLocation(params.location);
  const conflicts: AppointmentConflict[] = [];

  for (const candidate of candidates) {
    const candidateEnd = candidate.endTime ?? addMinutes(candidate.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);
    const overlaps = candidate.startTime < params.end && candidateEnd > params.start;
    if (!overlaps) continue;

    const reasons: Array<"CLIENT" | "STAFF" | "LOCATION"> = [];
    if (candidate.clientId === params.clientId) reasons.push("CLIENT");
    const sameCompassionStaff = Boolean(
      params.assignedCompassionStaffId
      && candidate.assignedCompassionStaffId
      && candidate.assignedCompassionStaffId === params.assignedCompassionStaffId,
    );
    const sameLegacyStaff = Boolean(
      params.assignedStaffId
      && candidate.assignedStaffId
      && candidate.assignedStaffId === params.assignedStaffId,
    );
    if (sameCompassionStaff || sameLegacyStaff) reasons.push("STAFF");

    const candidateLocation = normalizeLocation(candidate.location);
    if (targetLocation && candidateLocation && candidateLocation === targetLocation) reasons.push("LOCATION");

    if (reasons.length === 0) continue;

    conflicts.push({
      id: candidate.id,
      startTime: candidate.startTime.toISOString(),
      endTime: candidateEnd.toISOString(),
      reasons,
      clientName: `${candidate.client.firstName} ${candidate.client.lastName}`,
      assignedStaffName: candidate.assignedCompassionStaff
        ? (candidate.assignedCompassionStaff.displayName ?? `${candidate.assignedCompassionStaff.firstName} ${candidate.assignedCompassionStaff.lastName}`)
        : (candidate.assignedStaff ? `${candidate.assignedStaff.firstName} ${candidate.assignedStaff.lastName}` : null),
      location: candidate.location ?? null,
    });
  }

  return conflicts;
}

/** Maps a DB appointment to a consistent API shape for list + calendar views. */
function mapAppointmentForWorkspace<T extends {
  startTime: Date;
  endTime: Date | null;
  followUpNeeded: boolean;
  assignedCompassionStaff?: { id: string; firstName: string; lastName: string; displayName?: string | null } | null;
  assignedStaff?: { id: string; firstName: string; lastName: string } | null;
  client: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; intakeDate?: Date | null };
}>(
  appointment: T,
  firstAppointmentByClient: Map<string, number>,
  noShowCountByClient: Map<string, number>,
) {
  const resolvedEnd = appointment.endTime ?? addMinutes(appointment.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);
  const durationMinutes = Math.max(5, Math.round((resolvedEnd.getTime() - appointment.startTime.getTime()) / 60_000));
  const firstStart = firstAppointmentByClient.get(appointment.client.id);
  const noShowCount = noShowCountByClient.get(appointment.client.id) ?? 0;
  const hasContact = Boolean((appointment.client.email ?? "").trim() || (appointment.client.phone ?? "").trim());

  return {
    ...appointment,
    endTime: resolvedEnd,
    durationMinutes,
    assignedStaff: resolveStaffReference({
      assignedCompassionStaff: appointment.assignedCompassionStaff,
      assignedStaff: appointment.assignedStaff,
    }),
    staff: resolveStaffReference({
      assignedCompassionStaff: appointment.assignedCompassionStaff,
      assignedStaff: appointment.assignedStaff,
    }),
    flags: {
      firstVisit: typeof firstStart === "number" && firstStart === appointment.startTime.getTime(),
      followUpNeeded: Boolean(appointment.followUpNeeded),
      noShowRisk: noShowCount > 0,
      incompleteIntake: !hasContact,
      noShowCount,
    },
  };
}

/**
 * GET /api/compassion/appointments
 * List appointments for calendar/list workspace.
 * Supports filters: clientId, caseId, status, appointmentType, assignedStaffId,
 * dateFrom, dateTo, location, search plus sorting.
 */
router.get("/appointments", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId,
      caseId,
      status,
      appointmentType,
      assignedStaffId,
      dateFrom,
      dateTo,
      location,
      search,
      sortBy = "startTime",
      sortOrder = "asc",
      limit = "250",
    } = req.query as Record<string, string>;

    const parsedLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 250));
    const normalizedSearch = (search ?? "").trim();

    const whereClauses: Array<Record<string, unknown>> = [];
    if (assignedStaffId) {
      whereClauses.push({
        OR: [
          { assignedCompassionStaffId: assignedStaffId },
          { assignedStaffId },
        ],
      });
    }

    if (normalizedSearch) {
      whereClauses.push({
        OR: [
          { notes: { contains: normalizedSearch } },
          { location: { contains: normalizedSearch } },
          { client: { firstName: { contains: normalizedSearch } } },
          { client: { lastName: { contains: normalizedSearch } } },
          { client: { email: { contains: normalizedSearch } } },
          { client: { phone: { contains: normalizedSearch } } },
          { assignedCompassionStaff: { is: { firstName: { contains: normalizedSearch } } } },
          { assignedCompassionStaff: { is: { lastName: { contains: normalizedSearch } } } },
        ],
      });
    }

    const where = {
      organizationId,
      ...(clientId && { clientId }),
      ...(caseId && { caseId }),
      ...(status && { status: status as CompassionAppointmentStatus }),
      ...(appointmentType && { appointmentType: appointmentType as CompassionAppointmentType }),
      ...(location && { location: location.trim() }),
      ...(dateFrom || dateTo
        ? {
            startTime: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
      ...(whereClauses.length > 0 ? { AND: whereClauses } : {}),
    };

    const orderBy: Prisma.CompassionAppointmentOrderByWithRelationInput =
      sortBy === "status"
        ? { status: sortOrder === "desc" ? "desc" : "asc" }
        : sortBy === "createdAt"
          ? { createdAt: sortOrder === "desc" ? "desc" : "asc" }
          : sortBy === "appointmentType"
            ? { appointmentType: sortOrder === "desc" ? "desc" : "asc" }
            : { startTime: sortOrder === "desc" ? "desc" : "asc" };

    const appointments = await prisma.compassionAppointment.findMany({
      where,
      take: parsedLimit,
      orderBy,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            intakeDate: true,
          },
        },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    const clientIds = [...new Set(appointments.map((appointment) => appointment.client.id))];
    const [firstByClient, noShowByClient] = await Promise.all([
      clientIds.length > 0
        ? prisma.compassionAppointment.groupBy({
            by: ["clientId"],
            where: { organizationId, clientId: { in: clientIds } },
            _min: { startTime: true },
          })
        : Promise.resolve([]),
      clientIds.length > 0
        ? prisma.compassionAppointment.groupBy({
            by: ["clientId"],
            where: { organizationId, clientId: { in: clientIds }, status: "NO_SHOW" },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const firstAppointmentByClient = new Map(firstByClient.map((row) => [row.clientId, row._min.startTime?.getTime() ?? Number.NaN]));
    const noShowCountByClient = new Map(noShowByClient.map((row) => [row.clientId, row._count._all]));

    const shaped = appointments.map((appointment) => mapAppointmentForWorkspace(appointment, firstAppointmentByClient, noShowCountByClient));

    res.json(shaped);
  } catch (err) {
    console.error("[compassion] GET /appointments error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointments" } });
  }
});

/**
 * POST /api/compassion/appointments
 * Create a new appointment.
 * Body: { clientId, caseId?, appointmentType?, status?, startTime, endTime?, durationMinutes?,
 *          location?, assignedStaffId?, notes?, followUpNeeded?, allowConflict? }
 */
router.post("/appointments", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId,
      caseId,
      appointmentType,
      status,
      startTime,
      endTime,
      durationMinutes,
      timezone,
      location,
      assignedCompassionStaffId,
      assignedStaffId,
      notes,
      followUpNeeded,
      allowConflict,
    } = req.body as Record<string, unknown>;

    if (!clientId || !startTime) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and startTime are required" } });
      return;
    }

    const timeWindow = resolveAppointmentWindow({ startTime, endTime, durationMinutes });
    if (!timeWindow) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid appointment time window" } });
      return;
    }

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);
    const normalizedLocation = String(location ?? "").trim() || null;

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      if (!compassionStaff.supportsScheduling) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    const client = await prisma.compassionClient.findFirst({
      where: { id: String(clientId), organizationId },
      select: { id: true },
    });
    if (!client) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Client not found in this organization" } });
      return;
    }

    if (caseId) {
      const compassionCase = await prisma.compassionCase.findFirst({
        where: { id: String(caseId), organizationId, clientId: client.id },
        select: { id: true },
      });
      if (!compassionCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const conflicts = await findAppointmentConflicts({
      organizationId,
      start: timeWindow.start,
      end: timeWindow.end,
      clientId: client.id,
      assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
      assignedStaffId: normalizedAssignedStaffId,
      location: normalizedLocation,
    });
    if (!allowConflict && conflicts.length > 0) {
      res.status(409).json({
        error: {
          code: "APPOINTMENT_CONFLICT",
          message: "Appointment conflicts with an existing booking.",
        },
        conflicts,
      });
      return;
    }

    const appointment = await prisma.compassionAppointment.create({
      data: {
        organizationId,
        clientId: client.id,
        caseId: caseId ? String(caseId) : null,
        appointmentType: (String(appointmentType ?? "OTHER") || "OTHER") as CompassionAppointmentType,
        status: (String(status ?? "SCHEDULED") || "SCHEDULED") as CompassionAppointmentStatus,
        startTime: timeWindow.start,
        endTime: timeWindow.end,
        timezone: String(timezone ?? "America/Chicago"),
        location: normalizedLocation,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        notes: notes ? String(notes) : null,
        followUpNeeded: Boolean(followUpNeeded),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    // Log activity
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: client.id,
        caseId: caseId ? String(caseId) : null,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_SCHEDULED",
        description: `Appointment scheduled for ${timeWindow.start.toLocaleDateString()}`,
        performedById: req.user?.sub ?? null,
        metadata: {
          source: "internal-scheduler",
          durationMinutes: timeWindow.durationMinutes,
          assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
          assignedStaffId: normalizedAssignedStaffId,
          location: normalizedLocation,
        },
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_CREATED",
      entity: "CompassionAppointment",
      entityId: appointment.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        clientId: client.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        location: normalizedLocation,
      },
    });

    const firstByClient = new Map([[appointment.client.id, appointment.startTime.getTime()]]);
    const noShowByClient = new Map([[appointment.client.id, 0]]);
    res.status(201).json(mapAppointmentForWorkspace(appointment, firstByClient, noShowByClient));
  } catch (err) {
    console.error("[compassion] POST /appointments error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create appointment" } });
  }
});

/**
 * GET /api/compassion/appointments/:id
 * Full appointment detail.
 */
router.get("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const appointment = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true, caseType: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        followUps: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    const firstByClient = new Map([[appointment.client.id, appointment.startTime.getTime()]]);
    const noShowByClient = new Map([[appointment.client.id, 0]]);
    res.json(mapAppointmentForWorkspace(appointment, firstByClient, noShowByClient));
  } catch (err) {
    console.error("[compassion] GET /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointment" } });
  }
});

/**
 * PATCH /api/compassion/appointments/:id
 * Partially update an appointment (status, outcome, notes, etc.).
 */
router.patch("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const existing = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    const {
      status,
      outcome,
      notes,
      startTime,
      endTime,
      durationMinutes,
      location,
      assignedCompassionStaffId,
      assignedStaffId,
      followUpNeeded,
      appointmentType,
      caseId,
      allowConflict,
    } = req.body as Record<string, unknown>;

    const nextClientId = existing.clientId;
    const assignedCompassionStaffProvided = assignedCompassionStaffId !== undefined;
    const assignedStaffProvided = assignedStaffId !== undefined;

    const nextAssignedCompassionStaffId = assignedCompassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : existing.assignedCompassionStaffId;
    let nextAssignedStaffId = assignedStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : existing.assignedStaffId;

    if (assignedCompassionStaffProvided) {
      if (nextAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: nextAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!compassionStaff.supportsScheduling) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
          return;
        }
        if (!assignedStaffProvided) {
          nextAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!assignedStaffProvided) {
        nextAssignedStaffId = null;
      }
    }

    const nextLocation = location !== undefined
      ? (String(location ?? "").trim() || null)
      : existing.location;
    const nextCaseId = caseId !== undefined
      ? (String(caseId ?? "").trim() || null)
      : existing.caseId;

    if (nextCaseId) {
      const linkedCase = await prisma.compassionCase.findFirst({
        where: { id: nextCaseId, organizationId, clientId: nextClientId },
        select: { id: true },
      });
      if (!linkedCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: nextAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    let nextStart = existing.startTime;
    let nextEnd = existing.endTime ?? addMinutes(existing.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);

    const startTimeProvided = startTime !== undefined;
    const endTimeProvided = endTime !== undefined;
    const durationProvided = durationMinutes !== undefined;

    if (startTimeProvided || endTimeProvided || durationProvided) {
      if (startTimeProvided && !endTimeProvided && !durationProvided) {
        const shiftedStart = new Date(String(startTime));
        if (Number.isNaN(shiftedStart.getTime())) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid startTime" } });
          return;
        }
        const currentDuration = Math.max(5, Math.round((nextEnd.getTime() - existing.startTime.getTime()) / 60_000));
        nextStart = shiftedStart;
        nextEnd = addMinutes(shiftedStart, currentDuration);
      } else {
        const effectiveEndInput = endTimeProvided
          ? endTime
          : (durationProvided ? undefined : existing.endTime?.toISOString());
        const resolvedWindow = resolveAppointmentWindow({
          startTime: startTimeProvided ? startTime : existing.startTime.toISOString(),
          endTime: effectiveEndInput,
          durationMinutes: durationProvided ? durationMinutes : undefined,
        });
        if (!resolvedWindow) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid appointment time window" } });
          return;
        }
        nextStart = resolvedWindow.start;
        nextEnd = resolvedWindow.end;
      }

      const conflicts = await findAppointmentConflicts({
        organizationId,
        start: nextStart,
        end: nextEnd,
        clientId: nextClientId,
        assignedCompassionStaffId: nextAssignedCompassionStaffId,
        assignedStaffId: nextAssignedStaffId,
        location: nextLocation,
        excludeAppointmentId: existing.id,
      });
      if (!allowConflict && conflicts.length > 0) {
        res.status(409).json({
          error: {
            code: "APPOINTMENT_CONFLICT",
            message: "Appointment conflicts with an existing booking.",
          },
          conflicts,
        });
        return;
      }
    }

    let nextStatus = status !== undefined
      ? (String(status) as CompassionAppointmentStatus)
      : existing.status;

    if (status === undefined && (startTimeProvided || endTimeProvided || durationProvided)) {
      if (existing.status === "SCHEDULED") nextStatus = "RESCHEDULED";
    }

    const updated = await prisma.compassionAppointment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        ...(outcome !== undefined && { outcome: outcome ? String(outcome) : null }),
        ...(notes !== undefined && { notes: notes ? String(notes) : null }),
        ...(startTimeProvided || endTimeProvided || durationProvided ? { startTime: nextStart, endTime: nextEnd } : {}),
        ...(location !== undefined && { location: nextLocation }),
        ...(assignedCompassionStaffProvided && { assignedCompassionStaffId: nextAssignedCompassionStaffId }),
        ...((assignedStaffProvided || assignedCompassionStaffProvided) && { assignedStaffId: nextAssignedStaffId }),
        ...(followUpNeeded !== undefined && { followUpNeeded: Boolean(followUpNeeded) }),
        ...(appointmentType !== undefined && { appointmentType: String(appointmentType) as CompassionAppointmentType }),
        ...(caseId !== undefined && { caseId: nextCaseId }),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    const statusChanged = nextStatus !== existing.status;
    const timeChanged = updated.startTime.getTime() !== existing.startTime.getTime()
      || (updated.endTime?.getTime() ?? 0) !== (existing.endTime?.getTime() ?? 0);

    if (statusChanged || timeChanged || notes !== undefined || outcome !== undefined) {
      await prisma.compassionActivity.create({
        data: {
          organizationId,
          clientId: updated.clientId,
          caseId: updated.caseId,
          appointmentId: updated.id,
          activityType: statusChanged ? "APPOINTMENT_STATUS_UPDATED" : (timeChanged ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_UPDATED"),
          description: statusChanged
            ? `Appointment status changed to ${nextStatus}`
            : (timeChanged
              ? `Appointment moved to ${updated.startTime.toLocaleString()}`
              : "Appointment details updated"),
          performedById: req.user?.sub ?? null,
          metadata: {
            previousStatus: existing.status,
            newStatus: nextStatus,
            previousStartTime: existing.startTime,
            newStartTime: updated.startTime,
          },
        },
      });
    }

    await logAudit({
      action: "COMPASSION_APPOINTMENT_UPDATED",
      entity: "CompassionAppointment",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        status: updated.status,
        startTime: updated.startTime,
        endTime: updated.endTime,
        assignedCompassionStaffId: updated.assignedCompassionStaffId,
        assignedStaffId: updated.assignedStaffId,
      },
    });

    const firstByClient = new Map([[updated.client.id, updated.startTime.getTime()]]);
    const noShowByClient = new Map([[updated.client.id, updated.status === "NO_SHOW" ? 1 : 0]]);
    res.json(mapAppointmentForWorkspace(updated, firstByClient, noShowByClient));
  } catch (err) {
    console.error("[compassion] PATCH /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update appointment" } });
  }
});

/**
 * DELETE /api/compassion/appointments/:id
 * Delete an appointment.
 */
router.delete("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const appointment = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      select: { id: true, clientId: true, caseId: true },
    });
    if (!appointment) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    await prisma.compassionAppointment.delete({ where: { id: appointment.id } });

    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: appointment.clientId,
        caseId: appointment.caseId,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_DELETED",
        description: "Appointment deleted",
        performedById: req.user?.sub ?? null,
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_DELETED",
      entity: "CompassionAppointment",
      entityId: appointment.id,
      userId: req.user?.sub,
      organizationId,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete appointment" } });
  }
});

// ─── Follow-ups ────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/follow-ups
 * List follow-ups. Supports filters: clientId, status, assignedStaffId.
 */
router.get("/follow-ups", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, status, priority, assignedStaffId, limit = "50" } = req.query as Record<string, string>;

    const whereClauses: Array<Record<string, unknown>> = [];
    if (assignedStaffId) {
      whereClauses.push({
        OR: [
          { assignedCompassionStaffId: assignedStaffId },
          { assignedStaffId },
        ],
      });
    }

    const followUps = await prisma.compassionFollowUp.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(status && { status: status as CompassionFollowUpStatus }),
        ...(priority && { priority: priority as CompassionPriority }),
        ...(whereClauses.length > 0 ? { AND: whereClauses } : {}),
      },
      take: parseInt(limit),
      orderBy: { dueDate: "asc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.json(followUps.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff,
      }),
    })));
  } catch (err) {
    console.error("[compassion] GET /follow-ups error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load follow-ups" } });
  }
});

/**
 * POST /api/compassion/follow-ups
 * Create a new follow-up item.
 * Body: { clientId, caseId?, appointmentId?, title, dueDate, priority?, assignedStaffId?, notes? }
 */
router.post("/follow-ups", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId,
      caseId,
      appointmentId,
      title,
      dueDate,
      priority,
      assignedStaffId,
      assignedCompassionStaffId,
      notes,
    } = req.body;

    if (!clientId || !title || !dueDate) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId, title, and dueDate are required" } });
      return;
    }

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const followUp = await prisma.compassionFollowUp.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        appointmentId: appointmentId ?? null,
        title,
        dueDate: new Date(dueDate),
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        notes: notes ?? null,
        status: "PENDING",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.status(201).json({
      ...followUp,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: followUp.assignedCompassionStaff,
        assignedStaff: followUp.assignedStaff,
      }),
    });
  } catch (err) {
    console.error("[compassion] POST /follow-ups error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create follow-up" } });
  }
});

/**
 * PATCH /api/compassion/follow-ups/:id
 * Partially update a follow-up (mark complete, change assignee, update notes).
 */
router.patch("/follow-ups/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      status,
      title,
      dueDate,
      priority,
      assignedStaffId,
      assignedCompassionStaffId,
      notes,
    } = req.body;

    const compassionStaffProvided = assignedCompassionStaffId !== undefined;
    const legacyStaffProvided = assignedStaffId !== undefined;
    const normalizedAssignedCompassionStaffId = compassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : undefined;
    let normalizedAssignedStaffId = legacyStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : undefined;

    if (compassionStaffProvided) {
      if (normalizedAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: normalizedAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const updated = await prisma.compassionFollowUp.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(status !== undefined && { status: status as CompassionFollowUpStatus }),
        ...(title !== undefined && { title }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
        ...(notes !== undefined && { notes }),
        // Auto-set completedAt when marking complete
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } });
      return;
    }

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PATCH /follow-ups/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update follow-up" } });
  }
});

/**
 * DELETE /api/compassion/follow-ups/:id
 * Delete a follow-up.
 */
router.delete("/follow-ups/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionFollowUp.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /follow-ups/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete follow-up" } });
  }
});

// ─── Services ──────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/services
 * List services delivered. Supports filters: clientId, caseId, serviceType, serviceTypes.
 */
router.get("/services", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, serviceType, serviceTypes, limit = "50" } = req.query as Record<string, string>;

    const requestedTypes = (serviceTypes ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as CompassionServiceType[];

    const services = await prisma.compassionService.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(caseId && { caseId }),
        ...(requestedTypes.length > 0
          ? { serviceType: { in: requestedTypes } }
          : serviceType
            ? { serviceType: serviceType as CompassionServiceType }
            : {}),
      },
      take: parseInt(limit),
      orderBy: { serviceDate: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        providedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(services);
  } catch (err) {
    console.error("[compassion] GET /services error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load services" } });
  }
});

/**
 * POST /api/compassion/services
 * Record a service delivered to a client.
 * Body: { clientId, caseId?, serviceType, serviceDate?, quantity?, notes?, providedById? }
 */
router.post("/services", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, serviceType, serviceDate, quantity, notes, providedById } = req.body;

    if (!clientId || !serviceType) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and serviceType are required" } });
      return;
    }

    const service = await prisma.compassionService.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        serviceType: serviceType as CompassionServiceType,
        serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
        quantity: quantity ?? null,
        notes: notes ?? null,
        providedById: providedById ?? req.user?.sub ?? null,
      },
    });

    res.status(201).json(service);
  } catch (err) {
    console.error("[compassion] POST /services error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create service record" } });
  }
});

/**
 * PATCH /api/compassion/services/:id
 * Partially update a service record.
 * Body: { serviceType?, serviceDate?, quantity?, notes?, providedById? }
 */
router.patch("/services/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { serviceType, serviceDate, quantity, notes, providedById } = req.body;

    if (
      serviceType === undefined
      && serviceDate === undefined
      && quantity === undefined
      && notes === undefined
      && providedById === undefined
    ) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No updatable fields were provided" } });
      return;
    }

    if (quantity !== undefined && quantity !== null && quantity !== "") {
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "quantity must be a non-negative number" } });
        return;
      }
    }

    if (serviceDate !== undefined) {
      const parsedServiceDate = new Date(serviceDate);
      if (Number.isNaN(parsedServiceDate.getTime())) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "serviceDate must be a valid date" } });
        return;
      }
    }

    const updated = await prisma.compassionService.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(serviceType !== undefined && { serviceType: serviceType as CompassionServiceType }),
        ...(serviceDate !== undefined && { serviceDate: new Date(serviceDate) }),
        ...(quantity !== undefined && {
          quantity:
            quantity === null || quantity === ""
              ? null
              : Number(quantity),
        }),
        ...(notes !== undefined && { notes: String(notes ?? "").trim() || null }),
        ...(providedById !== undefined && { providedById: providedById ? String(providedById) : null }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }

    const service = await prisma.compassionService.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        providedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!service) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_SERVICE_UPDATED",
      entity: "CompassionService",
      entityId: service.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        clientId: service.clientId,
        serviceType: service.serviceType,
      },
    });

    res.json(service);
  } catch (err) {
    console.error("[compassion] PATCH /services/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update service record" } });
  }
});

/**
 * DELETE /api/compassion/services/:id
 * Delete a service record. Admin only.
 */
router.delete("/services/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionService.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /services/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete service record" } });
  }
});

// ─── Client Import ────────────────────────────────────────────────────────────

/**
 * POST /api/compassion/clients/import
 * Batch-import CompassionClient records from a mapped CSV.
 *
 * Body:
 *   records              - Array of mapped row objects (CRM field keys to string values)
 *   mode                 - "create_only" | "upsert" | "update_only"
 *   dryRun               - When true, tallies what would happen without writing data
 *   matchExternalSourceId - When true, match on DirID stored in privateNotes as [EXT:xxx]
 *   matchEmail           - When true, match on email address
 *
 * Response: { created, updated, skipped, errors, dryRun, errorMessages }
 *
 * Safety guarantees:
 * - SSN is stripped server-side even if somehow included in the payload.
 * - This endpoint only creates/updates CompassionClient records.
 * - It does NOT create or modify Constituent (Donor CRM) records.
 * - It does NOT modify EventGuest or any other module records.
 * - All records are scoped to the authenticated organization.
 */
router.post("/clients/import", requirePermission("import:data"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found." } });
      return;
    }

    const {
      records,
      mode = "create_only",
      dryRun = true,
      matchExternalSourceId = true,
      matchEmail = true,
    } = req.body as {
      records: Array<Record<string, string>>;
      mode: "create_only" | "upsert" | "update_only";
      dryRun: boolean;
      matchExternalSourceId: boolean;
      matchEmail: boolean;
    };

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: { code: "NO_RECORDS", message: "No records to import." } });
      return;
    }

    // Safety: blocked sensitive fields that must never be stored
    const BLOCKED_FIELDS = new Set(["ssn", "socialSecurityNumber", "sin", "taxId"]);

    // Status normalization: eKYROS values → Prisma enum
    const statusNormalize = (raw: string): CompassionClientStatus => {
      const statusMap: Record<string, CompassionClientStatus> = {
        "active":    "ACTIVE",
        "inactive":  "INACTIVE",
        "inactiv":   "INACTIVE",
        "closed":    "ARCHIVED",
        "archived":  "ARCHIVED",
        "pending":   "PENDING",
        "graduated": "GRADUATED",
        "":          "ACTIVE",
      };
      return statusMap[(raw || "").trim().toLowerCase()] ?? "ACTIVE";
    };

    /** Parse a date string to a Date, returning undefined if invalid or empty */
    const parseDateOrUndefined = (raw: string | undefined): Date | undefined => {
      if (!raw?.trim()) return undefined;
      const d = new Date(raw.trim());
      return isNaN(d.getTime()) ? undefined : d;
    };

    /** Merge import-note lines without duplicating existing lines. */
    const mergePrivateNotes = (existing: string | null | undefined, incoming: string | undefined): string | undefined => {
      if (!incoming?.trim()) return existing ?? undefined;
      const existingLines = (existing ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      const incomingLines = incoming.split("\n").map((l) => l.trim()).filter(Boolean);
      const merged = [...existingLines];
      for (const line of incomingLines) {
        if (!merged.includes(line)) merged.push(line);
      }
      return merged.length > 0 ? merged.join("\n") : undefined;
    };

    /** Preserve non-modeled source fields as private notes so imports do not silently discard real data. */
    const buildPrivateImportNotes = (rec: Record<string, string>): string | undefined => {
      const parts: string[] = [];
      if (rec.externalSourceId?.trim()) parts.push(`[EXT:${rec.externalSourceId.trim()}]`);
      if (rec.honorific?.trim()) parts.push(`Title: ${rec.honorific.trim()}`);
      if (rec.formalName?.trim()) parts.push(`Formal Name: ${rec.formalName.trim()}`);
      if (rec.mobilePhone?.trim()) parts.push(`Mobile Phone: ${rec.mobilePhone.trim()}`);
      if (rec.workPhone?.trim()) parts.push(`Work Phone: ${rec.workPhone.trim()}`);
      if (rec.keywords?.trim()) parts.push(`Keywords: ${rec.keywords.trim()}`);
      if (rec.maritalStatus?.trim()) parts.push(`Marital Status: ${rec.maritalStatus.trim()}`);
      if (rec.religion?.trim()) parts.push(`Religion: ${rec.religion.trim()}`);
      if (rec.educationLevel?.trim()) parts.push(`Education Level: ${rec.educationLevel.trim()}`);
      if (rec.incomeLevel?.trim()) parts.push(`Income Level: ${rec.incomeLevel.trim()}`);
      if (rec.studentStatus?.trim()) parts.push(`Student Status: ${rec.studentStatus.trim()}`);
      if (rec.race?.trim()) parts.push(`Race: ${rec.race.trim()}`);
      if (rec.sourceModifiedDate?.trim()) parts.push(`Source Modified: ${rec.sourceModifiedDate.trim()}`);
      if (rec.sourceLastUpdatedBy?.trim()) parts.push(`Source Last Updated By: ${rec.sourceLastUpdatedBy.trim()}`);
      return parts.length > 0 ? parts.join("\n") : undefined;
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rec of records) {
      try {
        // Strip blocked sensitive fields from every incoming record
        for (const blocked of BLOCKED_FIELDS) {
          delete rec[blocked];
        }

        // Require at least a first name or last name
        const firstName = rec.firstName?.trim() || "";
        const lastName = rec.lastName?.trim() || "";
        if (!firstName && !lastName) {
          skipped++;
          continue;
        }

        // Reject metadata / report / widget rows with a stronger heuristic that mirrors
        // the client-side validator in app/compassion/import/clients/clientImportValidator.ts.
        // This is defense-in-depth: the wizard already filters these out, but a misbehaving
        // client (or curl) must not be able to inject garbage rows directly into the DB.
        //
        // ⚠ KEEP IN SYNC with GARBAGE_NAME_PATTERNS / RESERVED_NAME_TOKENS in
        // clientImportValidator.ts. The AGENTS.md "Compassion CRM Rules" section spells out
        // this requirement. If you change one heuristic, change the other and add a unit test
        // in tests/unit/compassion-client-import-validator.test.ts.
        const looksLikeGarbage = (s: string) => {
          const t = (s ?? "").trim();
          if (!t) return false;
          // Comma-separated metadata e.g. "Text,Aurora,False,Active,No,Not Applicable"
          if (/^[A-Za-z]+(?:,[^,]*){2,}/.test(t)) return true;
          // Widget / control / report tokens
          if (/^(text|true|false|null|none|n\/a|na|undefined|#?\s*row|column|label|field|widget|report|page|total|export|generated|filter|legend|header|footer)\b/i.test(t))
            return true;
          // ALL_CAPS layout artifacts
          if (/^[A-Z0-9_\-\s]{12,}$/.test(t)) return true;
          // Mostly digits / dashes / em-dashes
          if (/^[\d\s\-—–.,/]{6,}$/.test(t)) return true;
          // Contains the eKYROS em-dash separator
          if (/\s—\s/.test(t)) return true;
          // Single-token reserved placeholders
          if (/^(test|demo|sample|placeholder|tbd|tba|anonymous|unknown)$/i.test(t)) return true;
          return false;
        };
        if (looksLikeGarbage(firstName) || looksLikeGarbage(lastName)) {
          skipped++;
          continue;
        }

        // Drop obviously-invalid emails server-side too — never store junk in the email column.
        if (rec.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(rec.email.trim())) {
          delete rec.email;
        }

        const clientStatus = statusNormalize(rec.clientStatus ?? "");
        const intakeDate = parseDateOrUndefined(rec.sourceCreatedDate || rec.intakeDate) ?? new Date();
        const importNotes = buildPrivateImportNotes(rec);

        const clientData = {
          organizationId,
          firstName,
          lastName,
          preferredName:  rec.preferredName?.trim()  || undefined,
          email:          rec.email?.trim()           || undefined,
          phone:          rec.phone?.trim()           || undefined,
          addressLine1:   rec.addressLine1?.trim()    || undefined,
          addressLine2:   rec.addressLine2?.trim()    || undefined,
          city:           rec.city?.trim()            || undefined,
          state:          rec.state?.toUpperCase().slice(0, 2) || undefined,
          zip:            rec.zip?.trim()             || undefined,
          dateOfBirth:    parseDateOrUndefined(rec.dateOfBirth),
          referralSource: rec.referralSource?.trim()  || undefined,
          clientStatus,
          intakeDate,
        };

        // Find potential duplicate: prefer External Source ID, fall back to email
        const existingByExtId = matchExternalSourceId && rec.externalSourceId
          ? await prisma.compassionClient.findFirst({
              where: { organizationId, privateNotes: { contains: `[EXT:${rec.externalSourceId}]` } },
              select: { id: true, privateNotes: true },
            })
          : null;

        const existingByEmail = !existingByExtId && matchEmail && clientData.email
          ? await prisma.compassionClient.findFirst({
              where: { organizationId, email: clientData.email },
              select: { id: true, privateNotes: true },
            })
          : null;

        const existing = existingByExtId ?? existingByEmail;

        if (dryRun) {
          // Dry-run: tally what would happen without writing any data
          if (existing) {
            if (mode === "create_only") {
              skipped++;
            } else {
              updated++;
            }
          } else {
            if (mode === "update_only") {
              skipped++;
            } else {
              created++;
            }
          }
          continue;
        }

        // Real import path
        if (existing) {
          if (mode === "create_only") {
            skipped++;
            continue;
          }
          // Update existing client (upsert or update_only mode)
          await prisma.compassionClient.update({
            where: { id: existing.id },
            data: {
              firstName:      clientData.firstName || undefined,
              lastName:       clientData.lastName  || undefined,
              preferredName:  clientData.preferredName,
              email:          clientData.email,
              phone:          clientData.phone,
              addressLine1:   clientData.addressLine1,
              addressLine2:   clientData.addressLine2,
              city:           clientData.city,
              state:          clientData.state,
              zip:            clientData.zip,
              dateOfBirth:    clientData.dateOfBirth,
              referralSource: clientData.referralSource,
              intakeDate:     clientData.intakeDate,
              clientStatus,
              privateNotes:   mergePrivateNotes(existing.privateNotes, importNotes),
            },
          });
          updated++;
        } else {
          if (mode === "update_only") {
            skipped++;
            continue;
          }
          // Store external source ID in privateNotes as a structured annotation
          // TODO: add a dedicated externalSourceId field to CompassionClient schema
          const newClient = await prisma.compassionClient.create({
            data: { ...clientData, privateNotes: importNotes },
          });

          // Log an activity for each newly created client
          await prisma.compassionActivity.create({
            data: {
              organizationId,
              clientId: newClient.id,
              activityType: "CLIENT_IMPORTED",
              description: `Client imported from CSV${rec.externalSourceId ? ` (DirID: ${rec.externalSourceId})` : ""}`,
              performedById: req.user?.sub ?? null,
            },
          });
          created++;
        }
      } catch (rowErr) {
        errors.push(`Row error: ${rowErr instanceof Error ? rowErr.message : "Unknown error"}`);
      }
    }

    await logAudit({
      action: dryRun ? "COMPASSION_CLIENT_IMPORT_DRYRUN" : "COMPASSION_CLIENT_IMPORT",
      entity: "CompassionClient",
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
      metadata: {
        created,
        updated,
        skipped,
        errors: errors.length,
        dryRun,
        recordCount: records.length,
      },
    });

    res.json({
      created,
      updated,
      skipped,
      errors: errors.length,
      dryRun,
      errorMessages: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("[compassion/clients/import]", err instanceof Error ? err.message : err);
    res.status(500).json({ error: { code: "IMPORT_ERROR", message: "Import failed." } });
  }
});

export default router;
