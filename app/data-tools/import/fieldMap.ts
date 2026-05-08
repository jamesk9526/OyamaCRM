/**
 * Field mapping definitions for the CSV import wizard.
 * Keep in sync with the Constituent data model.
 * Extended with full eKYROS File Address List field set (37 columns).
 */

/**
 * A single importable CRM field definition.
 * @property key      — Internal model field name used in API payloads
 * @property label    — Human-readable label shown in the mapping UI
 * @property required — Whether this field must be mapped before import can proceed
 * @property group    — Logical grouping for the field selector dropdown
 */
export interface CrmField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly group: string;
}

/**
 * CRM_CONSTITUENT_FIELDS: all constituent fields that CSV data can be mapped to.
 * Organized by group. Add fields here whenever the Constituent model expands.
 * "skip" is the sentinel value meaning "do not import this column."
 */
export const CRM_CONSTITUENT_FIELDS: readonly CrmField[] = [
  // ── Core Identity ────────────────────────────────────────────────────────
  { key: "externalId",        label: "External Source ID",           required: false, group: "Identity" },
  { key: "displayName",       label: "Display Name",                 required: false, group: "Identity" },
  { key: "prefix",            label: "Prefix / Title",               required: false, group: "Identity" },
  { key: "firstName",         label: "First Name",                   required: false, group: "Identity" },
  { key: "lastName",          label: "Last Name",                    required: false, group: "Identity" },
  { key: "greetingName",      label: "Greeting / Dear Name",         required: false, group: "Identity" },
  { key: "formalName",        label: "Formal Name",                  required: false, group: "Identity" },
  { key: "gender",            label: "Gender",                       required: false, group: "Identity" },

  // ── Organization ─────────────────────────────────────────────────────────
  { key: "organizationName",  label: "Organization Name",            required: false, group: "Organization" },
  { key: "constituentType",   label: "Constituent Type",             required: false, group: "Organization" },
  { key: "occupation",        label: "Occupation",                   required: false, group: "Organization" },
  { key: "jobTitle",          label: "Job Title",                    required: false, group: "Organization" },
  { key: "churchAffiliation", label: "Church Affiliation",           required: false, group: "Organization" },

  // ── Address ───────────────────────────────────────────────────────────────
  { key: "address1",          label: "Mailing Address Line 1",       required: false, group: "Address" },
  { key: "address2",          label: "Mailing Address Line 2",       required: false, group: "Address" },
  { key: "city",              label: "Mailing City",                 required: false, group: "Address" },
  { key: "state",             label: "Mailing State",                required: false, group: "Address" },
  { key: "zip",               label: "Mailing ZIP",                  required: false, group: "Address" },

  // ── Phone ─────────────────────────────────────────────────────────────────
  { key: "phone",             label: "Primary Phone",                required: false, group: "Phone" },
  { key: "mobilePhone",       label: "Mobile Phone",                 required: false, group: "Phone" },
  { key: "workPhone",         label: "Work Phone",                   required: false, group: "Phone" },
  { key: "spousePhone",       label: "Spouse Phone",                 required: false, group: "Phone" },

  // ── Email & Web ───────────────────────────────────────────────────────────
  { key: "email",             label: "Primary Email",                required: false, group: "Email" },
  { key: "spouseEmail",       label: "Spouse Email",                 required: false, group: "Email" },
  { key: "website",           label: "Website",                      required: false, group: "Email" },

  // ── Household ─────────────────────────────────────────────────────────────
  { key: "spouseName",        label: "Spouse / Household Member",    required: false, group: "Household" },

  // ── Status & Preferences ──────────────────────────────────────────────────
  { key: "constituentStatus", label: "Constituent Status",           required: false, group: "Status" },
  { key: "donorStatus",       label: "Donor Status",                 required: false, group: "Status" },
  { key: "communicationPrefs",label: "Communication Preferences",    required: false, group: "Status" },
  { key: "holdMail",          label: "Do Not Mail / Hold Mail",      required: false, group: "Status" },
  { key: "isDeceased",        label: "Deceased Flag",                required: false, group: "Status" },
  { key: "spouseDeceased",    label: "Spouse Deceased Flag",         required: false, group: "Status" },
  { key: "location",          label: "Location / Center",            required: false, group: "Status" },

  // ── Source Metadata ───────────────────────────────────────────────────────
  { key: "sourceCreatedDate", label: "Source Created Date",          required: false, group: "Metadata" },
  { key: "sourceModifiedDate",label: "Source Modified Date",         required: false, group: "Metadata" },
  { key: "sourceUpdatedBy",   label: "Source Last Updated By",       required: false, group: "Metadata" },

  // ── Tags & Notes ──────────────────────────────────────────────────────────
  { key: "tags",              label: "Tags / Keywords",              required: false, group: "Tags" },
  { key: "notes",             label: "Notes",                        required: false, group: "Tags" },

  // ── Sentinel ──────────────────────────────────────────────────────────────
  { key: "skip",              label: "— Do Not Import —",            required: false, group: "Other" },
] as const;

