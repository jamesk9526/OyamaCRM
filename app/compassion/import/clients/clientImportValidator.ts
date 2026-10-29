// Compassion CRM — Client import validation & transformation engine.
//
// Pure functions only (no React, no DOM). Designed for unit testability.
// The wizard calls validateAndTransformClients() to produce a fully validated
// preview before any data is sent to /api/compassion/clients/import.
//
// This is the single source of truth for "is this row a real client or junk?"
// — keep heuristics here in sync with the server-side defense in
// server/src/routes/compassion.ts (POST /clients/import).

import type { RawRow } from "@/app/data-tools/import/csvParser";
import { CLIENT_STATUS_MAP } from "./compassionFieldMap";

/** Per-cell mapping from CSV header name to CRM field key (or "skip"). */
export type FieldMapping = Record<string, string>;

/** Fully-mapped row ready for import: CRM field keys to string values. */
export type MappedRow = Record<string, string>;

/** Severity for issues surfaced in the preview. */
export type IssueSeverity = "error" | "warning";

/** A single problem found while validating one source row. */
export interface RowIssue {
  /** 1-based source row number (relative to the data rows, not including the header). */
  row: number;
  /** CRM field key the issue applies to, or `_row` for whole-row issues. */
  field: string;
  /** Severity — `error` skips the row, `warning` keeps it. */
  severity: IssueSeverity;
  /** Stable machine code so callers can group/filter. */
  code: string;
  /** Human-readable message shown to the user. */
  message: string;
  /** Original raw cell value when available (for the error report). */
  rawValue?: string;
}

/** Aggregate result returned to the wizard. */
export interface ClientValidationResult {
  /** Rows that passed all hard validations and are safe to send to the API. */
  valid: MappedRow[];
  /** Per-row issues. May contain both errors (skipped) and warnings (kept). */
  issues: RowIssue[];
  /** File-level non-fatal observations (counts, advice) shown above the row table. */
  warnings: string[];
  /** Counts so the UI doesn't have to recompute. */
  counts: {
    total: number;
    valid: number;
    skippedGarbage: number;
    skippedMissingName: number;
    skippedInvalidEmail: number;
    skippedInvalidPhone: number;
    duplicatesInFile: number;
  };
}

// ─── Heuristics ──────────────────────────────────────────────────────────────

/**
 * GARBAGE_NAME_PATTERNS: regexes that match strings that look like report metadata,
 * widget configuration, or system noise rather than human names. If any pattern
 * matches the firstName, lastName, or fullName field, the row is rejected.
 */
