// Field mapping definitions for the CSV import wizard.
// Expanded to cover the full Constituent data model including eKYROS export columns.
// Keep in sync with: docs/status/import-tools.md and the Constituent Prisma schema.

/**
 * A single importable CRM field definition.
 * @property key       - Internal model field name (matches Prisma Constituent field)
 * @property label     - Human-readable label shown in the mapping UI
 * @property required  - Whether this field must be mapped before import can proceed
 * @property group     - Display group for the optgroup select (Identity, Contact, Address, etc.)
 * @property sensitive - Whether this field contains sensitive PII (SSN, DOB, etc.)
 */
export interface CrmField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly group: string;
  readonly sensitive: boolean;
}

/**
 * CRM_CONSTITUENT_FIELDS: every constituent field that CSV data can be mapped to.
 * Add new fields here whenever the Constituent model gains a new importable field.
 * Must stay in sync with AUTO_MAP_ALIASES and the import-tools.md status doc.
 */
export const CRM_CONSTITUENT_FIELDS: readonly CrmField[] = [
  // -- Identity --
  { key: "externalId",               label: "External Source ID",           required: false, group: "Identity",     sensitive: false },
  { key: "firstName",                label: "First Name",                    required: true,  group: "Identity",     sensitive: false },
  { key: "lastName",                 label: "Last Name",                     required: true,  group: "Identity",     sensitive: false },
  { key: "displayName",              label: "Display Name",                  required: false, group: "Identity",     sensitive: false },
  { key: "prefix",                   label: "Prefix / Title",                required: false, group: "Identity",     sensitive: false },
  { key: "greetingName",             label: "Greeting / Dear Name",          required: false, group: "Identity",     sensitive: false },
  { key: "formalName",               label: "Formal / Proper Name",          required: false, group: "Identity",     sensitive: false },
  { key: "gender",                   label: "Gender",                        required: false, group: "Identity",     sensitive: false },
  { key: "birthDate",                label: "Birth Date",                    required: false, group: "Identity",     sensitive: true  },
  { key: "ssn",                      label: "SSN (Sensitive)",               required: false, group: "Identity",     sensitive: true  },
  // -- Contact --
  { key: "email",                    label: "Primary Email",                 required: false, group: "Contact",      sensitive: false },
  { key: "spouseEmail",              label: "Spouse Email",                  required: false, group: "Contact",      sensitive: false },
  { key: "phone",                    label: "Primary Phone",                 required: false, group: "Contact",      sensitive: false },
  { key: "mobilePhone",              label: "Mobile Phone",                  required: false, group: "Contact",      sensitive: false },
  { key: "workPhone",                label: "Work Phone",                    required: false, group: "Contact",      sensitive: false },
  { key: "spousePhone",              label: "Spouse Phone",                  required: false, group: "Contact",      sensitive: false },
  { key: "website",                  label: "Website",                       required: false, group: "Contact",      sensitive: false },
  // -- Address --
  { key: "address1",                 label: "Mailing Address Line 1",        required: false, group: "Address",      sensitive: false },
  { key: "address2",                 label: "Mailing Address Line 2",        required: false, group: "Address",      sensitive: false },
  { key: "city",                     label: "Mailing City",                  required: false, group: "Address",      sensitive: false },
  { key: "state",                    label: "Mailing State",                 required: false, group: "Address",      sensitive: false },
  { key: "zip",                      label: "Mailing ZIP",                   required: false, group: "Address",      sensitive: false },
  // -- Organization / Household --
  { key: "organizationName",         label: "Organization Name",             required: false, group: "Organization", sensitive: false },
  { key: "churchAffiliation",        label: "Church Affiliation",            required: false, group: "Organization", sensitive: false },
  { key: "occupation",               label: "Occupation",                    required: false, group: "Organization", sensitive: false },
  { key: "jobTitle",                 label: "Job Title",                     required: false, group: "Organization", sensitive: false },
  { key: "spouseName",               label: "Spouse / Household Member",     required: false, group: "Household",    sensitive: false },
  // -- Preferences & Status --
  { key: "communicationPreferences", label: "Communication Prefs (raw)",     required: false, group: "Preferences",  sensitive: false },
  { key: "holdMail",                 label: "Do Not Mail / Hold Mail",       required: false, group: "Preferences",  sensitive: false },
  { key: "type",                     label: "Contact Type (Donor / Non-Donor)", required: false, group: "Status",       sensitive: false },
  { key: "constituentStatus",        label: "Constituent Status",            required: false, group: "Status",       sensitive: false },
  { key: "deceased",                 label: "Deceased Flag",                 required: false, group: "Status",       sensitive: false },
  { key: "spouseDeceased",           label: "Spouse Deceased Flag",          required: false, group: "Status",       sensitive: false },
  { key: "tags",                     label: "Tags / Keywords",               required: false, group: "Tags",         sensitive: false },
  // -- Source Metadata --
  { key: "location",                 label: "Location / Center",             required: false, group: "Metadata",     sensitive: false },
  { key: "sourceCreatedDate",        label: "Source Created Date",           required: false, group: "Metadata",     sensitive: false },
  { key: "sourceModifiedDate",       label: "Source Modified Date",          required: false, group: "Metadata",     sensitive: false },
  { key: "sourceLastUpdatedBy",      label: "Source Last Updated By",        required: false, group: "Metadata",     sensitive: false },
  // -- Skip (always available) --
  { key: "skip",                     label: "— Do Not Import —",             required: false, group: "Skip",         sensitive: false },
];

