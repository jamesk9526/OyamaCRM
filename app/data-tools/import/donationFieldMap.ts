// Donation-specific field mapping definitions for the CSV import wizard.
// Covers all importable Donation model fields plus constituent-matching columns.
// Keep in sync with: docs/status/import-tools.md and the Donation Prisma schema.

/**
 * A single importable donation field definition.
 * @property key      - Internal field name (used as key in MappedRow objects)
 * @property label    - Human-readable label shown in the mapping UI
 * @property required - Whether this field must be mapped before import can proceed
 * @property group    - Display group for the optgroup select
 */
export interface DonationField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly group: string;
  readonly hint?: string;
}

/**
 * CRM_DONATION_FIELDS: every donation field that CSV data can be mapped to.
 * Add new fields here whenever the Donation model gains a new importable field.
 */
export const CRM_DONATION_FIELDS: readonly DonationField[] = [
  // -- Required donation data --
  { key: "amount",                label: "Gift Amount",                  required: true,  group: "Donation",     hint: "Dollar amount of the gift (e.g. 150.00)" },
  { key: "date",                  label: "Gift Date",                    required: true,  group: "Donation",     hint: "Date the gift was received (MM/DD/YYYY or YYYY-MM-DD)" },
  // -- Payment details --
  { key: "paymentMethod",         label: "Payment Method",               required: false, group: "Donation",     hint: "Check, Credit Card, ACH, Wire, Cash, Stock, In-Kind, Online" },
  { key: "checkNumber",           label: "Check Number",                 required: false, group: "Donation" },
  { key: "transactionId",         label: "Transaction / Reference ID",   required: false, group: "Donation" },
  { key: "receiptNumber",         label: "Receipt Number (dedup key)",   required: false, group: "Donation",     hint: "Used to prevent duplicate imports if present" },
  { key: "feeAmount",             label: "Processing Fee",               required: false, group: "Donation" },
  { key: "status",                label: "Gift Status",                  required: false, group: "Donation",     hint: "Completed, Pending, Failed, Refunded — defaults to Completed" },
  { key: "taxDeductible",         label: "Tax Deductible",               required: false, group: "Donation",     hint: "true/false — defaults to true" },
  { key: "isRecurring",           label: "Is Recurring Gift",            required: false, group: "Donation" },
  { key: "frequency",             label: "Recurring Frequency",          required: false, group: "Donation",     hint: "Monthly, Quarterly, Annually, Weekly" },
  // -- Campaign / Designation --
  { key: "campaignName",          label: "Campaign Name",                required: false, group: "Campaign",     hint: "Matched to existing campaigns by name; creates new if not found" },
  { key: "designationName",       label: "Designation / Fund",           required: false, group: "Campaign",     hint: "Matched to existing designations by name; creates new if not found" },
  // -- Notes / In-Kind --
  { key: "notes",                 label: "Gift Notes / Comments",        required: false, group: "Notes" },
  { key: "inKindDescription",     label: "In-Kind Description",          required: false, group: "Notes",        hint: "For non-cash in-kind gift descriptions" },
  // -- Constituent matching (used to link donations to existing CRM records) --
  { key: "constituentEmail",      label: "Donor Email (for matching)",   required: false, group: "Constituent",  hint: "Best match method — links to existing constituent by email" },
  { key: "constituentExternalId", label: "Donor External ID (DirID)",    required: false, group: "Constituent",  hint: "Source system ID for exact matching" },
  { key: "constituentFirstName",  label: "Donor First Name",             required: false, group: "Constituent",  hint: "Used with Last Name for name-based matching fallback" },
  { key: "constituentLastName",   label: "Donor Last Name",              required: false, group: "Constituent" },
  { key: "constituentName",       label: "Donor Full Name",              required: false, group: "Constituent",  hint: "Split into first/last for name-based matching fallback" },
  // -- Skip (always available) --
  { key: "skip",                  label: "— Do Not Import —",            required: false, group: "Skip" },
];

/**
 * DONATION_FIELD_GROUPS: CRM_DONATION_FIELDS organized by group (excludes "Skip").
 * Used to populate optgroup elements in the destination field dropdown.
 */
