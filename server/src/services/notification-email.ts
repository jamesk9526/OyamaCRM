import { prisma } from "../lib/prisma.js";
import { sendOrganizationEmail } from "./smtp-service.js";

export function notificationSubject(template: string, values: { title: string; module: string; severity: string }) {
  return template.replace(/\{(title|module|severity)\}/g, (_, key: keyof typeof values) => values[key]).replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 200);
}
export function validNotificationSubject(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 180 && !/[\r\n\x00-\x1f]/.test(value)
    && !/[{}]/.test(value.replace(/\{(title|module|severity)\}/g, ""));
}

let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;
let afterId: string | undefined;
export async function processNotificationEmails() {
  const subscriptions = await prisma.notificationEmailSubscription.findMany({ where: { enabled: true }, orderBy: { id: "asc" }, take: 50, ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}) });
  afterId = subscriptions.length === 50 ? subscriptions[49].id : undefined;
  for (const subscription of subscriptions) {
    const recipient = await prisma.user.findFirst({ where: { id: subscription.userId, organizationId: subscription.organizationId, active: true, role: "admin" }, select: { email: true } });
    if (!recipient) continue;
    const now = new Date();
    const notices = await prisma.notification.findMany({ where: {
      organizationId: subscription.organizationId, userId: subscription.userId, createdAt: { gte: subscription.enabledAt }, archivedAt: null,
      status: { in: ["UNREAD", "READ"] },
      ...(subscription.minimumSeverity === "HIGH" ? { severity: { in: ["HIGH", "CRITICAL"] } } : {}),
      AND: [{ OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      emailDeliveries: { none: { subscriptionId: subscription.id } },
    }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 20 });
    for (const notice of notices) {
      // A unique durable claim prevents two workers sending the same alert.
      // SMTP acknowledgement can be ambiguous: never automatically resend a claim.
      const current = await prisma.notificationEmailSubscription.findFirst({ where: { id: subscription.id, enabled: true, updatedAt: subscription.updatedAt } });
      if (!current) break;
      let delivery;
      try { delivery = await prisma.notificationEmailDelivery.create({ data: { subscriptionId: subscription.id, notificationId: notice.id } }); }
      catch (error) { if ((error as { code?: string }).code === "P2002") continue; throw error; }
      try {
        await sendOrganizationEmail({ organizationId: subscription.organizationId, to: recipient.email,
          subject: notificationSubject(subscription.subjectTemplate, notice),
          text: `${notice.title}\n\n${notice.message}\n\nWorkspace: ${notice.module}\nPriority: ${notice.severity}\n\nOpen OyamaCRM and visit Notifications to act on this alert.\nManage email delivery in Settings > Notification email.`,
        });
      } catch {
        await prisma.notificationEmailDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", completedAt: new Date() } });
        continue;
      }
      await prisma.notificationEmailDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", completedAt: new Date() } });
    }
  }
}
export function startNotificationEmailWorker() {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = processNotificationEmails().catch(() => { console.error("[notification-email] Delivery scan failed; check database migration and mail configuration."); }).finally(() => { running = null; });
  }, 30_000);
  timer.unref();
}
export async function stopNotificationEmailWorker() { if (timer) clearInterval(timer); timer = null; await running; }
