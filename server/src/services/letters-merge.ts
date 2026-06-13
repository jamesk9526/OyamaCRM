/**
 * Merge-field utilities for Donor CRM Letters & Printables.
 * Resolves supported placeholders and renders merged letter content safely.
 */

/** Canonical list of merge fields supported by the letters engine. */
export const SUPPORTED_LETTER_MERGE_FIELDS = [
  "{{constituent.firstName}}",
  "{{constituent.lastName}}",
  "{{constituent.fullName}}",
  "{{constituent.preferredName}}",
  "{{constituent.displayName}}",
  "{{constituent.organizationName}}",
  "{{constituent.entityKind}}",
  "{{constituent.organizationCategory}}",
  "{{constituent.contactFirstName}}",
  "{{constituent.contactLastName}}",
  "{{constituent.contactFullName}}",
  "{{constituent.contactTitle}}",
  "{{constituent.email}}",
  "{{constituent.phone}}",
  "{{constituent.addressLine1}}",
  "{{constituent.addressLine2}}",
  "{{constituent.city}}",
  "{{constituent.state}}",
  "{{constituent.zip}}",
  "{{constituent.addressBlock}}",
  "{{constituent.salutation}}",
  "{{donor.firstName}}",
  "{{donor.lastName}}",
  "{{donor.fullName}}",
  "{{donor.preferredName}}",
  "{{donor.displayName}}",
  "{{donor.organizationName}}",
  "{{donor.entityKind}}",
  "{{donor.organizationCategory}}",
  "{{donor.contactFirstName}}",
  "{{donor.contactLastName}}",
  "{{donor.contactFullName}}",
  "{{donor.contactTitle}}",
  "{{donor.email}}",
  "{{donor.phone}}",
  "{{donor.addressLine1}}",
  "{{donor.addressLine2}}",
  "{{donor.city}}",
  "{{donor.state}}",
  "{{donor.zip}}",
  "{{donor.addressBlock}}",
  "{{donor.salutation}}",
  "{{donation.amount}}",
  "{{donation.date}}",
  "{{donation.designation}}",
  "{{donation.campaign}}",
  "{{donation.paymentMethod}}",
  "{{donation.receiptNumber}}",
  "{{donation.taxDeductibleAmount}}",
  "{{gift.amount}}",
  "{{gift.date}}",
  "{{gift.fund}}",
  "{{gift.campaign}}",
  "{{gift.paymentMethod}}",
  "{{gift.receiptNumber}}",
  "{{gift.taxDeductibleAmount}}",
  "{{year}}",
  "{{year.totalGiving}}",
  "{{year.firstGiftDate}}",
  "{{year.lastGiftDate}}",
  "{{year.numberOfGifts}}",
  "{{campaign.name}}",
  "{{event.name}}",
  "{{household.name}}",
  "{{organization.name}}",
  "{{organization.mission}}",
  "{{organization.address}}",
  "{{organization.phone}}",
  "{{organization.email}}",
  "{{organization.website}}",
  "{{organization.taxId}}",
  "{{staff.fullName}}",
  "{{staff.title}}",
  "{{staff.email}}",
] as const;

