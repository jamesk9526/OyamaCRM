/** Support ticket intake for location-aware CRM assistance and issue reporting. */
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { sendOrganizationEmail, type OrganizationEmailAttachment } from "../services/smtp-service.js";
import { recordWatchdogSecurityEvent } from "../services/watchdog-store.js";

const router = Router();
const SUPPORT_TICKET_PLUGIN_KEY = "support-ticket-delivery";
const TICKET_TYPES = ["bug_report", "feature_request", "confusing_ui", "data_issue", "general_feedback"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const CRM_SCOPES = ["donor", "events", "watchdog", "webmaster", "reportit", "other", "unknown"] as const;
const MAX_SCREENSHOT_BYTES = 2_500_000;

interface SupportTicketPayload {
  type?: string;
  priority?: string;
  summary?: string;
  whatTryingToDo?: string;
  expectedResult?: string;
  comments?: string;
  screenshotDataUrl?: string;
  context?: {
    crmScope?: string;
    pageUrl?: string;
    routePath?: string;
    pageTitle?: string;
    browserInfo?: string;
    deviceInfo?: string;
    appVersion?: string;
    environment?: string;
  };
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value.trim()) ? value.trim() as T : fallback;
}

function isValidEmail(value: string): boolean {
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value);
}

function parseScreenshot(value: unknown): { dataUrl: string; attachment: OrganizationEmailAttachment } | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) return null;

  const [, contentType, contentBase64] = match;
  const estimatedBytes = Math.floor(contentBase64.length * 0.75);
  if (estimatedBytes > MAX_SCREENSHOT_BYTES) return null;

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return {
    dataUrl: value.trim(),
    attachment: {
      filename: `oyamacrm-support-screenshot.${extension}`,
      contentType,
      contentBase64,
    },
  };
}

function nextTicketNumber(previous: string | null): string {
  const match = previous ? /^SUP-(\d+)$/.exec(previous) : null;
  const number = match ? Number(match[1]) : 0;
  return `SUP-${String((Number.isFinite(number) ? number : 0) + 1).padStart(6, "0")}`;
}

async function createTicket(data: Omit<Prisma.WatchdogFeedbackTicketUncheckedCreateInput, "ticketNumber">) {
  const latest = await prisma.watchdogFeedbackTicket.findFirst({
    where: { ticketNumber: { startsWith: "SUP-" } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });

  let ticketNumber = nextTicketNumber(latest?.ticketNumber ?? null);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await prisma.watchdogFeedbackTicket.create({ data: { ...data, ticketNumber } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        ticketNumber = nextTicketNumber(ticketNumber);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Could not allocate a support ticket number.");
}

function supportRecipient(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const recipient = String((config as Record<string, unknown>).recipientEmail ?? "").trim();
  return isValidEmail(recipient) ? recipient : null;
}

/** POST /api/support-tickets - creates one location-aware support request and emails configured support. */
router.post("/", requireAuth, requirePermission("feedback.submit"), async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const payload = req.body as SupportTicketPayload;
  const summary = readText(payload.summary, 300);
  const pageUrl = readText(payload.context?.pageUrl, 2000);
  if (!summary || !pageUrl) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A summary and current page location are required." } });
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    return res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization is configured for this request." } });
  }

  const screenshot = parseScreenshot(payload.screenshotDataUrl);
  const type = pickEnum(payload.type, TICKET_TYPES, "bug_report");
  const priority = pickEnum(payload.priority, PRIORITIES, "normal");
  const crmScope = pickEnum(payload.context?.crmScope, CRM_SCOPES, "unknown");
  const [user, setting] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.pluginSetting.findUnique({
      where: { organizationId_pluginKey: { organizationId, pluginKey: SUPPORT_TICKET_PLUGIN_KEY } },
      select: { config: true },
    }),
  ]);
  const recipient = supportRecipient(setting?.config);
  const submittedByName = user ? `${user.firstName} ${user.lastName}`.trim() : null;

  const ticket = await createTicket({
    organizationId,
    type,
    status: "new",
    priority,
    crmScope,
    pageUrl,
    routePath: readText(payload.context?.routePath, 500),
    pageTitle: readText(payload.context?.pageTitle, 300),
    submittedByUserId: userId,
    submittedByName,
    submittedByEmail: user?.email ?? req.user?.email ?? null,
    whatTryingToDo: readText(payload.whatTryingToDo, 5000),
    whatHappened: summary,
    expectedResult: readText(payload.expectedResult, 5000),
    extraComments: readText(payload.comments, 7000),
    browserInfo: readText(payload.context?.browserInfo, 400),
    deviceInfo: readText(payload.context?.deviceInfo, 400),
    appVersion: readText(payload.context?.appVersion, 120),
    environment: readText(payload.context?.environment, 120),
    supportSummary: summary,
    screenshotDataUrl: screenshot?.dataUrl ?? null,
    screenshotCapturedAt: screenshot ? new Date() : null,
    supportEmailRecipient: recipient,
    supportEmailStatus: recipient ? "pending" : "not_configured",
  });

  let emailStatus = ticket.supportEmailStatus;
  let emailError: string | null = null;
  if (recipient) {
    const message = [
      `Support ticket: ${ticket.ticketNumber}`,
      `Summary: ${summary}`,
      `Category: ${type}`,
      `Priority: ${priority}`,
      `CRM area: ${crmScope}`,
      `Page: ${pageUrl}`,
      `Submitted by: ${submittedByName || "Unknown"} (${user?.email ?? "no email"})`,
      payload.whatTryingToDo ? `Trying to do: ${payload.whatTryingToDo.trim()}` : "",
      payload.expectedResult ? `Expected result: ${payload.expectedResult.trim()}` : "",
      payload.comments ? `Comments: ${payload.comments.trim()}` : "",
    ].filter(Boolean).join("\n");

    try {
      await sendOrganizationEmail({
        organizationId,
        to: recipient,
        subject: `[OyamaCRM Support ${priority}] ${ticket.ticketNumber}: ${summary}`,
        text: message,
        fromNameOverride: "OyamaCRM Support",
        attachments: screenshot ? [screenshot.attachment] : undefined,
      });
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";
      emailError = error instanceof Error ? error.message.slice(0, 4000) : "Support email could not be delivered.";
    }

    await prisma.watchdogFeedbackTicket.update({
      where: { id: ticket.id },
      data: { supportEmailStatus: emailStatus, supportEmailError: emailError },
    });
  }

  await logAudit({
    action: "SUPPORT_TICKET_SUBMITTED",
    entity: "WatchdogFeedbackTicket",
    entityId: ticket.id,
    userId,
    organizationId,
    metadata: { ticketNumber: ticket.ticketNumber, type, priority, crmScope, screenshotCaptured: Boolean(screenshot), emailStatus },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  void recordWatchdogSecurityEvent({
    organizationId,
    severity: priority === "urgent" ? "critical" : priority === "high" ? "high" : priority === "normal" ? "medium" : "low",
    eventType: "SUPPORT_TICKET_SUBMITTED",
    sourceModule: "watchdog",
    message: `Support ticket ${ticket.ticketNumber} submitted`,
    payload: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, emailStatus },
  }).catch(() => {});

  return res.status(201).json({
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    },
    notification: {
      status: emailStatus,
      recipient,
      error: emailError,
    },
  });
});

export default router;