/**
 * FIELD_GROUPS: CRM_CONSTITUENT_FIELDS organized by group property (excludes "Skip").
 * Used to populate optgroup elements in the destination field dropdown.
 * Computed once at module load; effectively read-only after initialization.
 */
export const FIELD_GROUPS: Record<string, CrmField[]> = (() => {
  const groups: Record<string, CrmField[]> = {};
  for (const f of CRM_CONSTITUENT_FIELDS) {
    if (f.group === "Skip") continue;
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  }
  return groups;
})();

/**
 * AUTO_MAP_ALIASES: maps CSV column header names (lowercased + trimmed) to CRM field keys.
 * Covers all 37 eKYROS "Donor File Address List" columns plus common header variations.
 *
 * Special rules enforced here:
 * - "ssn"  -> "skip"  (sensitive data; user must explicitly opt in to import)
 * - "age"  -> "skip"  (always 0 in eKYROS exports; not worth importing)
 */
export const AUTO_MAP_ALIASES: Record<string, string> = {
  // -- eKYROS Donor File Address List (all 37 columns) --
  "dirid":                     "externalId",
  "record id":                 "externalId",
  "recordid":                  "externalId",
  "fullname":                  "displayName",
  "title":                     "prefix",
  "firstname":                 "firstName",
  "first_name":                "firstName",
  "lastname":                  "lastName",
  "last_name":                 "lastName",
  "dearname":                  "greetingName",
  "propername":                "formalName",
  "address":                   "address1",
  "street_address":            "address1",
  "city":                      "city",
  "state":                     "state",
  "state_province":            "state",
  "zip":                       "zip",
  "postal_code":               "zip",
  "spousename":                "spouseName",
  "organization":              "organizationName",
  "occupation":                "occupation",
  "jobtitle":                  "jobTitle",
  "church":                    "churchAffiliation",
  "homephone":                 "phone",
  "cellphone":                 "mobilePhone",
  "workphone":                 "workPhone",
  "spousephone":               "spousePhone",
  "email":                     "email",
  "email lists":               "tags",
  "lead status":               "constituentStatus",
  "contact owner":             "sourceLastUpdatedBy",
  "last activity date":        "sourceModifiedDate",
  "create date":               "sourceCreatedDate",
  "confirmed opt-out date":    "sourceModifiedDate",
  "confirmed opt-out source":  "communicationPreferences",
  "unsubscribed from all email": "communicationPreferences",
  "opted out of email: one to one": "communicationPreferences",
  "opted out of email: marketing information": "communicationPreferences",
  "message":                   "skip",
  "spouseemail":               "spouseEmail",
  "website":                   "website",
  "ssn":                       "skip",
  "birthdate":                 "birthDate",
  "age":                       "skip",
  "gender":                    "gender",
  "datecreated":               "sourceCreatedDate",
  "datemodified":              "sourceModifiedDate",
  "lastupdatedby":             "sourceLastUpdatedBy",
  "isoktocontact":             "communicationPreferences",
  "location":                  "location",
  "holdmail":                  "holdMail",
  "status":                    "constituentStatus",
  "deceaseddesc":              "deceased",
  "spousedeceaseddesc":        "spouseDeceased",
  "keywords":                  "tags",
  // -- Common CSV header variations --
  "first name":                "firstName",
  "first":                     "firstName",
  "fname":                     "firstName",
  "given name":                "firstName",
  "last name":                 "lastName",
  "last":                      "lastName",
  "lname":                     "lastName",
  "surname":                   "lastName",
  "family name":               "lastName",
  "full name":                 "displayName",
  "name":                      "displayName",
  "display name":              "displayName",
  "email address":             "email",
  "e-mail":                    "email",
  "primary email":             "email",
  "phone":                     "phone",
  "checkin_code":              "externalId",
  "rsvp_status":               "tags",
  "payment_status":            "tags",
  "ticket_type":               "tags",
  "party_name":                "organizationName",
  "created_at":                "sourceCreatedDate",
  "checked_in_at":             "sourceModifiedDate",
  "event_id":                  "location",
  "dietary_restrictions":      "skip",
  "warnings":                  "skip",
  "meal_preference":           "skip",
  "special_requests":          "skip",
  "check_in_status":           "tags",
  "arrival_time":              "sourceModifiedDate",
  "needs_childcare":           "skip",
  "number_of_children":        "skip",
  "children_ages":             "skip",
  "checked_in_by":             "skip",
  "checkin_method":            "skip",
  "paid_by_sponsorship_id":    "skip",
  "amount_due":                "skip",
  "seat_type":                 "skip",
  "table_id":                  "skip",
  "seat_number":               "skip",
  "phone number":              "phone",
  "telephone":                 "phone",
  "tel":                       "phone",
  "home phone":                "phone",
  "mobile":                    "mobilePhone",
  "cell":                      "mobilePhone",
  "cell phone":                "mobilePhone",
  "mobile phone":              "mobilePhone",
  "work phone":                "workPhone",
  "street":                    "address1",
  "street address":            "address1",
  "address 1":                 "address1",
  "address line 1":            "address1",
  "address 2":                 "address2",
  "address line 2":            "address2",
  "apt":                       "address2",
  "postal code":               "zip",
  "zip code":                  "zip",
  "postcode":                  "zip",
  "province":                  "state",
  "org":                       "organizationName",
  "company":                   "organizationName",
  "employer":                  "organizationName",
  "job title":                 "jobTitle",
  "spouse":                    "spouseName",
  "spouse name":               "spouseName",
  "birth date":                "birthDate",
  "dob":                       "birthDate",
  "date of birth":             "birthDate",
  "source id":                 "externalId",
  "external id":               "externalId",
  "constituent status":        "constituentStatus",
  "donor status":              "constituentStatus",
  "contact type":              "type",
  "constituent type":          "type",
  "person type":               "type",
  "donor/non-donor":           "type",
  "donor or non donor":        "type",
  "note":                      "tags",
  "notes":                     "tags",
  "comment":                   "tags",
  "comments":                  "tags",
  "created":                   "sourceCreatedDate",
  "date created":              "sourceCreatedDate",
  "modified":                  "sourceModifiedDate",
  "date modified":             "sourceModifiedDate",
  // -- Church / ministry aliases (expanded for smart detection) --
  "church affiliation":        "churchAffiliation",
  "church name":               "churchAffiliation",
  "congregation":              "churchAffiliation",
  "congregation name":         "churchAffiliation",
  "ministry":                  "churchAffiliation",
  "parish":                    "churchAffiliation",
  "faith community":           "churchAffiliation",
  "worship center":            "churchAffiliation",
  "fellowship":                "churchAffiliation",
  "denomination":              "churchAffiliation",
  "place of worship":          "churchAffiliation",
  "home church":               "churchAffiliation",
  "faith":                     "churchAffiliation",
  "religious affiliation":     "churchAffiliation",
  "religious organization":    "churchAffiliation",
};

