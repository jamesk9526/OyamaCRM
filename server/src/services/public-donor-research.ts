/**
 * Normalized adapters for public donor-research sources.
 *
 * These adapters return disclosed source facts only. They do not calculate net worth,
 * propensity, or identity matches, and callers must keep results reviewable before saving.
 */

export type PublicResearchProvider = "propublica" | "sec_edgar";

export interface PublicResearchFact {
  label: string;
  value: string;
}

export interface PublicResearchResult {
  provider: PublicResearchProvider;
  sourceRecordId: string;
  sourceUrl: string;
  signalType: "FOUNDATION_ACTIVITY" | "NONPROFIT_LEADERSHIP" | "CORPORATE_AFFILIATION";
  title: string;
  subtitle: string;
  summary: string;
  disclosedAmount: number | null;
  disclosedAmountLabel: string | null;
  sourcePublishedAt: string | null;
  suggestedMatchConfidence: "LOW";
  suggestedMatchRationale: string;
  facts: PublicResearchFact[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(textValue(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dateValue(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Public source returned HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The public source timed out. Try again in a moment.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Normalizes a ProPublica Nonprofit Explorer v2 search response. */
export function normalizeProPublicaPayload(payload: unknown): PublicResearchResult[] {
  const root = asRecord(payload);
  const organizations = Array.isArray(root.organizations) ? root.organizations : [];

  return organizations.slice(0, 12).map((rawOrganization) => {
    const organization = asRecord(rawOrganization);
    const latestFiling = asRecord(
      organization.latest_object
      ?? organization.latest_filing
      ?? (Array.isArray(organization.filings_with_data) ? organization.filings_with_data[0] : null),
    );
    const einRaw = textValue(organization.ein || latestFiling.ein).replace(/\D/g, "");
    const ein = einRaw.padStart(9, "0").slice(-9);
    const title = textValue(organization.name) || "Unnamed nonprofit organization";
    const city = textValue(organization.city);
    const state = textValue(organization.state);
    const filingYear = textValue(latestFiling.tax_prd_yr || latestFiling.tax_period || organization.tax_period);
    const assets = numberValue(
      latestFiling.totassetsend,
      latestFiling.total_assets,
      organization.total_assets,
      organization.asset_amount,
    );
    const revenue = numberValue(
      latestFiling.totrevenue,
      latestFiling.total_revenue,
      organization.total_revenue,
      organization.income_amount,
    );
    const nteeCode = textValue(organization.ntee_code);
    const formType = textValue(latestFiling.formtype || latestFiling.form_type);
    const facts: PublicResearchFact[] = [
      ...(ein ? [{ label: "EIN", value: ein }] : []),
      ...(city || state ? [{ label: "Location", value: [city, state].filter(Boolean).join(", ") }] : []),
      ...(assets != null ? [{ label: "Reported total assets", value: money(assets) }] : []),
      ...(revenue != null ? [{ label: "Reported revenue", value: money(revenue) }] : []),
      ...(filingYear ? [{ label: "Tax period", value: filingYear }] : []),
      ...(formType ? [{ label: "Form", value: formType }] : []),
      ...(nteeCode ? [{ label: "NTEE code", value: nteeCode }] : []),
    ];
    const disclosed = [
      assets != null ? `${money(assets)} in reported total assets` : null,
      revenue != null ? `${money(revenue)} in reported revenue` : null,
    ].filter(Boolean).join(" and ");

    return {
      provider: "propublica" as const,
      sourceRecordId: ein,
      sourceUrl: `https://projects.propublica.org/nonprofits/organizations/${encodeURIComponent(ein)}`,
      signalType: "FOUNDATION_ACTIVITY" as const,
      title,
      subtitle: [city, state, ein ? `EIN ${ein}` : null].filter(Boolean).join(" · "),
      summary: disclosed
        ? `Nonprofit Explorer reports ${disclosed}${filingYear ? ` for tax period ${filingYear}` : ""}.`
        : "Nonprofit Explorer returned a public IRS-linked organization record; no current asset or revenue amount was included in this search response.",
      disclosedAmount: assets,
      disclosedAmountLabel: assets != null ? "Reported nonprofit total assets" : null,
      sourcePublishedAt: dateValue(latestFiling.updated_at || latestFiling.filing_date),
      suggestedMatchConfidence: "LOW" as const,
      suggestedMatchRationale: "Name-search result only. Confirm the EIN, location, and the constituent's documented relationship before verification.",
      facts,
    };
  }).filter((result) => Boolean(result.sourceRecordId));
}

/** Normalizes one SEC submissions response for an explicitly supplied CIK. */
export function normalizeSecPayload(payload: unknown): PublicResearchResult[] {
  const entity = asRecord(payload);
  const cikRaw = textValue(entity.cik).replace(/\D/g, "");
  if (!cikRaw) return [];
  const cik = cikRaw.padStart(10, "0").slice(-10);
  const name = textValue(entity.name) || `SEC filer ${cik}`;
  const tickers = Array.isArray(entity.tickers) ? entity.tickers.map(textValue).filter(Boolean) : [];
  const exchanges = Array.isArray(entity.exchanges) ? entity.exchanges.map(textValue).filter(Boolean) : [];
  const filings = asRecord(entity.filings);
  const recent = asRecord(filings.recent);
  const forms = Array.isArray(recent.form) ? recent.form.map(textValue) : [];
  const filingDates = Array.isArray(recent.filingDate) ? recent.filingDate.map(textValue) : [];
  const latestForm = forms[0] || "";
  const latestFilingDate = filingDates[0] || "";
  const sicDescription = textValue(entity.sicDescription);
  const facts: PublicResearchFact[] = [
    { label: "CIK", value: cik },
    ...(tickers.length ? [{ label: "Ticker", value: tickers.slice(0, 4).join(", ") }] : []),
    ...(exchanges.length ? [{ label: "Exchange", value: exchanges.slice(0, 4).join(", ") }] : []),
    ...(sicDescription ? [{ label: "Industry", value: sicDescription }] : []),
    ...(latestForm ? [{ label: "Latest filing form", value: latestForm }] : []),
    ...(latestFilingDate ? [{ label: "Latest filing date", value: latestFilingDate }] : []),
  ];

  return [{
    provider: "sec_edgar",
    sourceRecordId: cik,
    sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}&owner=exclude`,
    signalType: "CORPORATE_AFFILIATION",
    title: name,
    subtitle: [tickers.join(", "), sicDescription, `CIK ${cik}`].filter(Boolean).join(" · "),
    summary: `SEC EDGAR identifies ${name} as filer CIK ${cik}${latestForm ? `; the latest listed filing is ${latestForm}${latestFilingDate ? ` dated ${latestFilingDate}` : ""}` : ""}. This entity record does not by itself prove a constituent relationship or personal wealth.`,
    disclosedAmount: null,
    disclosedAmountLabel: null,
    sourcePublishedAt: dateValue(latestFilingDate),
    suggestedMatchConfidence: "LOW",
    suggestedMatchRationale: "CIK lookup identifies a filing entity only. Verify the constituent's role using the underlying SEC filing before marking this finding verified.",
    facts,
  }];
}

/** Searches ProPublica Nonprofit Explorer by foundation/nonprofit name. */
export async function lookupProPublica(query: string): Promise<PublicResearchResult[]> {
  const payload = await fetchJson(`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(query)}`);
  return normalizeProPublicaPayload(payload);
}

/** Looks up SEC submissions for an explicitly supplied CIK. */
export async function lookupSecEdgar(cikInput: string, userAgent: string): Promise<PublicResearchResult[]> {
  const digits = cikInput.replace(/\D/g, "");
  if (!digits || digits.length > 10) throw new Error("Enter a valid SEC CIK containing 1 to 10 digits.");
  const cik = digits.padStart(10, "0");
  const payload = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    "User-Agent": userAgent,
  });
  return normalizeSecPayload(payload);
}
