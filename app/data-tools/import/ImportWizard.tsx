"use client";
// Full visual 5-step CSV import wizard for constituent records.
// Handles file upload, smart header detection, field mapping, validation, and import.
// Sub-components: CircularProgress, StatCard, StepperSidebar, FieldDetailsPanel.

import { useState, useRef, useCallback, useMemo, Fragment } from "react";
import { CRM_CONSTITUENT_FIELDS, AUTO_MAP_ALIASES, FIELD_GROUPS, detectChurchValues } from "./fieldMap";
import type { CrmField } from "./fieldMap";
import { parseCSV, computeColumnStats } from "./csvParser";
import type { CsvParseResult, ColumnStats, RawRow } from "./csvParser";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Maps each CSV column header to a CRM field key (or "skip") */
type FieldMapping = Record<string, string>;

/** A fully-mapped row ready for import: CRM field keys to string values */
type MappedRow = Record<string, string>;

/** Visual status badge variant for each CSV column's current mapping assignment */
type MappingStatus = "mapped" | "required" | "unmapped" | "sensitive";

/** Status filter applied to the mapping table ("all" shows all rows) */
type StatusFilter = "all" | MappingStatus;

/** How to handle existing CRM records during import */
type ImportMode = "create_only" | "upsert" | "update_only";

/** Whether constituent records should be created as individuals or organizations */
type RecordType = "individual" | "organization";

/** Result of running validateAndTransform in Step 3 */
interface ValidationResult {
  valid: MappedRow[];
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: string[];
}

/** Minimal constituent shape for client-side duplicate detection */
interface ExistingConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

/** Props for the main ImportWizard component */
interface ImportWizardProps {
  /** Existing CRM constituents used for client-side duplicate count estimation */
  existingConstituents: ExistingConstituent[];
}

// ─── Module-level constants ───────────────────────────────────────────────────

/** Wizard step definitions in display order */
const STEPS = [
  { id: 1, label: "Upload File" },
  { id: 2, label: "Map Fields" },
  { id: 3, label: "Review & Validate" },
  { id: 4, label: "Import Settings" },
  { id: 5, label: "Confirm & Import" },
];

/**
 * Visual styling for each mapping status.
 * badge: applied to the status pill; row: applied to the full table row background.
 */
const STATUS_DISPLAY: Record<MappingStatus, { label: string; badge: string; row: string }> = {
  mapped:    { label: "Mapped",      badge: "bg-green-50 text-green-700 border border-green-200",   row: "" },
  required:  { label: "Required",    badge: "bg-red-50 text-red-600 border border-red-200",          row: "bg-red-50/30" },
  unmapped:  { label: "Unmapped",    badge: "bg-orange-50 text-orange-600 border border-orange-200", row: "" },
  sensitive: { label: "Sensitive",   badge: "bg-yellow-50 text-yellow-700 border border-yellow-200", row: "bg-yellow-50/30" },
};

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * autoMap: generates an initial FieldMapping by looking up each header in AUTO_MAP_ALIASES.
 * Headers not found in the alias table default to "skip".
 */
function autoMap(headers: string[]): FieldMapping {
  const m: FieldMapping = {};
  for (const h of headers) {
    m[h] = AUTO_MAP_ALIASES[h.toLowerCase().trim()] ?? "skip";
  }
  return m;
}

/**
 * getMappingStatus: computes the visual status for a single CSV column's current mapping.
 * Uses AUTO_MAP_ALIASES to infer what the column "should" be, then evaluates the actual assignment.
 *
 * Rules:
 * - Mapped to a sensitive CRM field          -> "sensitive"
 * - Skipped, but alias is a sensitive field  -> "sensitive" (e.g. SSN skipped = correct, still flagged)
 * - Skipped, but alias is a required field   -> "required" (red warning)
 * - Mapped to a non-sensitive CRM field      -> "mapped"
 * - Skipped with no notable alias            -> "unmapped"
 */
function getMappingStatus(csvHeader: string, crmKey: string): MappingStatus {
  const aliasKey = AUTO_MAP_ALIASES[csvHeader.toLowerCase().trim()];
  const targetField = CRM_CONSTITUENT_FIELDS.find((f) => f.key === crmKey);
  const aliasField = aliasKey ? CRM_CONSTITUENT_FIELDS.find((f) => f.key === aliasKey) : undefined;

  if (crmKey !== "skip") {
    return targetField?.sensitive ? "sensitive" : "mapped";
  }
  // Currently set to skip — check what the alias implies
  if (aliasField?.sensitive) return "sensitive";
  if (aliasField?.required) return "required";
  return "unmapped";
}