/**
 * SENSITIVE_FIELD_KEYS: source column names (lowercased) that contain sensitive PII.
 * Used by VisualImportMapper to block import unless the user explicitly opts in.
 */
export const SENSITIVE_FIELD_KEYS = new Set([
  "ssn", "social security", "sin", "tax id", "passport", "social security number",
]);

/**
 * ALWAYS_SKIP_DEFAULTS: column names (lowercased) that auto-map to "skip" with a reason.
 * These are columns known to be empty or semantically useless in the eKYROS export.
 */
export const ALWAYS_SKIP_DEFAULTS: Record<string, string> = {
  "age":       "Column is always 0 in this source — skipped by default",
  "ssn":       "Sensitive field (SSN) — blocked by default; enable below if needed",
  "birthdate": "Column appears empty in this source",
  "keywords":  "Column appears empty in this source",
  "occupation":"Column appears empty in this source",
  "jobtitle":  "Column appears empty in this source",
};

/**
 * CONSTANT_VALUE_NOTES: columns known to always have the same value in this source.
 * Shown as informational notes in the mapping UI.
 */
export const CONSTANT_VALUE_NOTES: Record<string, string> = {
  "location": "Always 'Aurora' in this source — can be set as an import default",
};

/**
 * CHURCH_DENOMINATION_KEYWORDS: words and patterns commonly found in church/ministry names.
 * Used by detectChurchValues() to identify church-affiliation columns by scanning sample data.
 */
