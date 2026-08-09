/**
 * Normalized adapters for public and licensed donor-research sources.
 *
 * These adapters return disclosed facts or clearly labeled licensed-provider estimates.
 * Oyama does not calculate net worth, propensity, or identity matches, and callers must
 * keep every result reviewable before saving.
 */

export type PublicResearchProvider = "propublica" | "sec_edgar" | "wealthengine";

export interface PublicResearchFact {
  label: string;
  value: string;
}

export interface PublicResearchResult {
  provider: PublicResearchProvider;
  sourceRecordId: string;
  sourceUrl: string;
  signalType: "FOUNDATION_ACTIVITY" | "NONPROFIT_LEADERSHIP" | "CORPORATE_AFFILIATION" | "WEALTH_SCREENING";
  title: string;
  subtitle: string;
  summary: string;
  disclosedAmount: number | null;
  disclosedAmountLabel: string | null;
  sourcePublishedAt: string | null;
  suggestedMatchConfidence: "LOW";
  suggestedMatchRationale: string;
  facts: PublicResearchFact[];
  synthetic?: boolean;
  providerMode?: "sandbox" | "production";
}

export interface WealthEnginePersonInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface WealthEngineConfiguration {
  configured: boolean;
  baseUrl: "https://api.wealthengine.com" | "https://api-sandbox.wealthengine.com";
  mode: "sandbox" | "production";
}

const WEALTHENGINE_PRODUCTION_URL = "https://api.wealthengine.com" as const;
const WEALTHENGINE_SANDBOX_URL = "https://api-sandbox.wealthengine.com" as const;

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

async function fetchJson(
  url: string,
  options: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: JsonRecord; redirect?: "follow" | "error" } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: options.redirect ?? "follow",
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

/** Returns a non-user-controllable WealthEngine endpoint and whether it contains synthetic data. */
export function getWealthEngineConfiguration(): WealthEngineConfiguration {
  const requestedBaseUrl = process.env.WEALTHENGINE_API_BASE_URL?.trim().replace(/\/$/, "");
  const baseUrl = requestedBaseUrl === WEALTHENGINE_PRODUCTION_URL
    ? WEALTHENGINE_PRODUCTION_URL
    : WEALTHENGINE_SANDBOX_URL;
  return {
    configured: Boolean(process.env.WEALTHENGINE_API_KEY?.trim()),
    baseUrl,
    mode: baseUrl === WEALTHENGINE_PRODUCTION_URL ? "production" : "sandbox",
  };
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
    headers: { "User-Agent": userAgent },
  });
  return normalizeSecPayload(payload);
}

function unwrapWealthEngineProfile(payload: unknown): JsonRecord {
  const root = asRecord(payload);
  for (const candidate of [root.profile, root.result, root.data]) {
    if (Array.isArray(candidate)) return asRecord(candidate[0]);
    const record = asRecord(candidate);
    if (Object.keys(record).length) return record;
  }
  return root;
}

function labeledText(record: JsonRecord, key: string): string {
  const value = record[key];
  if (value && typeof value === "object") {
    const nested = asRecord(value);
    return textValue(nested.text || nested.label || nested.display || nested.value);
  }
  return textValue(value);
}

/**
 * Normalizes a licensed WealthEngine response without converting vendor estimates into
 * disclosed assets. The response remains low-confidence until staff confirms identity.
 */