const GARBAGE_NAME_PATTERNS: readonly RegExp[] = [
  // Comma-separated metadata e.g. "Text,Aurora,False,Active,No,Not Applicable, Active — — 05/09/2026 Unassigned 0"
  /^[A-Za-z]+(?:,[^,]*){2,}/,
  // Starts with an obvious widget/control/report token
  /^(text|true|false|null|none|n\/a|n\.a\.|na|undefined|#?\s*row|column|label|field|widget|report|page|total|subtotal|grand\s*total|count|sum|export|generated|filter|legend|header|footer|copyright|©)\b/i,
  // ALL_CAPS non-letter heavy strings (often layout artifacts)
  /^[A-Z0-9_\-\s]{12,}$/,
  // Mostly digits / dashes / em-dashes (e.g. "— — 05/09/2026 Unassigned 0")
  /^[\d\s\-—–.,/]{6,}$/,
  // Contains the literal " — " sentinel that eKYROS exports use as a column separator
  /\s—\s/,
];

/** Names that aren't allowed as a real first or last name on their own. */
const RESERVED_NAME_TOKENS = new Set([
  "text", "true", "false", "null", "none", "n/a", "na", "unknown",
  "test", "demo", "sample", "placeholder", "tbd", "tba", "anonymous",
]);

/** Email format check — RFC 5322 lite. Permissive but rejects obvious junk. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** CRM field keys that contain phone numbers. */
const PHONE_FIELDS = new Set(["phone", "mobilePhone", "workPhone"]);

/** CRM field keys that contain dates — kept in sync with the Prisma schema. */
const DATE_FIELDS = ["dateOfBirth", "intakeDate", "sourceCreatedDate", "sourceModifiedDate"] as const;

/** Recognised CompassionClientStatus enum values (after normalization). */
const RECOGNISED_STATUSES = new Set(["ACTIVE", "INACTIVE", "ARCHIVED", "PENDING", "GRADUATED"]);

// ─── Pure helpers (exported for unit testing) ────────────────────────────────

/**
 * isGarbageName: true when `s` looks like report metadata, a widget token, or
 * other non-human noise rather than an actual person name.
 */
export function isGarbageName(s: string): boolean {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return false;
  if (RESERVED_NAME_TOKENS.has(trimmed.toLowerCase())) return true;
  return GARBAGE_NAME_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * formatPhone: normalise a phone string to (xxx) xxx-xxxx US format. Returns the raw
 * value when the digit count doesn't look like a recognisable US number.
 */
export function formatPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/**
 * isValidPhone: returns true when the raw value contains 7–15 digits (covers US + international).
 * Empty values are considered valid (the field is optional).
 */
export function isValidPhone(raw: string): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * isValidEmail: returns true when the raw value passes the lite RFC 5322 check.
 * Empty values are considered valid (the field is optional).
 */
export function isValidEmail(raw: string): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;
  return EMAIL_RE.test(trimmed);
}

/**
 * isValidDate: returns true when `raw` parses to a real date that isn't absurdly far
 * in the past or future. Empty values are considered valid (the field is optional).
 */
export function isValidDate(raw: string): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  return year >= 1900 && year <= 2100;
}

/**
 * splitNameAndPreferred: parses common "Full Name(Preferred)" / "Full Name (Preferred)" /
 * "Full Name 'Preferred'" / "Full Name \"Preferred\"" patterns.
 *
 * Returns { full, preferred? }. When no preferred portion is found, full = the input trimmed.
 *
 * Examples:
 *   "Miranda Abrisz(Miranda)"      -> { full: "Miranda Abrisz", preferred: "Miranda" }
 *   "Miranda Abrisz (Mira)"        -> { full: "Miranda Abrisz", preferred: "Mira" }
 *   "Robert 'Bob' Smith"           -> { full: "Robert Smith",   preferred: "Bob" }
 *   "Jane Doe"                     -> { full: "Jane Doe" }
 */
export function splitNameAndPreferred(raw: string): { full: string; preferred?: string } {
  const value = (raw ?? "").trim();
  if (!value) return { full: "" };

  // Case 1: trailing parenthesised nickname
  const paren = value.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (paren) {
    const full = paren[1].trim();
    const preferred = paren[2].trim();
    if (full && preferred && !preferred.includes(" ")) {
      return { full, preferred };
    }
  }

  // Case 2: middle quoted nickname e.g. Robert "Bob" Smith / Robert 'Bob' Smith
  const quoted = value.match(/^(.+?)\s+["']([^"']+)["']\s+(.+)$/);
  if (quoted) {
    return { full: `${quoted[1].trim()} ${quoted[3].trim()}`.trim(), preferred: quoted[2].trim() };
  }

  return { full: value };
}

/**
 * splitFullName: simple first/last splitter. The first whitespace-delimited token
 * becomes firstName; everything else becomes lastName. Single-token names use the
 * single token for both fields so the row passes the "must have a name" check.
 */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * normaliseStatus: maps an arbitrary source status string to the Compassion enum.
 * Unknown values return undefined so the caller can flag the row.
 */
export function normaliseStatus(raw: string): string | undefined {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return "ACTIVE";
  return CLIENT_STATUS_MAP[key];
}

/**
 * normaliseNameKey: lowercases + strips non-letters from a name, used for in-file
 * duplicate detection. Returns "" when input has no letters.
 */
