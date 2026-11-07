import { Router } from "express";
import { prisma } from "../database.js";
import { resolveOrganizationId } from "../security.js";
const router = Router();


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

    const rawRangeDays = String((req.query as Record<string, string>).rangeDays ?? "").trim();
    const rangeDays = [30, 90, 365].includes(Number(rawRangeDays)) ? Number(rawRangeDays) : 30;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfRange = new Date(now.getTime() - (rangeDays * 24 * 60 * 60 * 1000));
    const nextSevenDays = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    const [
      totalClients,
      activeCases,
      newClientsThisMonth,
      apptsThisMonth,
      apptsLastMonth,
      completedApptsThisMonth,
      appointmentsInRange,
      completedAppointmentsInRange,
      noShowAppointmentsInRange,
      upcomingAppointmentsNext7Days,
      openFollowUps,
      overdueFollowUps,
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
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfRange, lte: now },
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfRange, lte: now },
          status: "COMPLETED",
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: startOfRange, lte: now },
          status: "NO_SHOW",
        },
      }),
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: now, lte: nextSevenDays },
          status: { in: ["SCHEDULED", "RESCHEDULED"] },
        },
      }),
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
        },
      }),
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          OR: [
            { status: "OVERDUE" },
            {
              status: { in: ["PENDING", "IN_PROGRESS"] },
              dueDate: { lt: now },
            },
          ],
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
          startTime: { gte: startOfRange, lte: now },
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

    const completionRateInRange = appointmentsInRange > 0
      ? Math.round((completedAppointmentsInRange / appointmentsInRange) * 100)
      : 0;

    const noShowRateInRange = appointmentsInRange > 0
      ? Math.round((noShowAppointmentsInRange / appointmentsInRange) * 100)
      : 0;

    res.json({
      generatedAt: now.toISOString(),
      rangeDays,
      windowStart: startOfRange.toISOString(),
      windowEnd: now.toISOString(),
      kpis: {
        totalClients,
        activeCases,
        newClientsThisMonth,
        appointmentsThisMonth: apptsThisMonth,
        appointmentsLastMonth: apptsLastMonth,
        completedAppointmentsThisMonth: completedApptsThisMonth,
        completionRate,
        monthDeltaPercent,
        appointmentsInRange,
        completedAppointmentsInRange,
        completionRateInRange,
        noShowAppointmentsInRange,
        noShowRateInRange,
        upcomingAppointmentsNext7Days,
        openFollowUps,
        overdueFollowUps,
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
  } catch {
    console.error("[compassion] GET /reports/summary error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load reports summary" } });
  }
});
export const reportingRoutes = router;