const SIMPLE_LETTER_MERGE_FIELD_ALIASES: Readonly<Record<string, string>> = {
  first: "donor.firstName",
  firstname: "donor.firstName",
  firstName: "donor.firstName",
  last: "donor.lastName",
  lastname: "donor.lastName",
  lastName: "donor.lastName",
  name: "donor.fullName",
  full: "donor.fullName",
  fullName: "donor.fullName",
  preferred: "donor.preferredName",
  preferredName: "donor.preferredName",
  salutation: "donor.salutation",
  email: "donor.email",
  phone: "donor.phone",
  address: "donor.addressBlock",
  address1: "donor.addressLine1",
  address2: "donor.addressLine2",
  city: "donor.city",
  state: "donor.state",
  zip: "donor.zip",
  amount: "gift.amount",
  giftAmount: "gift.amount",
  donationAmount: "gift.amount",
  giftDate: "gift.date",
  donationDate: "gift.date",
  date: "gift.date",
  fund: "gift.fund",
  designation: "gift.fund",
  campaign: "gift.campaign",
  receipt: "gift.receiptNumber",
  receiptNumber: "gift.receiptNumber",
  deductible: "gift.taxDeductibleAmount",
  taxDeductible: "gift.taxDeductibleAmount",
  year: "year",
  totalGiving: "year.totalGiving",
  yearTotal: "year.totalGiving",
  firstGiftDate: "year.firstGiftDate",
  lastGiftDate: "year.lastGiftDate",
  giftCount: "year.numberOfGifts",
  org: "organization.name",
  orgName: "organization.name",
  organization: "organization.name",
  organizationName: "organization.name",
  mission: "organization.mission",
  staff: "staff.fullName",
  staffName: "staff.fullName",
  signer: "staff.fullName",
  staffTitle: "staff.title",
  signerTitle: "staff.title",
  staffEmail: "staff.email",
};

export const SIMPLE_LETTER_MERGE_FIELDS = [
  "{first}",
  "{last}",
  "{name}",
  "{preferred}",
  "{email}",
  "{phone}",
  "{address}",
  "{amount}",
  "{giftDate}",
  "{fund}",
  "{campaign}",
  "{receipt}",
  "{year}",
  "{totalGiving}",
  "{orgName}",
  "{staffName}",
  "//first",
  "//last",
  "//name",
  "//amount",
  "//giftDate",
] as const;

/**
 * Legacy aliases kept for backward compatibility with older templates.
 * These aliases are normalized to canonical merge keys at render/validation time.
 */
const LEGACY_LETTER_MERGE_FIELD_ALIASES: Readonly<Record<string, string>> = {
  "constituent.firstName": "donor.firstName",
  "constituent.lastName": "donor.lastName",
  "constituent.fullName": "donor.fullName",
  "constituent.preferredName": "donor.preferredName",
  "constituent.email": "donor.email",
  "constituent.phone": "donor.phone",
  "constituent.addressLine1": "donor.addressLine1",
  "constituent.addressLine2": "donor.addressLine2",
  "constituent.city": "donor.city",
  "constituent.state": "donor.state",
  "constituent.zip": "donor.zip",
  "constituent.addressBlock": "donor.addressBlock",
  "constituent.salutation": "donor.salutation",
  "donation.amount": "gift.amount",
  "donation.date": "gift.date",
  "donation.designation": "gift.fund",
  "donation.campaign": "gift.campaign",
  "donation.paymentMethod": "gift.paymentMethod",
  "donation.receiptNumber": "gift.receiptNumber",
  "donation.taxDeductibleAmount": "gift.taxDeductibleAmount",
  "gift.designation": "gift.fund",
  "organization.signerName": "staff.fullName",
  "organization.signerTitle": "staff.title",
};