/**
 * formatPhone: normalizes a raw phone string to (xxx) xxx-xxxx US format.
 * Handles 10-digit and 11-digit (leading 1) numbers. Returns raw value if unrecognized.
 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1")
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

/** CRM field keys that contain phone numbers — all get formatPhone() applied */
const PHONE_FIELDS = new Set(["phone", "mobilePhone", "workPhone", "spousePhone"]);

/**
 * validateAndTransform: applies field-specific value transformations and validates required fields.
 * Returns valid (importable) rows plus per-row errors and file-level warnings.
 *
 * Transformations applied per field type:
 * - Phone fields:                      normalize to (xxx) xxx-xxxx
 * - state:                             uppercase + truncate to 2 characters
 * - holdMail:                          "True"/"False" -> "true"/"false"
 * - deceased / spouseDeceased:         "Yes"/"" -> "true"/"false"
 * - communicationPreferences:          "Email, Mail, Phone" -> "Email;Mail;Phone"
 *
 * @param allowOrgImport — when true, rows with no firstName/lastName are imported as
 *   ORGANIZATION records if organizationName or displayName is available as a fallback.
 */
function validateAndTransform(
  rows: RawRow[],
  mapping: FieldMapping,
  allowOrgImport = true,
): ValidationResult {
  const valid: MappedRow[] = [];
  const errors: Array<{ row: number; field: string; message: string }> = [];
  // When allowOrgImport is enabled, firstName/lastName are not globally required —
  // org records are allowed through via the org-fallback logic below.
  const requiredFields = allowOrgImport
    ? CRM_CONSTITUENT_FIELDS.filter((f) => f.required && f.key !== "firstName" && f.key !== "lastName")
    : CRM_CONSTITUENT_FIELDS.filter((f) => f.required);

  rows.forEach((rawRow, i) => {
    const mapped: MappedRow = {};
    let rowHasError = false;

    for (const [csvCol, crmKey] of Object.entries(mapping)) {
      if (crmKey === "skip") continue;
      let value = (rawRow[csvCol] ?? "").trim();

      // Apply field-specific transformations
      if (PHONE_FIELDS.has(crmKey)) {
        value = formatPhone(value);
      } else if (crmKey === "state") {
        value = value.toUpperCase().slice(0, 2);
      } else if (crmKey === "holdMail") {
        value = value.toLowerCase() === "true" ? "true" : "false";
      } else if (crmKey === "deceased" || crmKey === "spouseDeceased") {
        value = value.toLowerCase() === "yes" || value.toLowerCase() === "true" ? "true" : "false";
      } else if (crmKey === "communicationPreferences") {
        // "Email, Mail, Phone, Text" -> "Email;Mail;Phone;Text"
        value = value.split(",").map((v) => v.trim()).filter(Boolean).join(";");
      }

      if (value !== "") mapped[crmKey] = value;
    }

    // Organisation-fallback: if no firstName/lastName but allowOrgImport is on,
    // try to derive a name from organizationName or displayName and tag as org.
    if (allowOrgImport && !mapped["firstName"] && !mapped["lastName"]) {
      const orgName = mapped["organizationName"] || mapped["displayName"] || "";
      if (orgName) {
        // Use the org/display name as the record's lastName (how the CRM stores orgs)
        // and mark it so the API can set ConstituentType = ORGANIZATION.
        mapped["lastName"] = orgName;
        mapped["_isOrg"] = "true";
      } else {
        // Truly empty — no name at all, skip it
        errors.push({ row: i + 1, field: "lastName", message: `Row ${i + 1}: no name or organization name found — record skipped` });
        rowHasError = true;
      }
    }

    // Validate remaining required fields (firstName/lastName already handled above)
    for (const f of requiredFields) {
      if (!mapped[f.key]) {
        errors.push({ row: i + 1, field: f.key, message: `Row ${i + 1}: required field "${f.label}" is empty` });
        rowHasError = true;
      }
    }

    if (!rowHasError) valid.push(mapped);
  });

  const warnings: string[] = [];
  const orgRows = valid.filter((r) => r["_isOrg"] === "true").length;
  if (orgRows > 0) {
    warnings.push(`${orgRows} record(s) have no first/last name and will be imported as Organizations.`);
  }
  if (errors.length > 0) {
    warnings.push(`${errors.length} row(s) have missing required fields and will be skipped.`);
  }

  return { valid, errors, warnings };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * CircularProgress: SVG donut ring that fills clockwise to represent a percentage.
 * Used in the Step 2 mapping summary header to show how many fields have been mapped.
 */
function CircularProgress({ pct, size = 52, color = "#16a34a" }: { pct: number; size?: number; color?: string }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const cx = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.12} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.12}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
    </svg>
  );
}

