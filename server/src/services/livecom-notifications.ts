/** Recipient policy matches LiveCom's permissioned inbox; it never includes care-only accounts. */
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { createNotification } from "./notifications.js";

export async function notifyLiveComStaff(args: {
  organizationId: string; conversationId: string; interactionId: string;
  visitorName: string; message: string; siteName: string;
}): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: args.organizationId, active: true, role: { not: "compassion_user" } },
      select: { id: true, role: true, permissions: { where: { permission: "view:communications" }, select: { granted: true } } },
    });
    // Explicit denies override role defaults; explicit grants allow inbox viewers.
    // Query all eligible staff so a fixed recipient cap cannot silently lose messages.
    const recipients = users.filter((user) => user.permissions[0]?.granted ?? hasDefaultPermission(user.role, "view:communications"));
    const results = await Promise.allSettled(recipients.map((user) => createNotification({
      organizationId: args.organizationId, userId: user.id, module: "donor", sourceType: "livecom-message",
      sourceId: args.interactionId, title: `LiveCom message from ${args.visitorName || "Website Visitor"}`,
      message: `${args.siteName || "Website"}: ${args.message.slice(0, 180)}`,
      href: `/livecom/inbox?conversationId=${encodeURIComponent(args.conversationId)}`,
      severity: "HIGH", actionLabel: "Open LiveCom",
      metadata: { conversationId: args.conversationId, visitorName: args.visitorName, source: "site_embeds" },
    })));
    if (results.some((result) => result.status === "rejected")) console.warn("[SiteEmbeds] Some LiveCom staff notifications could not be saved.");
  } catch {
    // Visitor messages remain persisted when staff alerts fail. Do not expose
    // their contents or raw database diagnostics in public request logs.
    console.warn("[SiteEmbeds] LiveCom staff notifications could not be saved.");
  }
}
