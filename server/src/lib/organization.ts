/**
 * Organization resolution helpers for installation-aware route behavior.
 * These helpers remove seeded `org_demo` assumptions from live request flows.
 */
import type { Request } from "express";
import { prisma } from "./prisma.js";

interface ResolveOrganizationOptions {
  /** Optional request so authenticated org context can be preferred. */
  req?: Request;
  /** Optional explicit organization ID from the request body/query. */
  requestedOrganizationId?: string | null;
}

/**
 * Resolves the effective organization ID for a live request.
 * Priority order: explicit request org → authenticated user org → first org in the installation.
 */
export async function resolveOrganizationId({
  req,
  requestedOrganizationId,
}: ResolveOrganizationOptions = {}): Promise<string | null> {
  const explicitOrganizationId = requestedOrganizationId?.trim();
  if (explicitOrganizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: explicitOrganizationId },
      select: { id: true },
    });
    if (organization) {
      return organization.id;
    }
  }

  const authenticatedOrganizationId = req?.user?.orgId?.trim();
  if (authenticatedOrganizationId) {
    return authenticatedOrganizationId;
  }

  const installationOrganization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return installationOrganization?.id ?? null;
}