export const CHURCH_DENOMINATION_KEYWORDS = [
  "church", "chapel", "parish", "cathedral", "basilica", "ministry", "ministries",
  "baptist", "methodist", "lutheran", "presbyterian", "episcopal", "catholic",
  "evangelical", "pentecostal", "assemblies", "assembly of god", "seventh-day",
  "adventist", "nazarene", "reformed", "mennonite", "quaker", "unitarian",
  "congregational", "disciples of christ", "church of christ", "church of god",
  "salvation army", "fellowship", "covenant", "brethren", "wesleyan", "calvary",
  "first", "grace", "trinity", "redeemer", "resurrection", "cornerstone",
  "harvest", "crossroads", "living water", "new life", "community church",
  "christian", "alliance", "bethel", "immanuel", "emmanuel", "victory",
];

/**
 * detectChurchValues: returns true if any of the sample values look like church/ministry names.
 * Used when Smart Church Detection mode is enabled to suggest the churchAffiliation CRM field
 * for columns whose values match denominational or ministry patterns.
 *
 * @param sampleValues - up to ~10 sample values from a CSV column
 * @returns true if the majority of non-empty values match church patterns
 */
export function detectChurchValues(sampleValues: string[]): boolean {
  const nonEmpty = sampleValues.filter((v) => v?.trim());
  if (nonEmpty.length === 0) return false;
  const pattern = new RegExp(CHURCH_DENOMINATION_KEYWORDS.join("|"), "i");
  const matches = nonEmpty.filter((v) => pattern.test(v));
  // At least half of sample values must match to avoid false positives
  return matches.length / nonEmpty.length >= 0.5;
}