export const DONATION_FIELD_GROUPS: Record<string, DonationField[]> = (() => {
  const groups: Record<string, DonationField[]> = {};
  for (const f of CRM_DONATION_FIELDS) {
    if (f.group === "Skip") continue;
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  }
  return groups;
})();

/**
 * DONATION_AUTO_MAP_ALIASES: maps CSV column header names (lowercased + trimmed) to donation field keys.
 * Covers Bloomerang, NeonCRM, eKYROS, and generic gift export column names.
 */
export const DONATION_AUTO_MAP_ALIASES: Record<string, string> = {
  // ─── Generic gift columns ───────────────────────────────────────────
  "amount":                 "amount",
  "gift amount":            "amount",
  "donation amount":        "amount",
  "payment amount":         "amount",
  "total":                  "amount",
  "gift total":             "amount",
  "contribution amount":    "amount",

  "date":                   "date",
  "gift date":              "date",
  "donation date":          "date",
  "payment date":           "date",
  "transaction date":       "date",
  "received date":          "date",
  "received":               "date",
  "post date":              "date",

  "payment method":         "paymentMethod",
  "pay method":             "paymentMethod",
  "payment type":           "paymentMethod",
  "type":                   "paymentMethod",
  "method":                 "paymentMethod",
  "gift type":              "paymentMethod",

  "check number":           "checkNumber",
  "check #":                "checkNumber",
  "check no":               "checkNumber",
  "check num":              "checkNumber",
  "cheque number":          "checkNumber",

  "transaction id":         "transactionId",
  "transaction #":          "transactionId",
  "transaction number":     "transactionId",
  "reference number":       "transactionId",
  "reference id":           "transactionId",
  "ref #":                  "transactionId",
  "ref id":                 "transactionId",

  "receipt number":         "receiptNumber",
  "receipt #":              "receiptNumber",
  "receipt no":             "receiptNumber",
  "receipt id":             "receiptNumber",
  "gift id":                "receiptNumber",

  "fee":                    "feeAmount",
  "fee amount":             "feeAmount",
  "processing fee":         "feeAmount",
  "platform fee":           "feeAmount",

  "status":                 "status",
  "gift status":            "status",
  "donation status":        "status",

  "tax deductible":         "taxDeductible",
  "taxdeductible":          "taxDeductible",
  "deductible":             "taxDeductible",

  "recurring":              "isRecurring",
  "is recurring":           "isRecurring",
  "recurring gift":         "isRecurring",
  "subscription":           "isRecurring",

  "frequency":              "frequency",
  "recurring frequency":    "frequency",
  "recurrence":             "frequency",

  // ─── Campaign / Designation ──────────────────────────────────────────
  "campaign":               "campaignName",
  "campaign name":          "campaignName",
  "appeal":                 "campaignName",
  "appeal name":            "campaignName",
  "fund":                   "designationName",
  "fund name":              "designationName",
  "designation":            "designationName",
  "designation name":       "designationName",
  "program":                "designationName",

  // ─── Notes / In-Kind ────────────────────────────────────────────────
  "note":                   "notes",
  "notes":                  "notes",
  "comment":                "notes",
  "comments":               "notes",
  "gift note":              "notes",
  "in-kind description":    "inKindDescription",
  "inkind":                 "inKindDescription",
  "in kind":                "inKindDescription",
  "in-kind":                "inKindDescription",
  "in kind description":    "inKindDescription",

  // ─── Constituent matching ────────────────────────────────────────────
  "email":                  "constituentEmail",
  "donor email":            "constituentEmail",
  "constituent email":      "constituentEmail",
  "email address":          "constituentEmail",
  "primary email":          "constituentEmail",

  "constituent id":         "constituentExternalId",
  "donor id":               "constituentExternalId",
  "external id":            "constituentExternalId",
  "source id":              "constituentExternalId",
  "dirid":                  "constituentExternalId",
  "constituent number":     "constituentExternalId",

  "first name":             "constituentFirstName",
  "firstname":              "constituentFirstName",
  "donor first name":       "constituentFirstName",
  "given name":             "constituentFirstName",

  "last name":              "constituentLastName",
  "lastname":               "constituentLastName",
  "donor last name":        "constituentLastName",
  "surname":                "constituentLastName",

  "name":                   "constituentName",
  "full name":              "constituentName",
  "donor name":             "constituentName",
  "constituent name":       "constituentName",

  // ─── Bloomerang-specific column names ──────────────────────────────
  "bloomerang id":          "constituentExternalId",
  "account number":         "constituentExternalId",
  "gift id (bloomerang)":   "receiptNumber",
  "acknowledgement date":   "skip",  // not imported but flag
  "receipt date":           "skip",  // receipt sent date — not a donation field we track in import

  // ─── NeonCRM-specific column names ─────────────────────────────────
  "neon id":                "constituentExternalId",
  "neon account id":        "constituentExternalId",
  "account id":             "constituentExternalId",
  "donation id":            "receiptNumber",

  // ─── eKYROS-specific column names ──────────────────────────────────
  "giverkey":               "constituentExternalId",
  "giverid":                "constituentExternalId",
};