/**
 * AUTO_MAP_ALIASES: maps lowercased CSV column names to CRM field keys.
 * Includes eKYROS File Address List field names, generic aliases, and common variations.
 * Confidence is computed separately based on whether the match was exact (high) or partial (medium).
 */
export const AUTO_MAP_ALIASES: Record<string, string> = {
  // ── eKYROS-specific column names (exact matches → HIGH confidence) ────────
  "dirid":              "externalId",
  "fullname":           "displayName",
  "title":              "prefix",
  "firstname":          "firstName",
  "lastname":           "lastName",
  "dearname":           "greetingName",
  "propername":         "formalName",
  "address":            "address1",
  "city":               "city",
  "state":              "state",
  "zip":                "zip",
  "spousename":         "spouseName",
  "organization":       "organizationName",
  "occupation":         "occupation",
  "jobtitle":           "jobTitle",
  "church":             "churchAffiliation",
  "homephone":          "phone",
  "cellphone":          "mobilePhone",
  "workphone":          "workPhone",
  "spousephone":        "spousePhone",
  "email":              "email",
  "spouseemail":        "spouseEmail",
  "website":            "website",
  "ssn":                "SENSITIVE",          // blocked unless opt-in
  "birthdate":          "skip",               // empty in this file
  "age":                "skip",               // always 0 in this file
  "gender":             "gender",
  "datecreated":        "sourceCreatedDate",
  "datemodified":       "sourceModifiedDate",
  "lastupdatedby":      "sourceUpdatedBy",
  "isoktocontact":      "communicationPrefs",
  "location":           "location",
  "holdmail":           "holdMail",
  "status":             "constituentStatus",
  "deceaseddesc":       "isDeceased",
  "spousedeceaseddesc": "spouseDeceased",
  "keywords":           "tags",

  // ── Generic aliases ───────────────────────────────────────────────────────
  "first name":         "firstName",
  "first":              "firstName",
  "fname":              "firstName",
  "given name":         "firstName",
  "last name":          "lastName",
  "last":               "lastName",
  "lname":              "lastName",
  "surname":            "lastName",
  "family name":        "lastName",
  "email address":      "email",
  "e-mail":             "email",
  "phone":              "phone",
  "phone number":       "phone",
  "telephone":          "phone",
  "tel":                "phone",
  "mobile":             "mobilePhone",
  "cell":               "mobilePhone",
  "cell phone":         "mobilePhone",
  "mobile phone":       "mobilePhone",
  "street":             "address1",
  "street address":     "address1",
  "address 1":          "address1",
  "address line 1":     "address1",
  "address 2":          "address2",
  "address line 2":     "address2",
  "apt":                "address2",
  "province":           "state",
  "zip code":           "zip",
  "postal code":        "zip",
  "postcode":           "zip",
  "constituent type":   "constituentType",
  "donor status":       "donorStatus",
  "note":               "notes",
  "comments":           "notes",
  "comment":            "notes",
};

/**
 * SENSITIVE_FIELD_KEYS: source column names (lowercased) that contain PII.
 * These are flagged in the mapping UI and require explicit opt-in before import.
 */
export const SENSITIVE_FIELD_KEYS = new Set(["ssn", "social security", "sin", "tax id", "passport"]);

/**
 * ALWAYS_SKIP_DEFAULTS: source column names that auto-map to "skip" with a warning.
 * These are columns known to be empty or semantically useless in the eKYROS export.
 */
export const ALWAYS_SKIP_DEFAULTS: Record<string, string> = {
  "age":       "Column is always 0 in this source — skipped by default",
  "ssn":       "Sensitive field (SSN) — blocked by default, enable below if needed",
  "birthdate": "Column appears empty in this source",
  "keywords":  "Column appears empty in this source",
  "occupation":"Column appears empty in this source",
  "jobtitle":  "Column appears empty in this source",
};

/**
 * CONSTANT_VALUE_NOTES: columns known to always have the same value in this source.
 * Shown as informational warnings in the mapping UI.
 */
export const CONSTANT_VALUE_NOTES: Record<string, string> = {
  "location": "Always 'Aurora' in this source — can be set as import default",
};
