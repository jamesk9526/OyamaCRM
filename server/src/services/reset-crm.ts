/**
 * CRM reset service that clears the current installation back to first-run state.
 * This is intentionally installation-wide so `/setup` becomes available again.
 */
import { prisma } from "../lib/prisma.js";

/**
 * Removes all CRM data needed to reopen the first-run setup wizard.
 * The reset is destructive and intentionally clears business data, auth state,
 * and audit history so the installation behaves like a fresh start.
 */
export async function resetCrmInstallation(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Delete auth and workflow children before parent records to satisfy FK constraints.
    await tx.refreshToken.deleteMany();
    await tx.automationAction.deleteMany();
    await tx.activity.deleteMany();
    await tx.eventAttendance.deleteMany();
    await tx.volunteerHour.deleteMany();
    await tx.constituentTag.deleteMany();
    await tx.donation.deleteMany();
    await tx.pledge.deleteMany();
    await tx.task.deleteMany();
    await tx.emailCampaign.deleteMany();
    await tx.automation.deleteMany();
    await tx.event.deleteMany();
    await tx.campaign.deleteMany();

    // Break the household self-references before deleting people/households.
    await tx.household.updateMany({
      data: {
        headConstituentId: null,
      },
    });
    await tx.constituent.updateMany({
      data: {
        householdId: null,
      },
    });

    await tx.constituent.deleteMany();
    await tx.household.deleteMany();
    await tx.designation.deleteMany();
    await tx.tag.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.organizationSettings.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();
  });
}
