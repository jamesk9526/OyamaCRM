export interface AudienceListMemberReference {
  constituentId?: string | null;
  email?: string | null;
}

export interface AudienceMatchConstituent {
  id: string;
  email?: string | null;
}

/** Resolve saved-list members to current CRM contacts without requiring an email address. */
export function resolveAudienceListConstituents(
  constituents: AudienceMatchConstituent[],
  members: AudienceListMemberReference[],
): { constituentIds: string[]; unmatchedMemberCount: number } {
  const constituentIds = new Set(constituents.map((row) => row.id));
  const constituentIdsByEmail = new Map<string, string[]>();

  for (const row of constituents) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    constituentIdsByEmail.set(email, [...(constituentIdsByEmail.get(email) ?? []), row.id]);
  }

  const matchedIds = new Set<string>();
  let unmatchedMemberCount = 0;

  for (const member of members) {
    const constituentId = typeof member.constituentId === "string" ? member.constituentId.trim() : "";
    if (constituentId && constituentIds.has(constituentId)) {
      matchedIds.add(constituentId);
      continue;
    }

    const emailMatches = constituentIdsByEmail.get(normalizeEmail(member.email)) ?? [];
    if (emailMatches.length === 0) {
      unmatchedMemberCount += 1;
      continue;
    }
    emailMatches.forEach((id) => matchedIds.add(id));
  }

  return { constituentIds: Array.from(matchedIds), unmatchedMemberCount };
}

function normalizeEmail(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