function normaliseNameKey(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

// ─── Main validator ──────────────────────────────────────────────────────────

/**
 * validateAndTransformClients: applies field-specific transformations, runs validation
 * heuristics, detects in-file duplicates, and returns rows safe for import.
 *
 * Hard rejects (never imported):
 *   - Row has no firstName / lastName / fullName mapped to anything usable.
 *   - The name field looks like report metadata (see GARBAGE_NAME_PATTERNS).
 *   - Required field missing AND no auto-derivable value.
 *
 * Warnings (row is still imported):
 *   - Email format invalid (email is dropped, row imported without it).
 *   - Phone format invalid (phone is kept raw, row imported with it).
 *   - Status not recognised (defaults to ACTIVE on the server).
 *   - Date of birth or intake date invalid (date is dropped).
 *   - Row is highly similar to another row in the same file (potential in-file duplicate).
 */
export function validateAndTransformClients(
  rows: readonly RawRow[],
  mapping: FieldMapping,
): ClientValidationResult {
  const valid: MappedRow[] = [];
  const issues: RowIssue[] = [];
  const counts = {
    total: rows.length,
    valid: 0,
    skippedGarbage: 0,
    skippedMissingName: 0,
    skippedInvalidEmail: 0,
    skippedInvalidPhone: 0,
    duplicatesInFile: 0,
  };

  // Track normalized keys used to spot in-file duplicates by name+phone+email.
  const seenKeys = new Map<string, number>();

  rows.forEach((rawRow, i) => {
    const rowNo = i + 1;
    const mapped: MappedRow = {};

    // Pass 1: copy mapped values, applying per-field transformations.
    for (const [csvCol, crmKey] of Object.entries(mapping)) {
      if (crmKey === "skip") continue;
      let value = (rawRow[csvCol] ?? "").trim();

      if (PHONE_FIELDS.has(crmKey)) {
        // Format but don't drop — server still accepts loosely-formatted numbers.
        const formatted = formatPhone(value);
        value = formatted;
      } else if (crmKey === "state" && value) {
        value = value.toUpperCase().slice(0, 2);
      } else if (crmKey === "clientStatus" && value) {
        const normalised = normaliseStatus(value);
        if (!normalised) {
          issues.push({
            row: rowNo, field: "clientStatus", severity: "warning",
            code: "STATUS_UNRECOGNISED",
            message: `Status "${value}" not recognised — will default to ACTIVE`,
            rawValue: value,
          });
          value = "ACTIVE";
        } else {
          value = normalised;
        }
      }

      if (value !== "") mapped[crmKey] = value;
    }

    // Pass 2: derive firstName/lastName/preferredName from fullName when needed.
    // Also handles the "Miranda Abrisz(Miranda)" eKYROS pattern.
    const sourceForName =
      mapped.fullName ?? mapped.formalName ?? mapped.firstName ?? mapped.lastName ?? "";
    if (sourceForName && (!mapped.firstName || !mapped.lastName || !mapped.preferredName)) {
      const { full, preferred } = splitNameAndPreferred(sourceForName);
      if (preferred && !mapped.preferredName) mapped.preferredName = preferred;
      if (!mapped.firstName || !mapped.lastName) {
        const { firstName, lastName } = splitFullName(full || sourceForName);
        if (!mapped.firstName && firstName) mapped.firstName = firstName;
        if (!mapped.lastName && lastName) mapped.lastName = lastName;
      }
    }

    // Pass 3: hard validations.
    const fn = (mapped.firstName ?? "").trim();
    const ln = (mapped.lastName ?? "").trim();

    if (!fn && !ln) {
      issues.push({
        row: rowNo, field: "_row", severity: "error",
        code: "MISSING_NAME",
        message: "No first or last name found — row skipped",
      });
      counts.skippedMissingName++;
      return;
    }

    if (isGarbageName(fn) || isGarbageName(ln) || isGarbageName(mapped.fullName ?? "")) {
      issues.push({
        row: rowNo, field: "firstName", severity: "error",
        code: "GARBAGE_NAME",
        message: `Name looks like report/widget metadata ("${fn || ln}") — row skipped`,
        rawValue: fn || ln,
      });
      counts.skippedGarbage++;
      return;
    }

    // Email validation — drop invalid email but keep the row.
    if (mapped.email && !isValidEmail(mapped.email)) {
      issues.push({
        row: rowNo, field: "email", severity: "warning",
        code: "INVALID_EMAIL",
        message: `Email "${mapped.email}" is not a valid address — will be dropped`,
        rawValue: mapped.email,
      });
      delete mapped.email;
      counts.skippedInvalidEmail++;
    }

    // Phone validation — warn but keep raw value (server stores as-is).
    for (const pf of PHONE_FIELDS) {
      const v = mapped[pf];
      if (v && !isValidPhone(v)) {
        issues.push({
          row: rowNo, field: pf, severity: "warning",
          code: "INVALID_PHONE",
          message: `${pf} "${v}" doesn't look like a valid phone number — kept as-is`,
          rawValue: v,
        });
        counts.skippedInvalidPhone++;
      }
    }

    // Date validations — warn and drop if invalid.
    for (const df of DATE_FIELDS) {
      const v = mapped[df];
      if (v && !isValidDate(v)) {
        issues.push({
          row: rowNo, field: df, severity: "warning",
          code: "INVALID_DATE",
          message: `${df} "${v}" is not a valid date — will be dropped`,
          rawValue: v,
        });
        delete mapped[df];
      }
    }

    // Recognised status sanity check (clientStatus already normalised above).
    if (mapped.clientStatus && !RECOGNISED_STATUSES.has(mapped.clientStatus)) {
      mapped.clientStatus = "ACTIVE";
    }

    // In-file duplicate detection — by email, phone, or name+intake key.
    const keys = [
      mapped.email ? `email:${mapped.email.toLowerCase()}` : null,
      mapped.phone ? `phone:${(mapped.phone || "").replace(/\D/g, "")}` : null,
      `name:${normaliseNameKey(fn)}|${normaliseNameKey(ln)}`,
    ].filter((x): x is string => Boolean(x));

    for (const key of keys) {
      const prevRow = seenKeys.get(key);
      if (prevRow !== undefined) {
        issues.push({
          row: rowNo, field: "_row", severity: "warning",
          code: "DUPLICATE_IN_FILE",
          message: `Possible in-file duplicate of row ${prevRow} (matched by ${key.split(":")[0]})`,
        });
        counts.duplicatesInFile++;
        break; // only flag once per row
      }
    }
    for (const key of keys) {
      if (!seenKeys.has(key)) seenKeys.set(key, rowNo);
    }

    valid.push(mapped);
  });

  counts.valid = valid.length;

  // File-level summary warnings shown above the per-row table.
  const warnings: string[] = [];
  if (counts.skippedGarbage > 0) {
    warnings.push(`${counts.skippedGarbage} row(s) rejected as report/metadata garbage and will not be imported.`);
  }
  if (counts.skippedMissingName > 0) {
    warnings.push(`${counts.skippedMissingName} row(s) had no name and will be skipped.`);
  }
  if (counts.skippedInvalidEmail > 0) {
    warnings.push(`${counts.skippedInvalidEmail} row(s) had an invalid email — the address was dropped.`);
  }
  if (counts.duplicatesInFile > 0) {
    warnings.push(`${counts.duplicatesInFile} possible duplicate(s) detected within the file. Review before importing.`);
  }

  return { valid, issues, warnings, counts };
}

/**
 * issuesToCsv: serialises the issue list as a downloadable CSV (RFC 4180 quoting).
 * Returned string is ready to drop into a Blob/URL download.
 */
export function issuesToCsv(issues: readonly RowIssue[]): string {
  const header = ["Row", "Severity", "Code", "Field", "Message", "Raw Value"];
  const escape = (v: string | number | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const i of issues) {
    lines.push([i.row, i.severity, i.code, i.field, i.message, i.rawValue ?? ""].map(escape).join(","));
  }
  return lines.join("\n");
}
