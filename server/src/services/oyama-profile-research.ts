import {
  lookupProPublica,
  lookupSecEdgar,
  type PublicResearchResult,
} from "./public-donor-research.js";

export interface AutomatedProfileSubject {
  id: string;
  entityKind?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  employer?: string | null;
  occupation?: string | null;
}

export interface SavedProfileEvidence {
  id: string;
  provider: string;
  sourceRecordId?: string | null;
  sourceUrl: string;
  signalType: string;
  title: string;
  summary: string;
  status: string;
  matchConfidence: string;
  matchRationale: string;
  sourcePublishedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface ProfileSourceRun {
  provider: "oyama_internal" | "propublica" | "sec_edgar";
  name: string;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  queries: string[];
  resultCount: number;
  message: string;
}

export interface AutomatedDonorProfileRecord {
  id: string;
  constituentId: string;
  generatedAt: string;
  status: "COMPLETE" | "PARTIAL";
  subject: AutomatedProfileSubject;
  sourceRuns: ProfileSourceRun[];
  discoveredEvidence: PublicResearchResult[];
  savedEvidence: SavedProfileEvidence[];
}

function normalized(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

/** Derives provider queries exclusively from the selected CRM constituent. */
export function buildAutomaticProfileQueries(subject: AutomatedProfileSubject, savedEvidence: SavedProfileEvidence[]) {
  const fullName = normalized([subject.firstName, subject.lastName].filter(Boolean).join(" "));
  const nonprofitTerms = [...new Set([
    subject.entityKind === "ORGANIZATION" ? subject.organizationName || subject.displayName : null,
    subject.employer,
    fullName,
  ].map(normalized).filter((value) => value.length >= 2))].slice(0, 3);
  const secCiks = [...new Set(savedEvidence
    .filter((finding) => finding.provider === "sec_edgar")
    .map((finding) => normalized(finding.sourceRecordId))
    .filter((value) => /^\d{1,10}$/.test(value)))];
  return { nonprofitTerms, secCiks };
}

function uniqueResults(results: PublicResearchResult[]): PublicResearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.provider}:${result.sourceRecordId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Searches every currently enabled OYAMA source supported by this constituent. */
export async function researchAutomaticDonorProfile(options: {
  subject: AutomatedProfileSubject;
  savedEvidence: SavedProfileEvidence[];
  secUserAgent?: string | null;
}): Promise<AutomatedDonorProfileRecord> {
  const { subject, savedEvidence } = options;
  const queries = buildAutomaticProfileQueries(subject, savedEvidence);
  const sourceRuns: ProfileSourceRun[] = [{
    provider: "oyama_internal",
    name: "OYAMA Internal Relationship",
    status: "COMPLETED",
    queries: [subject.id],
    resultCount: savedEvidence.length,
    message: `${savedEvidence.length} saved evidence record${savedEvidence.length === 1 ? "" : "s"} loaded from this constituent's existing profile.`,
  }];
  const discovered: PublicResearchResult[] = [];

  if (queries.nonprofitTerms.length) {
    try {
      const batches = await Promise.all(queries.nonprofitTerms.map((query) => lookupProPublica(query)));
      const results = uniqueResults(batches.flat());
      discovered.push(...results);
      sourceRuns.push({ provider: "propublica", name: "OYAMA Foundation Intelligence", status: "COMPLETED", queries: queries.nonprofitTerms, resultCount: results.length, message: "All derived name, employer, and organization queries completed against the approved IRS-linked source." });
    } catch (error) {
      sourceRuns.push({ provider: "propublica", name: "OYAMA Foundation Intelligence", status: "FAILED", queries: queries.nonprofitTerms, resultCount: 0, message: error instanceof Error ? error.message : "The approved foundation source was unavailable." });
    }
  } else {
    sourceRuns.push({ provider: "propublica", name: "OYAMA Foundation Intelligence", status: "SKIPPED", queries: [], resultCount: 0, message: "The constituent has no usable name, employer, or organization identifier." });
  }

  if (!options.secUserAgent?.trim()) {
    sourceRuns.push({ provider: "sec_edgar", name: "OYAMA SEC Intelligence", status: "SKIPPED", queries: queries.secCiks, resultCount: 0, message: "SEC_EDGAR_USER_AGENT is not configured." });
  } else if (!queries.secCiks.length) {
    sourceRuns.push({ provider: "sec_edgar", name: "OYAMA SEC Intelligence", status: "SKIPPED", queries: [], resultCount: 0, message: "No verified or previously discovered CIK is available for this constituent. OYAMA will not guess a filer identity." });
  } else {
    try {
      const batches = await Promise.all(queries.secCiks.map((cik) => lookupSecEdgar(cik, options.secUserAgent?.trim() ?? "")));
      const results = uniqueResults(batches.flat());
      discovered.push(...results);
      sourceRuns.push({ provider: "sec_edgar", name: "OYAMA SEC Intelligence", status: "COMPLETED", queries: queries.secCiks, resultCount: results.length, message: "Every known constituent-linked CIK was refreshed." });
    } catch (error) {
      sourceRuns.push({ provider: "sec_edgar", name: "OYAMA SEC Intelligence", status: "FAILED", queries: queries.secCiks, resultCount: 0, message: error instanceof Error ? error.message : "SEC EDGAR was unavailable." });
    }
  }

  const partial = sourceRuns.some((run) => run.status !== "COMPLETED");
  return {
    id: `oyama-profile:${subject.id}`,
    constituentId: subject.id,
    generatedAt: new Date().toISOString(),
    status: partial ? "PARTIAL" : "COMPLETE",
    subject,
    sourceRuns,
    discoveredEvidence: uniqueResults(discovered),
    savedEvidence,
  };
}

