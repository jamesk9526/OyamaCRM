// Compassion CRM client field definitions for CSV import.
// Mirrors the structure of app/data-tools/import/fieldMap.ts but targets the CompassionClient model.
// Keep in sync with the CompassionClient Prisma schema and docs/status/compassion-crm-audit.md.

/**
 * A single importable Compassion CRM client field definition.
 * @property key       - Internal model field name (matches Prisma CompassionClient field or virtual field)
 * @property label     - Human-readable label shown in the mapping UI
 * @property required  - Whether this field must be mapped before import can proceed
 * @property group     - Display group for the optgroup select (Identity, Contact, Address, etc.)
 * @property sensitive - Whether this field contains sensitive PII (DOB, gender, etc.)
 */
export interface CompassionClientField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly group: string;
  readonly sensitive: boolean;
}

/**
 * COMPASSION_CLIENT_FIELDS: every CompassionClient field that CSV data can be mapped to.
 * SSN is intentionally excluded — it is blocked at both UI and server levels.
 * Add new fields here whenever the CompassionClient model gains a new importable field.
 */
export const COMPASSION_CLIENT_FIELDS: readonly CompassionClientField[] = [
  // ─── Identity ──────────────────────────────────────────────────────────────
  { key: "externalSourceId",    label: "External Source ID (DirID)",  required: false, group: "Identity", sensitive: false },
  { key: "firstName",           label: "First Name",                   required: true,  group: "Identity", sensitive: false },
  { key: "lastName",            label: "Last Name",                    required: true,  group: "Identity", sensitive: false },
  { key: "preferredName",       label: "Preferred / Dear Name",        required: false, group: "Identity", sensitive: false },
  { key: "fullName",            label: "Full Name (display only)",     required: false, group: "Identity", sensitive: false },
  { key: "honorific",           label: "Title / Honorific",            required: false, group: "Identity", sensitive: false },
  { key: "formalName",          label: "Formal / Proper Name",         required: false, group: "Identity", sensitive: false },
  { key: "dateOfBirth",         label: "Date of Birth",                required: false, group: "Identity", sensitive: true  },
  { key: "gender",              label: "Gender",                       required: false, group: "Identity", sensitive: true  },
  // ─── Contact ───────────────────────────────────────────────────────────────
  { key: "email",               label: "Email Address",                required: false, group: "Contact",  sensitive: false },
  { key: "phone",               label: "Home Phone",                   required: false, group: "Contact",  sensitive: false },
  { key: "mobilePhone",         label: "Mobile / Cell Phone",          required: false, group: "Contact",  sensitive: false },
  { key: "workPhone",           label: "Work Phone",                   required: false, group: "Contact",  sensitive: false },
  // ─── Address ───────────────────────────────────────────────────────────────
  { key: "addressLine1",        label: "Address Line 1",               required: false, group: "Address",  sensitive: false },
  { key: "city",                label: "City",                         required: false, group: "Address",  sensitive: false },
  { key: "state",               label: "State",                        required: false, group: "Address",  sensitive: false },
  { key: "zip",                 label: "ZIP / Postal Code",            required: false, group: "Address",  sensitive: false },
  // ─── Client Status & Case Info ─────────────────────────────────────────────
  { key: "clientStatus",        label: "Client Status",                required: false, group: "Status",   sensitive: false },
  { key: "intakeDate",          label: "Intake / Created Date",        required: false, group: "Status",   sensitive: false },
  { key: "referralSource",      label: "Referral Source / Location",   required: false, group: "Status",   sensitive: false },
  // ─── Source Metadata ───────────────────────────────────────────────────────
  { key: "sourceCreatedDate",   label: "Source Created Date",          required: false, group: "Metadata", sensitive: false },
  { key: "sourceModifiedDate",  label: "Source Modified Date",         required: false, group: "Metadata", sensitive: false },
  { key: "sourceLastUpdatedBy", label: "Source Last Updated By",       required: false, group: "Metadata", sensitive: false },
  // ─── Skip (always available) ───────────────────────────────────────────────
  { key: "skip",                label: "— Do Not Import —",            required: false, group: "Skip",     sensitive: false },
];

/**
 * COMPASSION_FIELD_GROUPS: fields organized by group property (excludes "Skip").
 * Used to populate optgroup elements in the destination field dropdown.
 * Computed once at module load; read-only after initialization.
 */
export const COMPASSION_FIELD_GROUPS: Record<string, CompassionClientField[]> = (() => {
  const groups: Record<string, CompassionClientField[]> = {};
  for (const f of COMPASSION_CLIENT_FIELDS) {
    if (f.group === "Skip") continue;
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  }
  return groups;
})();