/**
 * StatCard: compact metric card showing a bold value, label, and optional sub-label.
 * Used in Step 1 file info, Step 2 mapping summary, and Step 3 validation summary.
 */
function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-white border border-gray-100 rounded-lg px-4 py-2 min-w-[80px] shadow-sm">
      <span className={`text-xl font-bold tabular-nums ${accent ?? "text-gray-800"}`}>{value}</span>
      <span className="text-[11px] font-medium text-gray-500 mt-0.5 text-center">{label}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
}

/**
 * StepperSidebar: left navigation column showing all 5 wizard steps.
 * Completed steps show a green checkmark; the active step is highlighted with a green ring.
 */
function StepperSidebar({ current }: { current: number }) {
  return (
    <div className="flex flex-col gap-1 py-3 px-2 border-r border-gray-100 bg-gray-50 h-full">
      {STEPS.map((s) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-md">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              done
                ? "bg-green-600 text-white"
                : active
                  ? "bg-green-100 text-green-700 ring-2 ring-green-400"
                  : "bg-gray-200 text-gray-400"
            }`}>
              {done ? "✓" : s.id}
            </span>
            <span className={`text-xs font-medium leading-tight ${
              active ? "text-green-700" : done ? "text-gray-600" : "text-gray-400"
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * FieldDetailsPanel: right panel in Step 2 showing statistics for the selected CSV column.
 * Displays fill rate, unique count, inferred type, sample values, and the mapped CRM field.
 */
function FieldDetailsPanel({
  col, stats, mapping,
}: {
  col: string | null; stats: Record<string, ColumnStats>; mapping: FieldMapping;
}) {
  if (!col) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4 text-center bg-gray-50 border-l border-gray-100">
        <span className="text-3xl mb-2">👆</span>
        <p className="text-xs">Click a row to see column details</p>
      </div>
    );
  }

  const s = stats[col];
  const crmKey = mapping[col] ?? "skip";
  const crmField = CRM_CONSTITUENT_FIELDS.find((f) => f.key === crmKey);

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 border-l border-gray-100 overflow-y-auto h-full">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Selected Column</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate" title={col}>{col}</p>
      </div>

      {s && (
        <>
          {/* Fill rate, unique count, type badges */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col items-center bg-white border border-gray-100 rounded-lg px-3 py-1.5 shadow-sm min-w-[52px]">
              <span className="text-base font-bold text-gray-800">{s.fillRate}%</span>
              <span className="text-[10px] text-gray-400">Fill</span>
            </div>
            <div className="flex flex-col items-center bg-white border border-gray-100 rounded-lg px-3 py-1.5 shadow-sm min-w-[52px]">
              <span className="text-base font-bold text-gray-800">{s.uniqueCount}</span>
              <span className="text-[10px] text-gray-400">Unique</span>
            </div>
            <div className="flex flex-col items-center bg-white border border-gray-100 rounded-lg px-3 py-1.5 shadow-sm min-w-[52px]">
              <span className="text-[11px] font-bold text-gray-800">{s.detectedType}</span>
              <span className="text-[10px] text-gray-400">Type</span>
            </div>
          </div>

          {/* Sample values */}
          {s.sampleValues.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Samples</p>
              <div className="flex flex-col gap-1">
                {s.sampleValues.map((v, i) => (
                  <span
                    key={i}
                    className="text-xs bg-white border border-gray-100 rounded px-2 py-0.5 text-gray-700 truncate"
                    title={v}
                  >
                    {v || "(empty)"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Mapped-to field info */}
      {crmField && crmKey !== "skip" && (
        <div className="mt-auto pt-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Mapped To</p>
          <div className={`rounded-lg px-3 py-2 border text-xs ${
            crmField.sensitive
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}>
            <p className="font-semibold">{crmField.label}</p>
            <p className="text-[10px] mt-0.5 opacity-70">
              {crmField.group}
              {crmField.sensitive ? " · Sensitive PII" : ""}
              {crmField.required ? " · Required" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ImportWizard: full 5-step constituent CSV import experience.
 *
 * Steps:
 *   1. Upload File        — drag-drop or click-to-upload; auto-detects eKYROS title rows
 *   2. Map Fields         — column-to-CRM-field assignment table with smart auto-suggestions
 *   3. Review & Validate  — field transformation preview + error and warning summary
 *   4. Import Settings    — mode (create/upsert/update), record type, dedup, dry-run toggle
 *   5. Confirm & Import   — final summary + POST to /api/constituents/import
 *
 * @param existingConstituents — used for client-side duplicate email count estimation
 */
export default function ImportWizard({ existingConstituents }: ImportWizardProps) {
  // ── Wizard step ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 1: Upload ───────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [columnStats, setColumnStats] = useState<Record<string, ColumnStats>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Field mapping ────────────────────────────────────────────────
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [colSearch, setColSearch] = useState("");

  // ── Step 3: Validation ───────────────────────────────────────────────────
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // ── Step 4: Import settings ──────────────────────────────────────────────
  const [importMode, setImportMode] = useState<ImportMode>("upsert");
  const [recordType, setRecordType] = useState<RecordType>("individual");
  const [dryRun, setDryRun] = useState(false);
  const [matchExtId, setMatchExtId] = useState(true);
  const [matchEmail, setMatchEmail] = useState(true);
  /** Import records with no first/last name as ORGANIZATION constituents when org name is available */
  const [allowOrgImport, setAllowOrgImport] = useState(true);
  /** When true, sample values in each column are scanned for church/ministry name patterns */
  const [churchDetectionMode, setChurchDetectionMode] = useState(true);

  // ── Step 5: Import result ────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; skipped: number; errors: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Derived / memoized values ─────────────────────────────────────────────

  /** Mapping status for every CSV column header */
  const statusMap = useMemo<Record<string, MappingStatus>>(() => {
    const m: Record<string, MappingStatus> = {};
    for (const [col, key] of Object.entries(mapping)) {
      m[col] = getMappingStatus(col, key);
    }
    return m;
  }, [mapping]);

  /** Count of columns in each status bucket */
  const statusCounts = useMemo(() => {
    const counts = { mapped: 0, required: 0, unmapped: 0, sensitive: 0 };
    for (const s of Object.values(statusMap)) counts[s]++;
    return counts;
  }, [statusMap]);

  /** Columns shown in the mapping table after filter + search are applied */
  const visibleCols = useMemo(() => {
    let cols = parseResult?.headers ?? [];
    if (statusFilter !== "all") cols = cols.filter((c) => statusMap[c] === statusFilter);
    if (colSearch.trim()) {
      const q = colSearch.toLowerCase();
      cols = cols.filter(
        (c) => c.toLowerCase().includes(q) || (mapping[c] ?? "").toLowerCase().includes(q),
      );
    }
    return cols;
  }, [parseResult?.headers, statusFilter, statusMap, colSearch, mapping]);

  /** Set of lowercased emails already in the CRM — used for dupe count estimate */
  const existingEmailSet = useMemo(
    () => new Set(existingConstituents.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]),
    [existingConstituents],
  );

  /** How many valid import rows collide with existing email addresses */
  const dupCount = useMemo(() => {
    if (!validationResult) return 0;
    return validationResult.valid.filter(
      (row) => row.email && existingEmailSet.has(row.email.toLowerCase()),
    ).length;
  }, [validationResult, existingEmailSet]);

  /** Data-quality observations derived from column statistics — shown in Step 1 */
  const dataWarnings = useMemo<string[]>(() => {
    if (!parseResult) return [];
    const w: string[] = [];
    const emptyCols = parseResult.headers.filter((h) => (columnStats[h]?.fillRate ?? 0) === 0);
    if (emptyCols.length > 0) {
      w.push(`${emptyCols.length} column(s) are completely empty: ${emptyCols.slice(0, 5).join(", ")}${emptyCols.length > 5 ? "…" : ""}`);
    }
    const ageStat = columnStats["Age"] ?? columnStats["age"];
    if (ageStat && ageStat.uniqueCount <= 1) {
      w.push("'Age' column contains only one unique value (always 0 in eKYROS exports) — mapped to Skip by default.");
    }
    const locStat = columnStats["Location"] ?? columnStats["location"];
    if (locStat && locStat.uniqueCount === 1) {
      w.push(`'Location' always "${locStat.sampleValues[0]}" in this file — all records will share this location value.`);
    }
    return w;
  }, [parseResult, columnStats]);

  // ── File handling ─────────────────────────────────────────────────────────

  /**
   * processFile: reads a File object, parses CSV content, computes column stats,
   * and auto-maps headers using the alias table. Called on file drop or file input change.
   */
  const processFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);
      const stats = computeColumnStats(result.headers, result.rows);
      setParseResult(result);
      setColumnStats(stats);

      // Build initial auto-mapping from column name aliases
      const initialMapping = autoMap(result.headers);

      // Smart church/ministry detection: when enabled, scan sample values of any
      // currently-unmapped column for denomination keywords, then suggest churchAffiliation
      if (churchDetectionMode) {
        for (const header of result.headers) {
          if (initialMapping[header] === "skip") {
            const samples = stats[header]?.sampleValues ?? [];
            if (detectChurchValues(samples)) {
              initialMapping[header] = "churchAffiliation";
            }
          }
        }
      }

      setMapping(initialMapping);
      setSelectedCol(result.headers[0] ?? null);
      // Reset downstream state when a new file is loaded
      setValidationResult(null);
      setImportResult(null);
      setImportError(null);
    };
    reader.readAsText(f);
  }, [churchDetectionMode]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) processFile(dropped);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) processFile(f);
    },
    [processFile],
  );

  // ── Import API call ───────────────────────────────────────────────────────

  /** POST validated records to the constituents import endpoint */
  async function runImport() {
    if (!validationResult) return;
    setImporting(true);
    setImportError(null);
    try {
      // TODO: add import history + rollback endpoint integration before production.
      const res = await apiFetch<{ created: number; updated: number; skipped: number; errors: number }>(
        "/api/constituents/import",
        {
          method: "POST",
          body: JSON.stringify({
            records: validationResult.valid,
            mode: importMode,
            dryRun,
            recordType,
            matchExtId,
            matchEmail,
            allowOrgImport,
          }),
        },
      );
      setImportResult(res);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  /**
   * renderFieldSelect: builds the CRM field dropdown for one CSV column row.
   * Options are grouped by field group using optgroup elements.
   */
  function renderFieldSelect(csvCol: string) {
    const current = mapping[csvCol] ?? "skip";
    return (
      <select
        value={current}
        onChange={(e) => setMapping((prev) => ({ ...prev, [csvCol]: e.target.value }))}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
      >
        <option value="skip">— Do Not Import —</option>
        {Object.entries(FIELD_GROUPS).map(([group, fields]) => (
          <optgroup key={group} label={group}>
            {(fields as CrmField[]).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}{f.required ? " *" : ""}{f.sensitive ? " 🔒" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  // ─── Step renders ─────────────────────────────────────────────────────────

  /** Step 1: drag-drop file upload zone with file info and data quality notes */
  function renderStep1() {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Upload CSV File</h2>
          <p className="text-sm text-gray-500 mt-1">
            Supports eKYROS &ldquo;Donor File Address List&rdquo; exports and standard constituent CSVs.
            Column headers are auto-detected even when the file contains title rows above the data.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 px-6 cursor-pointer transition-colors ${
            dragOver
              ? "border-green-500 bg-green-50"
              : "border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileInput}
          />
          <span className="text-4xl mb-3">{file ? "📄" : "📂"}</span>
          {file ? (
            <div className="text-center">
              <p className="font-semibold text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {parseResult
                  ? `${parseResult.rows.length.toLocaleString()} records · ${parseResult.headers.length} columns · headers on row ${parseResult.detectedHeaderRow}`
                  : "Parsing…"}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-semibold text-gray-700">Drop CSV here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">Accepts .csv or .txt · Processed entirely in your browser</p>
            </div>
          )}
        </div>

        {/* Data quality warnings */}
        {dataWarnings.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-700 mb-1.5">Data Quality Notes</p>
            <ul className="list-disc list-inside space-y-1">
              {dataWarnings.map((w, i) => (
                <li key={i} className="text-xs text-orange-700">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* File stats */}
        {parseResult && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Records" value={parseResult.rows.length.toLocaleString()} />
            <StatCard label="Columns" value={parseResult.headers.length} />
            <StatCard label="Header Row" value={parseResult.detectedHeaderRow} />
            <StatCard
              label="Auto-Mapped"
              value={Object.values(mapping).filter((v) => v !== "skip").length}
              accent="text-green-600"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!parseResult}
            onClick={() => setStep(2)}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Map Fields →
          </button>
        </div>
      </div>
    );
  }

  /**
   * Step 2: 3-panel field mapping interface.
   * Left panel: stepper sidebar. Center: scrollable mapping table with filter/search.
   * Right panel: column statistics and details for the selected row.
   */
  function renderStep2() {
    if (!parseResult) return null;
    const total = parseResult.headers.length;
    const mappedPct = total > 0 ? Math.round((statusCounts.mapped / total) * 100) : 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Header row with progress ring */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Map Fields</h2>
            <p className="text-sm text-gray-500">
              Match each CSV column to the right CRM field. Required fields are marked with *.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <CircularProgress pct={mappedPct} size={48} />
            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">{statusCounts.mapped}/{total}</p>
              <p className="text-xs text-gray-400">mapped</p>
            </div>
          </div>
        </div>

        {/* Status filter tabs + search */}
        <div className="flex gap-2 flex-wrap items-center">
          {(["all", "mapped", "required", "unmapped", "sensitive"] as const).map((f) => {
            const count = f === "all" ? total : statusCounts[f as MappingStatus];
            const label = f === "all" ? "All" : STATUS_DISPLAY[f as MappingStatus].label;
            const active = statusFilter === f;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
          <input
            type="text"
            placeholder="Search columns…"
            value={colSearch}
            onChange={(e) => setColSearch(e.target.value)}
            className="ml-auto text-xs border border-gray-200 rounded-lg px-3 py-1 w-44 focus:outline-none focus:ring-1 focus:ring-green-400"
          />
        </div>

        {/* 3-panel layout */}
        <div
          className="flex rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          style={{ height: "480px" }}
        >
          {/* Left: stepper sidebar */}
          <div className="w-44 flex-shrink-0">
            <StepperSidebar current={step} />
          </div>

          {/* Center: mapping table */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold w-6">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">CSV Column</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold w-28">Sample</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-semibold w-6">→</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold w-48">CRM Field</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleCols.map((col, idx) => {
                  const status = statusMap[col] ?? "unmapped";
                  const sample = (columnStats[col]?.sampleValues ?? []).slice(0, 2).join(", ");
                  const isSelected = selectedCol === col;
                  return (
                    <tr
                      key={col}
                      onClick={() => setSelectedCol(col)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50"
                          : STATUS_DISPLAY[status].row + " hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-300 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate" title={col}>
                        {col}
                      </td>
                      <td className="px-3 py-2 text-gray-400 max-w-[112px] truncate" title={sample}>
                        {sample}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-300">→</td>
                      <td className="px-3 py-2">{renderFieldSelect(col)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_DISPLAY[status].badge}`}>
                          {STATUS_DISPLAY[status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {visibleCols.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">
                      No columns match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right: field details panel */}
          <div className="w-56 flex-shrink-0">
            <FieldDetailsPanel col={selectedCol} stats={columnStats} mapping={mapping} />
          </div>
        </div>

        {/* Required field warning — softened when allowOrgImport is on since orgs skip first/last name */}
        {statusCounts.required > 0 && (
          <div className={`rounded-lg border px-4 py-2 text-xs ${allowOrgImport ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {allowOrgImport
              ? `ℹ ${statusCounts.required} required field(s) are set to skip. Records without First/Last Name will be imported as Organizations if an Organization Name is mapped.`
              : `⚠ ${statusCounts.required} required field(s) are currently set to skip. Map First Name and Last Name before continuing.`
            }
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            disabled={!allowOrgImport && statusCounts.required > 0}
            onClick={() => {
              const result = validateAndTransform(parseResult.rows, mapping, allowOrgImport);
              setValidationResult(result);
              setStep(3);
            }}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Validate →
          </button>
        </div>
      </div>
    );
  }

  /** Step 3: validation results — error list, warnings, and first-5-row preview */
  function renderStep3() {
    if (!validationResult || !parseResult) return null;
    const { valid, errors, warnings } = validationResult;
    const total = parseResult.rows.length;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Review &amp; Validate</h2>
          <p className="text-sm text-gray-500">
            Fields have been transformed and validated. Review any issues before continuing.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Rows" value={total.toLocaleString()} />
          <StatCard label="Ready" value={valid.length.toLocaleString()} accent="text-green-600" />
          <StatCard
            label="Row Errors"
            value={errors.length}
            accent={errors.length > 0 ? "text-red-600" : "text-gray-400"}
          />
          <StatCard
            label="Warnings"
            value={warnings.length}
            accent={warnings.length > 0 ? "text-orange-500" : "text-gray-400"}
          />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-700 mb-1.5">Warnings</p>
            <ul className="list-disc list-inside space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-orange-700">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Row errors */}
        {errors.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-600 mb-2">
              Rows with errors (will be skipped):
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-red-100 border-b border-red-200">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-red-700 font-semibold">Row</th>
                    <th className="text-left px-3 py-1.5 text-red-700 font-semibold">Field</th>
                    <th className="text-left px-3 py-1.5 text-red-700 font-semibold">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.slice(0, 50).map((e, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="px-3 py-1 text-red-600 tabular-nums">{e.row}</td>
                      <td className="px-3 py-1 text-red-600">{e.field}</td>
                      <td className="px-3 py-1 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                  {errors.length > 50 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1 text-red-400 italic">
                        … and {errors.length - 50} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview of first 5 valid rows */}
        {valid.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Preview — first 5 valid rows (up to 8 fields shown):
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {Object.keys(valid[0]).slice(0, 8).map((k) => (
                      <th key={k} className="text-left px-3 py-1.5 text-gray-500 font-semibold whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valid.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {Object.keys(valid[0]).slice(0, 8).map((k) => (
                        <td key={k} className="px-3 py-1 text-gray-700 truncate max-w-[120px]" title={row[k]}>
                          {row[k] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep(2)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            disabled={valid.length === 0}
            onClick={() => setStep(4)}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Import Settings →
          </button>
        </div>
      </div>
    );
  }

  /** Step 4: import mode, record type, dedup options, and dry-run toggle */
  function renderStep4() {
    const modeLabels: Record<ImportMode, { title: string; desc: string }> = {
      create_only:  { title: "Create Only",   desc: "New records only; skip if a match is found" },
      upsert:       { title: "Upsert",        desc: "Create new records + update existing matches" },
      update_only:  { title: "Update Only",   desc: "Update existing matches; skip new records" },
    };

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Import Settings</h2>
          <p className="text-sm text-gray-500">
            Configure how records are created or updated and how duplicates are detected.
          </p>
        </div>

        {/* Import mode */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Import Mode</p>
          <div className="flex gap-3">
            {(Object.keys(modeLabels) as ImportMode[]).map((m) => (
              <label
                key={m}
                className={`flex-1 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  importMode === m
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <input
                  type="radio" name="importMode" value={m}
                  checked={importMode === m} onChange={() => setImportMode(m)}
                  className="sr-only"
                />
                <p className="text-sm font-semibold text-gray-800">{modeLabels[m].title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{modeLabels[m].desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Record type */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Record Type</p>
          <div className="flex gap-3">
            {(["individual", "organization"] as const).map((r) => (
              <label
                key={r}
                className={`flex-1 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  recordType === r
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <input
                  type="radio" name="recordType" value={r}
                  checked={recordType === r} onChange={() => setRecordType(r)}
                  className="sr-only"
                />
                <p className="text-sm font-semibold text-gray-800 capitalize">{r}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Organization / mixed-record handling */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Organization &amp; Mixed Records</p>
          <label className="flex items-start gap-3 cursor-pointer border border-gray-200 rounded-lg px-4 py-3 hover:border-green-300 transition-colors">
            <input
              type="checkbox" checked={allowOrgImport}
              onChange={(e) => setAllowOrgImport(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-400"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">Import records without First/Last Name as Organizations</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Churches, businesses, and other organizations in this file often have no individual name.
                When enabled, those records use the Organization Name as their display name and are tagged
                as <span className="font-medium text-gray-700">ORGANIZATION</span> constituents.
              </p>
              {allowOrgImport && validationResult && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  ✓ {validationResult.valid.filter((r) => r["_isOrg"] === "true").length} org record(s) detected in this file
                </p>
              )}
            </div>
          </label>
        </div>

        {/* Duplicate detection */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Duplicate Detection</p>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox" checked={matchExtId}
                onChange={(e) => setMatchExtId(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-400"
              />
              <span className="text-sm text-gray-700">Match on External Source ID (DirID)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox" checked={matchEmail}
                onChange={(e) => setMatchEmail(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-400"
              />
              <span className="text-sm text-gray-700">Match on Email Address</span>
            </label>
          </div>
          {dupCount > 0 && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠ {dupCount} record(s) match existing email addresses in the CRM.
            </p>
          )}
        </div>

        {/* Dry run toggle */}
        <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-blue-800">Dry Run Mode</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Simulate the import without saving any data. Useful for checking results first.
            </p>
          </div>
          <button
            onClick={() => setDryRun((v) => !v)}
            aria-pressed={dryRun}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              dryRun ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                dryRun ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Smart detection toggle */}
        <div className="flex items-center justify-between border border-purple-200 bg-purple-50 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-purple-800">⛪ Smart Church/Ministry Detection</p>
            <p className="text-xs text-purple-600 mt-0.5">
              When re-uploading a file, scan column values for church and denomination names and
              automatically suggest the <strong>Church Affiliation</strong> field.
            </p>
          </div>
          <button
            onClick={() => setChurchDetectionMode((v) => !v)}
            aria-pressed={churchDetectionMode}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              churchDetectionMode ? "bg-purple-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                churchDetectionMode ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setStep(3)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep(5)}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Review &amp; Confirm →
          </button>
        </div>
      </div>
    );
  }

  /** Step 5: final confirmation summary + import / dry-run button + result display */
  function renderStep5() {
    if (!validationResult) return null;

    // Show results after a completed import
    if (importResult) {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
            {dryRun ? "🔬" : "✅"}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800">
              {dryRun ? "Dry Run Complete" : "Import Complete!"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {dryRun
                ? "No data was saved. Review results below, then turn off Dry Run to import for real."
                : "Records have been saved to the CRM."}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4 w-full max-w-lg">
            <StatCard label="Created" value={importResult.created} accent="text-green-600" />
            <StatCard label="Updated" value={importResult.updated} accent="text-blue-600" />
            <StatCard label="Skipped" value={importResult.skipped} />
            <StatCard label="Errors" value={importResult.errors} accent={importResult.errors > 0 ? "text-red-600" : "text-gray-400"} />
          </div>
          <button
            onClick={() => {
              setStep(1);
              setFile(null);
              setParseResult(null);
              setValidationResult(null);
              setImportResult(null);
              setImportError(null);
            }}
            className="px-5 py-2 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Start New Import
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Confirm &amp; Import</h2>
          <p className="text-sm text-gray-500">Review your settings and start the import.</p>
        </div>

        {/* Settings summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">File</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{file?.name ?? "—"}</p>
            <p className="text-xs text-gray-500">
              {validationResult.valid.length} valid rows
              {validationResult.errors.length > 0
                ? ` · ${validationResult.errors.length} skipped`
                : ""}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Settings</p>
            <p className="text-sm font-semibold text-gray-800 capitalize">
              {importMode.replace("_", " ")} · {recordType}
            </p>
            <p className="text-xs text-gray-500">
              {[matchExtId && "Match ExtID", matchEmail && "Match Email"].filter(Boolean).join(" · ") || "No dedup matching"}
              {dryRun ? " · DRY RUN" : ""}
            </p>
          </div>
        </div>

        {dryRun && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
            🔬 <strong>Dry Run Mode is ON.</strong> No data will be saved.
            Toggle it off in Import Settings to perform the real import.
          </div>
        )}

        {importError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
            ❌ {importError}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep(4)}
            disabled={importing}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            onClick={runImport}
            disabled={importing}
            className={`px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 ${
              dryRun ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {importing
              ? "Importing…"
              : dryRun
                ? "🔬 Run Dry Run"
                : `Import ${validationResult.valid.length.toLocaleString()} Records`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Progress bar across the top */}
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
        {STEPS.map((s, i) => (
          <Fragment key={s.id}>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  s.id < step
                    ? "bg-green-600 text-white"
                    : s.id === step
                      ? "bg-green-100 text-green-700 ring-2 ring-green-400"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.id < step ? "✓" : s.id}
              </span>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  s.id === step ? "text-green-700" : s.id < step ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${s.id < step ? "bg-green-300" : "bg-gray-100"}`} />
            )}
          </Fragment>
        ))}
      </div>

      {/* Active step content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  );
}
