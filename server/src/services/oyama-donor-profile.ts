/** First-party OYAMADonorPROFILE contracts, policies, and identity resolution. */

export const OYAMA_DONOR_PROFILE_PRODUCT = "OYAMADonorPROFILE" as const;
export const FEC_PROSPECT_ENRICHMENT_ENABLED = false as const;

export type DonorProfileCapability =
  | "IDENTITY"
  | "PROPERTY"
  | "BUSINESS"
  | "SECURITIES"
  | "FOUNDATION"
  | "PHILANTHROPY"
  | "GEOGRAPHY"
  | "PROFESSIONAL"
  | "INTERNAL_RELATIONSHIP";

export interface DonorProfileQuery {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  zip?: string | null;
  email?: string | null;
  employer?: string | null;
  occupation?: string | null;
  spouseName?: string | null;
  knownOrganization?: string | null;
}

export interface DonorProfileEvidenceCandidate extends DonorProfileQuery {
  mailingAddress?: string | null;
  businessAddress?: string | null;
  foundationAssociation?: string | null;
}

export interface DonorProfileSourceDefinition {
  id: string;
  name: string;
  sourceType: string;
  capabilities: DonorProfileCapability[];
  enabled: boolean;
  allowedUse: string;
  automationAllowed: boolean;
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  termsReviewedAt: string | null;
}

export interface DonorProfileProvider<TRaw = unknown> {
  source: DonorProfileSourceDefinition;
  supports(query: DonorProfileQuery): boolean;
  search(query: DonorProfileQuery): Promise<TRaw>;
  normalize(response: TRaw): unknown[];
}

export interface IdentityMatchSignal {
  key: string;
  label: string;
  points: number;
}

export interface IdentityMatchResult {
  score: number;
  band: "NEAR_CERTAIN" | "VERY_HIGH" | "LIKELY" | "POSSIBLE" | "UNVERIFIED";
  label: string;
  mergeEligible: boolean;
  reviewRequired: boolean;
  signals: IdentityMatchSignal[];
}

export const OYAMA_DONOR_PROFILE_POLICY = {
  purpose: "Nonprofit fundraising research and relationship management only.",
  prohibitedEligibilityUses: ["employment", "tenant screening", "credit", "lending", "insurance", "government benefits"],
  prohibitedSensitiveData: [
    "medical conditions", "disabilities", "religion", "race", "ethnicity", "sexual orientation",
    "criminal accusations", "children or minors", "private communications", "bank accounts",
    "credit scores", "Social Security numbers", "private tax returns", "private financial credentials",
  ],
  identityAutoMergeMinimum: 70,
  fecProspectEnrichmentEnabled: FEC_PROSPECT_ENRICHMENT_ENABLED,
} as const;

function normalized(value: string | null | undefined): string {
  return value?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase() ?? "";
}

function compact(value: string | null | undefined): string {
  return normalized(value)
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/\broute\b/g, "rte")
    .replace(/\s+/g, "");
}

function same(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalized(left);
  const b = normalized(right);
  return Boolean(a && b && a === b);
}

function add(signals: IdentityMatchSignal[], key: string, label: string, points: number, matched: boolean): void {
  if (matched) signals.push({ key, label, points });
}

/** Scores evidence identity deterministically. A score below 70 may never auto-merge. */
export function resolveDonorProfileIdentity(subject: DonorProfileQuery, candidate: DonorProfileEvidenceCandidate): IdentityMatchResult {
  const signals: IdentityMatchSignal[] = [];
  const subjectFullName = [subject.firstName, subject.middleName, subject.lastName, subject.suffix].filter(Boolean).join(" ");
  const candidateFullName = [candidate.firstName, candidate.middleName, candidate.lastName, candidate.suffix].filter(Boolean).join(" ");
  const exactFullName = same(subjectFullName, candidateFullName);

  add(signals, "exact_full_name", "Exact full name", 25, exactFullName);
  add(signals, "first_last", "First and last name", 18, !exactFullName && same(subject.firstName, candidate.firstName) && same(subject.lastName, candidate.lastName));
  add(signals, "middle", "Middle name or initial", 5, Boolean(normalized(subject.middleName) && normalized(candidate.middleName) && normalized(subject.middleName)[0] === normalized(candidate.middleName)[0]));
  add(signals, "suffix", "Suffix", 4, same(subject.suffix, candidate.suffix));
  add(signals, "street", "Exact street address", 30, compact(subject.addressLine1) !== "" && compact(subject.addressLine1) === compact(candidate.addressLine1));
  add(signals, "zip", "ZIP", 15, same(subject.zip, candidate.zip));
  add(signals, "city", "City", 10, same(subject.city, candidate.city));
  add(signals, "county", "County", 5, same(subject.county, candidate.county));
  add(signals, "state", "State", 3, same(subject.state, candidate.state));
  add(signals, "employer", "Employer", 15, same(subject.employer, candidate.employer));
  add(signals, "occupation", "Occupation", 5, same(subject.occupation, candidate.occupation));
  add(signals, "spouse", "Known spouse or household", 10, same(subject.spouseName, candidate.spouseName));
  add(signals, "organization", "Known organization", 10, same(subject.knownOrganization, candidate.knownOrganization));
  add(signals, "mailing_address", "Same mailing address", 20, compact(subject.addressLine1) !== "" && compact(subject.addressLine1) === compact(candidate.mailingAddress));

  const score = Math.min(100, signals.reduce((total, signal) => total + signal.points, 0));
  const band = score >= 95 ? "NEAR_CERTAIN" : score >= 85 ? "VERY_HIGH" : score >= 70 ? "LIKELY" : score >= 55 ? "POSSIBLE" : "UNVERIFIED";
  const label = band === "NEAR_CERTAIN" ? "Near-certain" : band === "VERY_HIGH" ? "Very high confidence" : band === "LIKELY" ? "Likely" : band === "POSSIBLE" ? "Possible match — review required" : "Unverified";
  return { score, band, label, mergeEligible: score >= OYAMA_DONOR_PROFILE_POLICY.identityAutoMergeMinimum, reviewRequired: score < 85, signals };
}

/** Rejects providers that have not passed source-use and automation review. */
export function isDonorProfileProviderOperational(source: DonorProfileSourceDefinition): boolean {
  return source.enabled && source.automationAllowed && Boolean(source.allowedUse.trim()) && Boolean(source.termsReviewedAt);
}

