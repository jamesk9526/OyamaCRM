// Field mapping definitions for the CSV import wizard — keep in sync with the Constituent data model.

/**
 * A single importable CRM field definition.
 * @property key       — Internal model field name
 * @property label     — Human-readable label shown in the mapping UI
 * @property required  — Whether this field must be mapped before import can proceed
 */
export interface CrmField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
}

/**
 * CRM_CONSTITUENT_FIELDS: all constituent fields that CSV data can be mapped to.
 * Add new fields here whenever the Constituent model gains a new importable field.
 */
export const CRM_CONSTITUENT_FIELDS: readonly CrmField[] = [
  { key: "firstName",      label: "First Name",                   required: true  },
  { key: "lastName",       label: "Last Name",                    required: true  },
  { key: "email",          label: "Email",                        required: false },
  { key: "phone",          label: "Phone",                        required: false },
  { key: "mobilePhone",    label: "Mobile Phone",                 required: false },
  { key: "address1",       label: "Address Line 1",               required: false },
  { key: "address2",       label: "Address Line 2",               required: false },
  { key: "city",           label: "City",                         required: false },
  { key: "state",          label: "State",                        required: false },
  { key: "zip",            label: "ZIP Code",                     required: false },
  { key: "constituentType",label: "Type (donor/volunteer/member)",required: false },
  { key: "donorStatus",    label: "Donor Status",                 required: false },
  { key: "notes",          label: "Notes",                        required: false },
  { key: "skip",           label: "— Skip this column —",         required: false },
] as const;

/**
 * AUTO_MAP_ALIASES: maps common CSV column header variations (lowercased) to CRM field keys.
 * Used to auto-suggest mappings when a CSV is first uploaded.
 * Extend whenever a new importable field is added.
 */
export const AUTO_MAP_ALIASES: Record<string, string> = {
  "first name":    "firstName",
  "first":         "firstName",
  "fname":         "firstName",
  "given name":    "firstName",
  "last name":     "lastName",
  "last":          "lastName",
  "lname":         "lastName",
  "surname":       "lastName",
  "family name":   "lastName",
  "email":         "email",
  "email address": "email",
  "e-mail":        "email",
  "mail":          "email",
  "phone":         "phone",
  "phone number":  "phone",
  "telephone":     "phone",
  "tel":           "phone",
  "mobile":        "mobilePhone",
  "cell":          "mobilePhone",
  "cell phone":    "mobilePhone",
  "mobile phone":  "mobilePhone",
  "address":       "address1",
  "street":        "address1",
  "street address":"address1",
  "address 1":     "address1",
  "address line 1":"address1",
  "address 2":     "address2",
  "address line 2":"address2",
  "apt":           "address2",
  "city":          "city",
  "state":         "state",
  "province":      "state",
  "zip":           "zip",
  "zip code":      "zip",
  "postal code":   "zip",
  "postcode":      "zip",
  "type":          "constituentType",
  "constituent type": "constituentType",
  "status":        "donorStatus",
  "donor status":  "donorStatus",
  "notes":         "notes",
  "note":          "notes",
  "comments":      "notes",
  "comment":       "notes",
};
