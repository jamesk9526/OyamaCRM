import { Router } from "express";
import { prisma } from "../database.js";
import { resolveOrganizationId } from "../security.js";
import { resolveStaffReference } from './shared.js';
const router = Router();


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
  } catch {
    console.error("[compassion] dashboard-summary error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load dashboard summary" } });
  }
});
export const overviewRoutes = router;
