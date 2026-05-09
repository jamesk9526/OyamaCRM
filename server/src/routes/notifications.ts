/**
 * Notifications routes for OyamaCRM TopBar panel.
 * Aggregates user-scoped reminders across modules.
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Notifications are user-specific and require authentication.
router.use(requireAuth);

interface NotificationItem {
  id: string;
  type: "task" | "meeting" | "follow_up" | "appointment";
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
}

/**
 * GET /api/notifications?module=donor|compassion|events
 * Returns user-scoped notification items for the selected module.
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const moduleKey = ((req.query.module as string) || "donor").toLowerCase();
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.json({ items: [], unreadCount: 0 });
      return;
    }

    const now = new Date();
    const items: NotificationItem[] = [];

    if (moduleKey === "compassion") {
      const [followUps, appointments] = await Promise.all([
        prisma.compassionFollowUp.findMany({
          where: {
            organizationId,
            assignedStaffId: userId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
          orderBy: { dueDate: "asc" },
          take: 6,
          include: {
            client: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.compassionAppointment.findMany({
          where: {
            organizationId,
            assignedStaffId: userId,
            startTime: { gte: now },
            status: "SCHEDULED",
          },
          orderBy: { startTime: "asc" },
          take: 4,
          include: {
            client: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

      for (const followUp of followUps) {
        const overdue = followUp.dueDate < now;
        items.push({
          id: `follow-up:${followUp.id}`,
          type: "follow_up",
          title: followUp.title,
          message: `${followUp.client.firstName} ${followUp.client.lastName} · ${overdue ? "Overdue" : "Due soon"}`,
          href: "/compassion/follow-ups",
          createdAt: followUp.createdAt.toISOString(),
          priority: overdue || followUp.priority === "URGENT" || followUp.priority === "HIGH" ? "high" : "medium",
        });
      }

      for (const appointment of appointments) {
        items.push({
          id: `appointment:${appointment.id}`,
          type: "appointment",
          title: "Upcoming appointment",
          message: `${appointment.client.firstName} ${appointment.client.lastName} · ${new Date(appointment.startTime).toLocaleString()}`,
          href: "/compassion/appointments",
          createdAt: appointment.createdAt.toISOString(),
          priority: "medium",
        });
      }
    } else {
      const [tasks, meetings] = await Promise.all([
        prisma.task.findMany({
          where: {
            OR: [{ createdById: userId }, { assigneeId: userId }],
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 8,
        }),
        prisma.meeting.findMany({
          where: {
            organizationId,
            OR: [{ createdById: userId }, { assignedStaffId: userId }],
            status: "SCHEDULED",
            startTime: { gte: now },
          },
          orderBy: { startTime: "asc" },
          take: 4,
        }),
      ]);

      for (const task of tasks) {
        const overdue = task.dueDate ? task.dueDate < now : false;
        items.push({
          id: `task:${task.id}`,
          type: "task",
          title: task.title,
          message: task.dueDate
            ? `${overdue ? "Overdue" : "Due"} ${new Date(task.dueDate).toLocaleDateString()}`
            : "No due date",
          href: "/tasks",
          createdAt: task.createdAt.toISOString(),
          priority: overdue || task.priority === "URGENT" || task.priority === "HIGH" ? "high" : "medium",
        });
      }

      for (const meeting of meetings) {
        items.push({
          id: `meeting:${meeting.id}`,
          type: "meeting",
          title: meeting.title,
          message: `Scheduled ${new Date(meeting.startTime).toLocaleString()}`,
          href: "/meetings",
          createdAt: meeting.createdAt.toISOString(),
          priority: "low",
        });
      }
    }

    const sorted = items
      .sort((a, b) => {
        const priorityWeight = (value: NotificationItem["priority"]) =>
          value === "high" ? 3 : value === "medium" ? 2 : 1;
        const byPriority = priorityWeight(b.priority) - priorityWeight(a.priority);
        if (byPriority !== 0) return byPriority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12);

    res.json({
      items: sorted,
      unreadCount: sorted.length,
    });
  } catch (err) {
    console.error("[notifications] GET / error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load notifications" } });
  }
});

export default router;