/**
 * COMPASSION_AUTO_MAP_ALIASES: maps lowercased CSV column names to CompassionClient field keys.
 * Covers all 37 eKYROS "Client File Address List" columns.
 *
 * Special safety rules enforced here:
 * - "ssn"  -> "skip"  (BLOCKED — sensitive field; SSN must never be imported)
 * - "age"  -> "skip"  (always 0 in eKYROS exports; not worth importing)
 */
export const COMPASSION_AUTO_MAP_ALIASES: Record<string, string> = {
  // ── eKYROS Client File Address List columns ────────────────────────────────
  "dirid":              "externalSourceId",
  "fullname":           "fullName",
  "title":              "honorific",
  "firstname":          "firstName",
  "lastname":           "lastName",
  "dearname":           "preferredName",
  "propername":         "formalName",
  "address":            "addressLine1",
  "city":               "city",
  "state":              "state",
  "zip":                "zip",
  "spousename":         "skip",
  "organization":       "skip",
  "occupation":         "skip",
  "jobtitle":           "skip",
  "church":             "skip",
  "homephone":          "phone",
  "cellphone":          "mobilePhone",
  "workphone":          "workPhone",
  "spousephone":        "skip",
  "email":              "email",
  "spouseemail":        "skip",
  "website":            "skip",
  "ssn":                "skip",           // BLOCKED — sensitive field; never importable
  "birthdate":          "dateOfBirth",
  "age":                "skip",           // Always 0 in eKYROS exports
  "gender":             "gender",
  "datecreated":        "sourceCreatedDate",
  "datemodified":       "sourceModifiedDate",
  "lastupdatedby":      "sourceLastUpdatedBy",
  "isoktocontact":      "skip",           // Will be handled as a note if needed
  "location":           "referralSource",
  "holdmail":           "skip",
  "status":             "clientStatus",
  "deceaseddesc":       "skip",
  "spousedeceaseddesc": "skip",
  "keywords":           "skip",
  // ── Common CSV header variations ───────────────────────────────────────────
  "first name":         "firstName",
  "first":              "firstName",
  "fname":              "firstName",
  "given name":         "firstName",
  "last name":          "lastName",
  "last":               "lastName",
  "lname":              "lastName",
  "surname":            "lastName",
  "family name":        "lastName",
  "full name":          "fullName",
  "name":               "fullName",
  "email address":      "email",
  "e-mail":             "email",
  "phone":              "phone",
  "phone number":       "phone",
  "telephone":          "phone",
  "home phone":         "phone",
  "mobile":             "mobilePhone",
  "cell":               "mobilePhone",
  "cell phone":         "mobilePhone",
  "mobile phone":       "mobilePhone",
  "work phone":         "workPhone",
  "street":             "addressLine1",
  "street address":     "addressLine1",
  "address 1":          "addressLine1",
  "address line 1":     "addressLine1",
  "postal code":        "zip",
  "zip code":           "zip",
  "postcode":           "zip",
  "province":           "state",
  "dob":                "dateOfBirth",
  "date of birth":      "dateOfBirth",
  "birth date":         "dateOfBirth",
  "source id":          "externalSourceId",
  "external id":        "externalSourceId",
  "client status":      "clientStatus",
  "intake date":        "intakeDate",
  "referral source":    "referralSource",
  "created":            "sourceCreatedDate",
  "date created":       "sourceCreatedDate",
  "modified":           "sourceModifiedDate",
  "date modified":      "sourceModifiedDate",
};

/**
 * COMPASSION_SENSITIVE_FIELDS: source column names (lowercased) that are sensitive PII.
 * Used by the UI to show a blocking banner and prevent SSN from ever being imported.
 */
export const COMPASSION_SENSITIVE_FIELDS = new Set([
  "ssn", "social security", "social security number", "sin", "tax id",
]);

/**
 * CLIENT_STATUS_MAP: eKYROS Status field values → CompassionClientStatus enum values.
 * Handles case-insensitive matching; unknown values default to "ACTIVE".
 */
export const CLIENT_STATUS_MAP: Record<string, string> = {
  "active":    "ACTIVE",
  "inactive":  "INACTIVE",
  "inactiv":   "INACTIVE",   // Truncated eKYROS value
  "closed":    "ARCHIVED",
  "archived":  "ARCHIVED",
  "pending":   "PENDING",
  "graduated": "GRADUATED",
  "":          "ACTIVE",     // Blank = assume active
};