/**
 * PAYMENT_METHOD_MAP: normalizes free-text payment method values from CSVs to Prisma enum values.
 * Case-insensitive pattern matching applied at import time.
 */
export const PAYMENT_METHOD_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /check|cheque/i,                          value: "CHECK" },
  { pattern: /credit|visa|mastercard|amex|discover|card/i, value: "CREDIT_CARD" },
  { pattern: /ach|eft|bank transfer|electronic/i,      value: "ACH" },
  { pattern: /wire/i,                                   value: "WIRE" },
  { pattern: /stock|securities|mutual fund|equity/i,   value: "STOCK" },
  { pattern: /in.?kind|inkind|goods|services/i,        value: "IN_KIND" },
  { pattern: /cash/i,                                   value: "CASH" },
  { pattern: /online|web|paypal|stripe|square|venmo/i, value: "ONLINE" },
];

/**
 * Normalize a raw payment method string to a Prisma PaymentMethod enum value.
 * Returns "ONLINE" as the default for unrecognized values.
 */
export function normalizePaymentMethod(raw: string): string {
  if (!raw?.trim()) return "ONLINE";
  for (const { pattern, value } of PAYMENT_METHOD_PATTERNS) {
    if (pattern.test(raw.trim())) return value;
  }
  return "ONLINE";
}

/** Parse a dollar-amount string to a number, stripping $, commas, and spaces. Returns null if invalid. */
export function parseAmount(raw: string): number | null {
  if (!raw?.trim()) return null;
  const n = parseFloat(raw.replace(/[$,\s]/g, "").trim());
  if (isNaN(n) || n < 0) return null;
  return n;
}

/** Parse a date string in common formats (MM/DD/YYYY, YYYY-MM-DD, M/D/YY). Returns null if unparseable. */
export function parseDonationDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  // ISO 8601 and unambiguous formats — try directly first
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;
  // Try M/D/YY or M/D/YYYY
  const parts = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (parts) {
    const year = parts[3].length === 2 ? 2000 + parseInt(parts[3]) : parseInt(parts[3]);
    const d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Normalize a status string to a Prisma DonationStatus enum value. Defaults to COMPLETED. */
export function normalizeDonationStatus(raw: string): string {
  const v = (raw ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (v === "PENDING")   return "PENDING";
  if (v === "FAILED")    return "FAILED";
  if (v === "REFUNDED")  return "REFUNDED";
  return "COMPLETED";
}

/** Normalize a recurring frequency string to a Prisma RecurringFrequency enum value. */
export function normalizeFrequency(raw: string): string | null {
  const v = (raw ?? "").toLowerCase().trim();
  if (/weekly|week/.test(v))       return "WEEKLY";
  if (/monthly|month/.test(v))     return "MONTHLY";
  if (/quarterly|quarter/.test(v)) return "QUARTERLY";
  if (/annual|yearly|year/.test(v)) return "ANNUALLY";
  return null;
}