const FIELD_SET = new Set<string>(SUPPORTED_LETTER_MERGE_FIELDS.map((field) => field.slice(2, -2).trim()));
const FIELD_PATTERN = /{{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([^}]+?))?\s*}}/g;
const SIMPLE_BRACE_FIELD_PATTERN = /(^|[^{]){\s*([a-zA-Z][a-zA-Z0-9]*)(?:\s*\|\s*([^}]+?))?\s*}/g;
const SLASH_FIELD_PATTERN = /(^|[\s([>])\/\/([a-zA-Z][a-zA-Z0-9]*)(?![\w/])/g;

function canonicalizeMergeFieldKey(key: string): string {
  const normalized = key.trim();
  return SIMPLE_LETTER_MERGE_FIELD_ALIASES[normalized]
    ?? LEGACY_LETTER_MERGE_FIELD_ALIASES[normalized]
    ?? normalized;
}

function formatDateValue(value: string, format: string): string {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  if (format === "MM/dd/yyyy") {
    return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(parsed);
  }
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(parsed);
}

function formatCurrencyValue(value: string): string {
  if (!value.trim()) return "";
  const numeric = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function parseFilters(rawFilters: string | undefined): string[] {
  if (!rawFilters) return [];
  return rawFilters
    .split("|")
    .map((filter) => filter.trim())
    .filter(Boolean);
}

function readFallbackFilter(filter: string): string | null {
  const match = filter.match(/^fallback\s*:\s*"([^"]*)"$/i) ?? filter.match(/^fallback\s*:\s*'([^']*)'$/i);
  return match?.[1] ?? null;
}

function applyMergeFilters(value: string, filters: string[]): string {
  let output = value;
  for (const filter of filters) {
    const fallback = readFallbackFilter(filter);
    if (fallback !== null) {
      if (!output.trim()) output = fallback;
      continue;
    }
    if (/^currency$/i.test(filter)) {
      output = formatCurrencyValue(output);
      continue;
    }
    const dateMatch = filter.match(/^date\s*:\s*"([^"]+)"$/i) ?? filter.match(/^date\s*:\s*'([^']+)'$/i);
    if (dateMatch) output = formatDateValue(output, dateMatch[1] ?? "");
  }
  return output;
}

/** Returns all merge field keys referenced in one or more text blocks. */
export function collectMergeFieldKeys(...blocks: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const block of blocks) {
    if (!block) continue;
    let match: RegExpExecArray | null = FIELD_PATTERN.exec(block);
    while (match) {
      keys.add(canonicalizeMergeFieldKey(match[1] ?? ""));
      match = FIELD_PATTERN.exec(block);
    }
    FIELD_PATTERN.lastIndex = 0;
    match = SIMPLE_BRACE_FIELD_PATTERN.exec(block);
    while (match) {
      keys.add(canonicalizeMergeFieldKey(match[2] ?? ""));
      match = SIMPLE_BRACE_FIELD_PATTERN.exec(block);
    }
    SIMPLE_BRACE_FIELD_PATTERN.lastIndex = 0;
    match = SLASH_FIELD_PATTERN.exec(block);
    while (match) {
      keys.add(canonicalizeMergeFieldKey(match[2] ?? ""));
      match = SLASH_FIELD_PATTERN.exec(block);
    }
    SLASH_FIELD_PATTERN.lastIndex = 0;
  }
  return Array.from(keys).sort();
}

/** Returns unsupported merge fields so the UI can show validation warnings. */
export function unsupportedMergeFieldKeys(keys: string[]): string[] {
  return keys.filter((key) => !FIELD_SET.has(canonicalizeMergeFieldKey(key)));
}

export interface RenderMergeFieldsOptions {
  missingMode?: "blank" | "highlight";
  missingFields?: Set<string>;
}

/** Replaces all supported placeholders while leaving unsupported tokens untouched.
 * Missing supported fields are always rendered as blank, while missingFields collects warnings.
 */
export function renderMergeFields(template: string, values: Record<string, string>, options: RenderMergeFieldsOptions = {}): string {
  const renderToken = (displayKey: string, rawFilters: string | undefined, original: string): string => {
    const normalized = String(displayKey ?? "").trim();
    const canonical = canonicalizeMergeFieldKey(normalized);
    if (!FIELD_SET.has(canonical)) return original;
    const filtered = applyMergeFilters(values[canonical] ?? "", parseFilters(rawFilters));
    if (!filtered.trim()) {
      options.missingFields?.add(canonical);
      return "";
    }
    return filtered;
  };

  return template
    .replace(FIELD_PATTERN, (full: string, key: string, rawFilters: string | undefined) => {
      const normalized = String(key ?? "").trim();
      return renderToken(normalized, rawFilters, `{{${normalized}}}`);
    })
    .replace(SIMPLE_BRACE_FIELD_PATTERN, (full: string, prefix: string, key: string, rawFilters: string | undefined) => (
      `${prefix}${renderToken(key, rawFilters, full.slice(prefix.length))}`
    ))
    .replace(SLASH_FIELD_PATTERN, (full: string, prefix: string, key: string) => (
      `${prefix}${renderToken(key, undefined, `//${key}`)}`
    ));
}
