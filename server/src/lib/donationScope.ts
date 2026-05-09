/**
 * Shared donation query helpers.
 *
 * These helpers define the canonical organization-scoped donation filters used by
 * both the Donations page API and dashboard/report aggregates so all donation-based
 * metrics are derived from the same source-of-truth query rules.
 */
import type { DonationStatus, Prisma } from "@prisma/client";

/**
 * Returns the canonical organization scope for donation queries.
 * Donations are scoped through their linked constituent organization.
 */
export function donationOrgWhere(organizationId: string): Prisma.DonationWhereInput {
  return { constituent: { organizationId } };
}

/**
 * Builds a completed-donation filter for aggregate metrics.
 * Use this for revenue widgets where only completed gifts count toward raised totals.
 */
export function completedDonationWhere(
  organizationId: string,
  date?: Prisma.DateTimeFilter
): Prisma.DonationWhereInput {
  return {
    ...donationOrgWhere(organizationId),
    status: "COMPLETED" satisfies DonationStatus,
    ...(date ? { date } : {}),
  };
}
