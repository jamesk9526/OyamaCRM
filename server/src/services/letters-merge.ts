/**
 * Merge-field utilities for Donor CRM Letters & Printables.
 * Resolves supported placeholders and renders merged letter content safely.
 */

/** Canonical list of merge fields supported by the letters engine. */
export const SUPPORTED_LETTER_MERGE_FIELDS = [
  "{{donor.firstName}}",
  "{{donor.lastName}}",
  "{{donor.fullName}}",
  "{{donor.preferredName}}",
  "{{donor.email}}",
  "{{donor.phone}}",
  "{{donor.addressLine1}}",
  "{{donor.addressLine2}}",
  "{{donor.city}}",
  "{{donor.state}}",
  "{{donor.zip}}",
  "{{donor.salutation}}",
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
  "{{organization.name}}",
  "{{organization.address}}",
  "{{organization.phone}}",
  "{{organization.email}}",
  "{{organization.website}}",
  "{{organization.taxId}}",
  "{{staff.fullName}}",
  "{{staff.title}}",
  "{{staff.email}}",
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
const FIELD_PATTERN = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;

function canonicalizeMergeFieldKey(key: string): string {
  const normalized = key.trim();
  return LEGACY_LETTER_MERGE_FIELD_ALIASES[normalized] ?? normalized;
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
  }
  return Array.from(keys).sort();
}

/** Returns unsupported merge fields so the UI can show validation warnings. */
export function unsupportedMergeFieldKeys(keys: string[]): string[] {
  return keys.filter((key) => !FIELD_SET.has(canonicalizeMergeFieldKey(key)));
}

/** Replaces all supported placeholders while leaving unsupported tokens untouched. */
export function renderMergeFields(template: string, values: Record<string, string>): string {
  return template.replace(FIELD_PATTERN, (_full, key: string) => {
    const normalized = String(key ?? "").trim();
    const canonical = canonicalizeMergeFieldKey(normalized);
    if (!FIELD_SET.has(canonical)) {
      return `{{${normalized}}}`;
    }
    return values[canonical] ?? "";
  });
}