export function normalizeWealthEnginePayload(
  payload: unknown,
  options: { mode?: "sandbox" | "production"; lookupMethod?: "address" | "email" } = {},
): PublicResearchResult[] {
  const profile = unwrapWealthEngineProfile(payload);
  if (!Object.keys(profile).length) return [];

  const identity = asRecord(profile.identity);
  const wealth = asRecord(profile.wealth);
  const giving = asRecord(profile.giving);
  const locations = Array.isArray(profile.locations) ? profile.locations : [];
  const primaryLocation = asRecord(locations[0]);
  const address = asRecord(primaryLocation.address || profile.address);
  const firstName = textValue(identity.first_name || identity.firstName || profile.first_name || profile.firstName);
  const lastName = textValue(identity.last_name || identity.lastName || profile.last_name || profile.lastName);
  const matchedName = [firstName, lastName].filter(Boolean).join(" ") || "Licensed individual profile";
  const city = textValue(address.city);
  const stateRecord = asRecord(address.state);
  const state = textValue(stateRecord.text || stateRecord.code || address.state);
  const location = [city, state].filter(Boolean).join(", ");
  const netWorthBand = labeledText(wealth, "networth") || labeledText(wealth, "net_worth");
  const giftCapacityBand = labeledText(giving, "gift_capacity") || labeledText(giving, "giftCapacity");
  const profileId = textValue(
    identity.we_id
    || identity.weId
    || identity.id
    || profile.we_id
    || profile.id,
  ) || "licensed-profile";
  const mode = options.mode ?? "production";
  const facts: PublicResearchFact[] = [
    { label: "Matched identity", value: matchedName },
    ...(location ? [{ label: "Matched location", value: location }] : []),
    ...(netWorthBand ? [{ label: "Estimated net worth band", value: netWorthBand }] : []),
    ...(giftCapacityBand ? [{ label: "Estimated gift capacity", value: giftCapacityBand }] : []),
    { label: "Provider profile ID", value: profileId },
    { label: "Screening mode", value: mode === "sandbox" ? "Sandbox — synthetic sample" : "Licensed production data" },
    ...(options.lookupMethod ? [{ label: "Match route", value: options.lookupMethod === "address" ? "Name and address" : "Email" }] : []),
  ];
  const estimates = [
    netWorthBand ? `an estimated net-worth band of ${netWorthBand}` : null,
    giftCapacityBand ? `an estimated gift-capacity band of ${giftCapacityBand}` : null,
  ].filter(Boolean).join(" and ");

  return [{
    provider: "wealthengine",
    sourceRecordId: profileId,
    sourceUrl: "https://apidocs.wealthengine.com/documentation.html",
    signalType: "WEALTH_SCREENING",
    title: matchedName,
    subtitle: [location, mode === "sandbox" ? "Synthetic WealthEngine sandbox profile" : "Licensed WealthEngine profile"].filter(Boolean).join(" · "),
    summary: mode === "sandbox"
      ? "WealthEngine returned synthetic sandbox data for workflow testing. This sample is not a real person and cannot be saved as donor research."
      : estimates
        ? `WealthEngine returned ${estimates}. These are licensed vendor estimates, not verified assets, a confirmed identity match, or a recommended ask.`
        : "WealthEngine returned a licensed screening profile without a net-worth or gift-capacity band. Confirm the identity and review the provider record before using any indicator.",
    disclosedAmount: null,
    disclosedAmountLabel: null,
    sourcePublishedAt: null,
    suggestedMatchConfidence: "LOW",
    suggestedMatchRationale: "Licensed screening result only. Confirm the matched name, address or email route, and provider profile before marking this finding verified.",
    facts,
    synthetic: mode === "sandbox",
    providerMode: mode,
  }];
}

/** Screens one CRM individual through a configured licensed WealthEngine account. */
export async function lookupWealthEnginePerson(
  person: WealthEnginePersonInput,
  apiKey: string,
  configuration = getWealthEngineConfiguration(),
): Promise<PublicResearchResult[]> {
  const firstName = person.firstName.trim();
  const lastName = person.lastName.trim();
  if (!firstName || !lastName) throw new Error("The constituent needs a first and last name before individual screening.");

  const hasAddress = Boolean(
    person.addressLine1?.trim()
    && person.city?.trim()
    && person.state?.trim()
    && person.zip?.trim(),
  );
  const lookupMethod = hasAddress ? "address" as const : "email" as const;
  if (!hasAddress && !person.email?.trim()) {
    throw new Error("Add either a complete mailing address or an email address before individual screening.");
  }

  const endpoint = hasAddress
    ? "/v1/profile/find_one/by_address/basic"
    : "/v1/profile/find_one/by_email/basic";
  const body: JsonRecord = hasAddress
    ? {
        first_name: firstName,
        last_name: lastName,
        address_line1: person.addressLine1?.trim(),
        city: person.city?.trim(),
        state: person.state?.trim(),
        zip: person.zip?.trim(),
      }
    : { email: person.email?.trim() };
  const payload = await fetchJson(`${configuration.baseUrl}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `APIKey ${apiKey}` },
    body,
    redirect: "error",
  });
  return normalizeWealthEnginePayload(payload, { mode: configuration.mode, lookupMethod });
}
