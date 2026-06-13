import { prisma } from "./prisma.js";
import { prismaModelExists } from "./prisma-model-fields.js";

export const CONSTITUENT_GROUP_TYPES = ["CHURCH", "BUSINESS", "ORGANIZATION"] as const;

export type ConstituentGroupType = (typeof CONSTITUENT_GROUP_TYPES)[number];

export type ConstituentGroupMembershipInput = {
  groupId: string;
  relationshipLabel?: string;
  isPrimary?: boolean;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeConstituentGroupType(value: unknown): ConstituentGroupType {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CHURCH" || normalized === "BUSINESS") return normalized;
  return "ORGANIZATION";
}

export function normalizeRelationshipLabel(value: unknown): string | null {
  const normalized = clean(typeof value === "string" ? value : "");
  return normalized ? normalized.slice(0, 80) : null;
}

export function normalizeMembershipInputs(value: unknown): ConstituentGroupMembershipInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const memberships: ConstituentGroupMembershipInput[] = [];
  for (const entry of value) {
    const source = (entry ?? {}) as Record<string, unknown>;
    const groupId = clean(String(source.groupId ?? ""));
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    memberships.push({
      groupId,
      relationshipLabel: normalizeRelationshipLabel(source.relationshipLabel) ?? undefined,
      isPrimary: source.isPrimary === true,
    });
  }
  return memberships;
}

export async function syncConstituentGroupMemberships(params: {
  organizationId: string;
  constituentId: string;
  memberships: ConstituentGroupMembershipInput[];
}): Promise<void> {
  const { organizationId, constituentId, memberships } = params;
  if (!prismaModelExists("ConstituentGroup") || !prismaModelExists("ConstituentGroupMember")) {
    console.warn("[constituent-groups] Skipping group membership sync because Prisma runtime metadata is missing group models.", {
      organizationId,
      constituentId,
      requestedMembershipCount: memberships.length,
    });
    return;
  }

  const groupDelegate = prisma.constituentGroup;
  const memberDelegate = prisma.constituentGroupMember;
  if (!groupDelegate || !memberDelegate) {
    console.warn("[constituent-groups] Skipping group membership sync because Prisma client delegates are unavailable.", {
      organizationId,
      constituentId,
      requestedMembershipCount: memberships.length,
      hasConstituentGroupDelegate: Boolean(groupDelegate),
      hasConstituentGroupMemberDelegate: Boolean(memberDelegate),
    });
    return;
  }

  const requestedGroupIds = memberships.map((membership) => membership.groupId);

  const validGroups = requestedGroupIds.length > 0
    ? await groupDelegate.findMany({
        where: {
          id: { in: requestedGroupIds },
          organizationId,
        },
        select: { id: true },
      })
    : [];

  const validGroupIds = new Set(validGroups.map((group) => group.id));
  const sanitizedMemberships = memberships.filter((membership) => validGroupIds.has(membership.groupId));

  await memberDelegate.deleteMany({
    where: {
      constituentId,
      ...(sanitizedMemberships.length > 0
        ? { groupId: { notIn: sanitizedMemberships.map((membership) => membership.groupId) } }
        : {}),
    },
  });

  for (const membership of sanitizedMemberships) {
    await memberDelegate.upsert({
      where: {
        groupId_constituentId: {
          groupId: membership.groupId,
          constituentId,
        },
      },
      update: {
        relationshipLabel: normalizeRelationshipLabel(membership.relationshipLabel),
        isPrimary: membership.isPrimary === true,
      },
      create: {
        groupId: membership.groupId,
        constituentId,
        relationshipLabel: normalizeRelationshipLabel(membership.relationshipLabel),
        isPrimary: membership.isPrimary === true,
      },
    });
  }
}

export async function ensureConstituentGroup(params: {
  organizationId: string;
  name: string;
  groupType: ConstituentGroupType;
  primaryConstituentId?: string | null;
  description?: string | null;
}) {
  const name = clean(params.name);
  if (!name) return null;
  if (!prismaModelExists("ConstituentGroup") || !prisma.constituentGroup) {
    console.warn("[constituent-groups] Cannot ensure constituent group because Prisma runtime metadata or delegate is missing.", {
      organizationId: params.organizationId,
      name,
      groupType: params.groupType,
    });
    return null;
  }

  const existing = await prisma.constituentGroup.findFirst({
    where: {
      organizationId: params.organizationId,
      name,
      groupType: params.groupType,
    },
    select: {
      id: true,
      primaryConstituentId: true,
    },
  });

  if (existing) {
    return prisma.constituentGroup.update({
      where: { id: existing.id },
      data: {
        primaryConstituentId: params.primaryConstituentId ?? existing.primaryConstituentId ?? null,
        description: params.description ?? undefined,
      },
    });
  }

  return prisma.constituentGroup.create({
    data: {
      organizationId: params.organizationId,
      name,
      groupType: params.groupType,
      primaryConstituentId: params.primaryConstituentId ?? null,
      description: params.description ?? null,
    },
  });
}
