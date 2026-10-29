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
  // ─── Linked Records (Planned) ────────────────────────────────────────────
  // These fields are included so legacy imports can be mapped now.
  // TODO: backend API needed to persist these into client-scoped linked tables.
  { key: "caseNumber",             label: "Case Number (planned)",             required: false, group: "Case (Planned)",         sensitive: false },
  { key: "caseDate",               label: "Case Date (planned)",               required: false, group: "Case (Planned)",         sensitive: false },
  { key: "caseStatus",             label: "Case Status (planned)",             required: false, group: "Case (Planned)",         sensitive: false },
  { key: "caseDueDate",            label: "Case Due Date (planned)",           required: false, group: "Case (Planned)",         sensitive: false },
  { key: "caseOutcome",            label: "Case Outcome (planned)",            required: false, group: "Case (Planned)",         sensitive: false },
  { key: "caseOutcomeDate",        label: "Case Outcome Date (planned)",       required: false, group: "Case (Planned)",         sensitive: false },
  { key: "initialAssessment",      label: "Initial Assessment (planned)",      required: false, group: "Case (Planned)",         sensitive: false },
  { key: "currentAssessment",      label: "Current Assessment (planned)",      required: false, group: "Case (Planned)",         sensitive: false },
  { key: "initialIntentions",      label: "Initial Intentions (planned)",      required: false, group: "Case (Planned)",         sensitive: false },
  { key: "currentIntentions",      label: "Current Intentions (planned)",      required: false, group: "Case (Planned)",         sensitive: false },
  { key: "currentAssessmentStage", label: "Assessment Stage (planned)",        required: false, group: "Case (Planned)",         sensitive: false },
  { key: "spiritualStatus",        label: "Spiritual Status (planned)",        required: false, group: "Case (Planned)",         sensitive: false },
  { key: "visitDate",              label: "Visit Date (planned)",              required: false, group: "Visits (Planned)",       sensitive: false },
  { key: "formType",               label: "Form Type (planned)",               required: false, group: "Visits (Planned)",       sensitive: false },
  { key: "visitLocation",          label: "Visit Location (planned)",          required: false, group: "Visits (Planned)",       sensitive: false },
  { key: "staffVolunteer",         label: "Staff / Volunteer (planned)",       required: false, group: "Visits (Planned)",       sensitive: false },
  { key: "pregnancyTestResult",    label: "Pregnancy Test Result (planned)",   required: false, group: "Medical (Planned)",      sensitive: true  },
  { key: "referral",               label: "Referral (planned)",                required: false, group: "Services (Planned)",     sensitive: false },
  { key: "classDescription",       label: "Class Description (planned)",       required: false, group: "Services (Planned)",     sensitive: false },
  { key: "boutiqueItem",           label: "Boutique Item (planned)",           required: false, group: "Services (Planned)",     sensitive: false },
  { key: "pointsEarned",           label: "Points Earned (planned)",           required: false, group: "Services (Planned)",     sensitive: false },
  { key: "pointsUsed",             label: "Points Used (planned)",             required: false, group: "Services (Planned)",     sensitive: false },
  { key: "maritalStatus",          label: "Marital Status (planned)",          required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "religion",               label: "Religion (planned)",                required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "educationLevel",         label: "Education Level (planned)",         required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "incomeLevel",            label: "Income Level (planned)",            required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "studentStatus",          label: "Student Status (planned)",          required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "race",                   label: "Race / Ethnicity (planned)",        required: false, group: "Demographics (Planned)", sensitive: true  },
  { key: "keywords",               label: "Keywords / Tags (planned)",         required: false, group: "Demographics (Planned)", sensitive: false },
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
  "address2":           "addressLine2",
  "address line 2":     "addressLine2",
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
  "keywords":           "keywords",
  "maritalstatusdesc":  "maritalStatus",
  "religiondesc":       "religion",
  "educationleveldesc": "educationLevel",
  "incomeleveldesc":    "incomeLevel",
  "studentstatusdesc":  "studentStatus",
  "race":               "race",
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
  "case":               "caseNumber",
  "case number":        "caseNumber",
  "case date":          "caseDate",
  "due date":           "caseDueDate",
  "outcome":            "caseOutcome",
  "date of outcome":    "caseOutcomeDate",
  "initial assessment": "initialAssessment",
  "current assessment": "currentAssessment",
  "initial intentions": "initialIntentions",
  "current intentions": "currentIntentions",
  "current assessment stage": "currentAssessmentStage",
  "assessment stage":   "currentAssessmentStage",
  "spiritual status":   "spiritualStatus",
  "intake date":        "intakeDate",
  "referral source":    "referralSource",
  "visit date":         "visitDate",
  "form type":          "formType",
  "staff/volunteer":    "staffVolunteer",
  "staff volunteer":    "staffVolunteer",
  "pregnancy test result": "pregnancyTestResult",
  "referral":           "referral",
  "class description":  "classDescription",
  "boutique item":      "boutiqueItem",
  "points earned":      "pointsEarned",
  "points used":        "pointsUsed",
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
