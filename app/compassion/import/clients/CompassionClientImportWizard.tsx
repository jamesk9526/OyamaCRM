"use client";
// Compassion CRM — 5-step client CSV import wizard.
// Blue-themed mirror of app/data-tools/import/ImportWizard.tsx.
// Uses csvParser for parsing (with auto-delimiter detection) and the dedicated
// clientImportValidator module for all validation/transformation logic.

import { useState, useRef, useCallback, useMemo, Fragment } from "react";
import {
  COMPASSION_CLIENT_FIELDS,
  COMPASSION_AUTO_MAP_ALIASES,
  COMPASSION_FIELD_GROUPS,
  COMPASSION_SENSITIVE_FIELDS,
} from "./compassionFieldMap";
import type { CompassionClientField } from "./compassionFieldMap";
import {
  validateAndTransformClients,
  issuesToCsv,
  type FieldMapping,
  type ClientValidationResult,
} from "./clientImportValidator";
import { parseCSV, computeColumnStats } from "@/app/data-tools/import/csvParser";
import type { CsvParseResult, ColumnStats, Delimiter } from "@/app/data-tools/import/csvParser";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Visual status badge variant for each CSV column's current mapping assignment */
type MappingStatus = "mapped" | "required" | "unmapped" | "sensitive";

/** Status filter applied to the mapping table ("all" shows all rows) */
type StatusFilter = "all" | MappingStatus;

/** How to handle existing client records during import */
type ImportMode = "create_only" | "upsert" | "update_only";

/** Import API response shape */
interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
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
 * Uses blue instead of green to match Compassion CRM theming.
 */
const STATUS_DISPLAY: Record<MappingStatus, { label: string; badge: string; row: string }> = {
  mapped:    { label: "Mapped",    badge: "bg-blue-50 text-blue-700 border border-blue-200",     row: "" },
  required:  { label: "Required",  badge: "bg-red-50 text-red-600 border border-red-200",         row: "bg-red-50/30" },
  unmapped:  { label: "Unmapped",  badge: "bg-orange-50 text-orange-600 border border-orange-200", row: "" },
  sensitive: { label: "Sensitive", badge: "bg-yellow-50 text-yellow-700 border border-yellow-200", row: "bg-yellow-50/30" },
};

/** Status mapping table shown in Step 4 for user reference */
const STATUS_MAP_DISPLAY = [
  { source: "Active",     crm: "ACTIVE",    color: "text-green-700 bg-green-50" },
  { source: "InActive",   crm: "INACTIVE",  color: "text-gray-600 bg-gray-50" },
  { source: "Closed",     crm: "ARCHIVED",  color: "text-gray-600 bg-gray-100" },
  { source: "Archived",   crm: "ARCHIVED",  color: "text-gray-600 bg-gray-100" },
  { source: "Pending",    crm: "PENDING",   color: "text-yellow-700 bg-yellow-50" },
  { source: "Graduated",  crm: "GRADUATED", color: "text-blue-700 bg-blue-50" },
  { source: "(blank)",    crm: "ACTIVE",    color: "text-green-700 bg-green-50" },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Module-level constant — avoids recreating on every render of Step 1. */
const DELIMITER_LABELS: Record<Exclude<Delimiter, "auto">, string> = {
  ",": "Comma",
  "\t": "Tab",
  ";": "Semicolon",
  "|": "Pipe",
};

/**
 * autoMap: generates an initial FieldMapping by looking up each CSV header in
 * COMPASSION_AUTO_MAP_ALIASES. Headers not found default to "skip".
 */
function autoMap(headers: string[]): FieldMapping {
  const m: FieldMapping = {};
  for (const h of headers) {
    m[h] = COMPASSION_AUTO_MAP_ALIASES[h.toLowerCase().trim()] ?? "skip";
  }
  return m;
}

/**
 * getMappingStatus: computes the visual status badge for a single CSV column mapping.
 *
 * Rules:
 * - Mapped to a sensitive CRM field          -> "sensitive"
 * - Skipped, but alias is a sensitive field  -> "sensitive" (SSN skipped = still flagged)
 * - Skipped, but alias is a required field   -> "required"
 * - Mapped to a non-sensitive CRM field      -> "mapped"
 * - Skipped with no notable alias            -> "unmapped"
 */
function getMappingStatus(csvHeader: string, crmKey: string): MappingStatus {
  const aliasKey = COMPASSION_AUTO_MAP_ALIASES[csvHeader.toLowerCase().trim()];
  const targetField = COMPASSION_CLIENT_FIELDS.find((f) => f.key === crmKey);
  const aliasField = aliasKey ? COMPASSION_CLIENT_FIELDS.find((f) => f.key === aliasKey) : undefined;

  if (crmKey !== "skip") {
    return targetField?.sensitive ? "sensitive" : "mapped";
  }
  // Currently skipped — check what the alias implies
  if (COMPASSION_SENSITIVE_FIELDS.has(csvHeader.toLowerCase().trim())) return "sensitive";
  if (aliasField?.sensitive) return "sensitive";
  if (aliasField?.required) return "required";
  return "unmapped";
}

/**
 * downloadIssuesCsv: triggers a browser download of the validation issues as a CSV file.
 * Used by Step 3 "Download Error Report" button so users can fix and re-upload.
 */
function downloadIssuesCsv(result: ClientValidationResult, sourceFilename: string) {
  const csv = issuesToCsv(result.issues);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const baseName = sourceFilename.replace(/\.[^.]+$/, "") || "compassion-import";
  a.download = `${baseName}-import-issues.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * CircularProgress: SVG donut ring that fills clockwise to represent a percentage.
 * Used in the Step 2 mapping summary header to show how many fields have been mapped.
 */
function CircularProgress({ pct, size = 52, color = "#2563eb" }: { pct: number; size?: number; color?: string }) {
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
 * Completed steps show a blue checkmark; the active step is highlighted with a blue ring.
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
                ? "bg-blue-600 text-white"
                : active
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400"
                  : "bg-gray-200 text-gray-400"
            }`}>
              {done ? "✓" : s.id}
            </span>
            <span className={`text-xs font-medium leading-tight ${
              active ? "text-blue-700" : done ? "text-gray-600" : "text-gray-400"
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
  const crmField = COMPASSION_CLIENT_FIELDS.find((f) => f.key === crmKey);

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
              : "bg-blue-50 border-blue-200 text-blue-800"
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
 * CompassionClientImportWizard: full 5-step client CSV import experience for Compassion CRM.
 *
 * Steps:
 *   1. Upload File        — drag-drop or click-to-upload; auto-detects eKYROS title rows
 *                           Shows SSN blocking banner when SSN column detected.
 *   2. Map Fields         — column-to-CRM-field assignment table with blue-themed auto-suggestions
 *   3. Review & Validate  — field transformation preview + error and warning summary
 *   4. Import Settings    — mode (create/upsert/update), dedup, status mapping, dry-run toggle
 *   5. Confirm & Import   — final summary + POST to /api/compassion/clients/import
 *
 * Blue (#2563eb) accent color throughout instead of green to match Compassion CRM theming.
 */
export default function CompassionClientImportWizard() {
  // ── Wizard step ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 1: Upload ───────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [pasteText, setPasteText] = useState<string>("");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
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
  const [validationResult, setValidationResult] = useState<ClientValidationResult | null>(null);

  // ── Step 4: Import settings ──────────────────────────────────────────────
  const [importMode, setImportMode] = useState<ImportMode>("create_only");
  const [dryRun, setDryRun] = useState(true);
  const [matchExtId, setMatchExtId] = useState(true);
  const [matchEmail, setMatchEmail] = useState(true);

  // ── Step 5: Import result ────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Derived / memoized values ─────────────────────────────────────────────

  /** Whether the uploaded CSV contains an SSN column (triggers warning banner) */
  const hasSsnColumn = useMemo(() => {
    if (!parseResult) return false;
    return parseResult.headers.some((h) => COMPASSION_SENSITIVE_FIELDS.has(h.toLowerCase().trim()));
  }, [parseResult]);

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

  /** Data-quality observations derived from column statistics — shown in Step 1 */
  const dataWarnings = useMemo<string[]>(() => {
    if (!parseResult) return [];
    const w: string[] = [...parseResult.warnings];
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
      w.push(`'Location' always "${locStat.sampleValues[0]}" in this file — all records will share this referral source value.`);
    }
    return w;
  }, [parseResult, columnStats]);

  // ── File / text handling ─────────────────────────────────────────────────

  /**
   * processText: parses raw CSV/TSV/pasted text using the current delimiter setting,
   * computes column stats, and auto-maps headers using the compassion alias table.
   * Called whenever a file is loaded, text is pasted, or the delimiter dropdown changes.
   */
  const processText = useCallback((text: string, withDelimiter: Delimiter) => {
    setRawText(text);
    const result = parseCSV(text, withDelimiter);
    const stats = computeColumnStats(result.headers, result.rows);
    setParseResult(result);
    setColumnStats(stats);
    setMapping(autoMap(result.headers));
    setSelectedCol(result.headers[0] ?? null);
    // Reset downstream state when source changes
    setValidationResult(null);
    setImportResult(null);
    setImportError(null);
  }, []);

  /**
   * processFile: reads a File object and hands the text to processText.
   * Called on file drop or file input change.
   */
  const processFile = useCallback(
    (f: File) => {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (e) => processText((e.target?.result as string) ?? "", delimiter);
      reader.readAsText(f);
    },
    [processText, delimiter],
  );

  /**
   * applyDelimiterChange: re-parses the currently loaded text using the new delimiter.
   * Lets the user override auto-detection without re-uploading the file.
   */
  const applyDelimiterChange = useCallback(
    (next: Delimiter) => {
      setDelimiter(next);
      if (rawText) processText(rawText, next);
    },
    [rawText, processText],
  );

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

  /** POST validated client records to the Compassion import endpoint */
  async function runImport() {
    if (!validationResult) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiFetch<ImportResult>(
        "/api/compassion/clients/import",
        {
          method: "POST",
          body: JSON.stringify({
            records: validationResult.valid,
            mode: importMode,
            dryRun,
            matchExternalSourceId: matchExtId,
            matchEmail,
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
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="skip">— Do Not Import —</option>
        {Object.entries(COMPASSION_FIELD_GROUPS).map(([group, fields]) => (
          <optgroup key={group} label={group}>
            {(fields as CompassionClientField[]).map((f) => (
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

  /** Step 1: drag-drop file upload zone with SSN warning banner and data quality notes */
  function renderStep1() {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Upload CSV File</h2>
          <p className="text-sm text-gray-500 mt-1">
            Supports eKYROS &ldquo;Client File Address List&rdquo; exports, standard CSVs, TSVs,
            and pasted tabular text. The delimiter is auto-detected; you can override it below.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 px-6 cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileInput}
          />
          <span className="text-4xl mb-3">{file || rawText ? "📄" : "📂"}</span>
          {file || (rawText && !file) ? (
            <div className="text-center">
              <p className="font-semibold text-gray-800">{file?.name ?? "Pasted text"}</p>
              <p className="text-sm text-gray-500 mt-1">
                {parseResult
                  ? `${parseResult.rows.length.toLocaleString()} records · ${parseResult.headers.length} columns · headers on row ${parseResult.detectedHeaderRow} · ${DELIMITER_LABELS[parseResult.delimiter]}-delimited`
                  : "Parsing…"}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-semibold text-gray-700">Drop CSV here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">
                Accepts .csv, .tsv, .txt · Processed entirely in your browser
              </p>
            </div>
          )}
        </div>

        {/* Delimiter override + paste tabular data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Delimiter</label>
            <select
              value={delimiter}
              onChange={(e) => applyDelimiterChange(e.target.value as Delimiter)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="auto">Auto-detect</option>
              <option value=",">Comma (,)</option>
              <option value="\t">Tab</option>
              <option value=";">Semicolon (;)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              … or paste tabular data
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste CSV / TSV rows here (including the header row)…"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono"
              />
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={() => {
                  setFile(null);
                  processText(pasteText, delimiter);
                }}
                className="px-3 py-2 text-xs font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-40"
              >
                Parse Text
              </button>
            </div>
          </div>
        </div>

        {/* SSN blocking warning banner — shown when SSN column detected */}
        {hasSsnColumn && (
          <div className="rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl flex-shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-bold text-yellow-800">Sensitive Field Detected: SSN Column</p>
                <p className="text-sm text-yellow-700 mt-1">
                  The column <strong>&quot;SSN&quot;</strong> contains sensitive Social Security Numbers.
                  This field is <strong>blocked</strong> and will <strong>NOT</strong> be imported.
                  For security, SSN values will never be stored in OyamaCRM.
                  The column has been automatically set to &ldquo;Do Not Import&rdquo;.
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  If you need encrypted sensitive field storage, contact your administrator.
                </p>
              </div>
            </div>
          </div>
        )}

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
              accent="text-blue-600"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={!parseResult}
            onClick={() => setStep(2)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              Match each CSV column to the right Compassion CRM field. Required fields are marked with *.
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
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
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
            className="ml-auto text-xs border border-gray-200 rounded-lg px-3 py-1 w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
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

        {/* Required field warning */}
        {statusCounts.required > 0 && (
          <div className="rounded-lg border bg-red-50 border-red-200 px-4 py-2 text-xs text-red-700">
            ⚠ {statusCounts.required} required field(s) are currently set to skip. Map First Name and Last Name before continuing.
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
            disabled={statusCounts.required > 0}
            onClick={() => {
              const result = validateAndTransformClients(parseResult.rows, mapping);
              setValidationResult(result);
              setStep(3);
            }}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Validate →
          </button>
        </div>
      </div>
    );
  }

  /** Step 3: validation results — error+warning list, file warnings, downloadable report, preview */
  function renderStep3() {
    if (!validationResult || !parseResult) return null;
    const { valid, issues, warnings, counts } = validationResult;
    const errorIssues = issues.filter((i) => i.severity === "error");
    const warningIssues = issues.filter((i) => i.severity === "warning");
    const total = parseResult.rows.length;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Review &amp; Validate</h2>
            <p className="text-sm text-gray-500">
              Fields have been transformed and validated. Garbage rows are filtered out automatically.
            </p>
          </div>
          {issues.length > 0 && (
            <button
              type="button"
              onClick={() => downloadIssuesCsv(validationResult, file?.name ?? "compassion-import")}
              className="px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50"
            >
              ⬇ Download Error Report ({issues.length})
            </button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Rows" value={total.toLocaleString()} />
          <StatCard label="Ready" value={valid.length.toLocaleString()} accent="text-blue-600" />
          <StatCard
            label="Garbage Skipped"
            value={counts.skippedGarbage}
            accent={counts.skippedGarbage > 0 ? "text-red-600" : "text-gray-400"}
            sub="report/widget rows"
          />
          <StatCard
            label="Errors"
            value={errorIssues.length}
            accent={errorIssues.length > 0 ? "text-red-600" : "text-gray-400"}
          />
          <StatCard
            label="Warnings"
            value={warningIssues.length}
            accent={warningIssues.length > 0 ? "text-orange-500" : "text-gray-400"}
            sub={counts.duplicatesInFile > 0 ? `${counts.duplicatesInFile} dup` : undefined}
          />
        </div>

        {/* File-level warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold text-orange-700 mb-1.5">File-level notes</p>
            <ul className="list-disc list-inside space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-orange-700">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-row issues table (errors first, then warnings) */}
        {issues.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">
              Row issues ({errorIssues.length} error{errorIssues.length !== 1 ? "s" : ""},{" "}
              {warningIssues.length} warning{warningIssues.length !== 1 ? "s" : ""})
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-gray-600 font-semibold w-14">Row</th>
                    <th className="text-left px-3 py-1.5 text-gray-600 font-semibold w-20">Severity</th>
                    <th className="text-left px-3 py-1.5 text-gray-600 font-semibold w-28">Field</th>
                    <th className="text-left px-3 py-1.5 text-gray-600 font-semibold">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...errorIssues, ...warningIssues].slice(0, 100).map((e, i) => (
                    <tr
                      key={i}
                      className={`border-t ${
                        e.severity === "error" ? "border-red-100 bg-red-50/40" : "border-orange-100 bg-orange-50/30"
                      }`}
                    >
                      <td className="px-3 py-1 tabular-nums text-gray-600">{e.row}</td>
                      <td className="px-3 py-1">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            e.severity === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-gray-600">{e.field}</td>
                      <td className="px-3 py-1 text-gray-700">{e.message}</td>
                    </tr>
                  ))}
                  {issues.length > 100 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-1 text-gray-400 italic text-center">
                        … and {issues.length - 100} more — download the error report for the full list.
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
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next: Import Settings →
          </button>
        </div>
      </div>
    );
  }

  /** Step 4: import mode, dedup options, status mapping table, and dry-run toggle */
  function renderStep4() {
    const modeLabels: Record<ImportMode, { title: string; desc: string }> = {
      create_only: { title: "Create Only",  desc: "New clients only; skip if a match is found" },
      upsert:      { title: "Upsert",       desc: "Create new clients + update existing matches" },
      update_only: { title: "Update Only",  desc: "Update existing matches; skip new clients" },
    };

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Import Settings</h2>
          <p className="text-sm text-gray-500">
            Configure how client records are created or updated and how duplicates are detected.
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
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300"
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

        {/* Duplicate detection */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Duplicate Detection</p>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox" checked={matchExtId}
                onChange={(e) => setMatchExtId(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700">Match on External Source ID (DirID from eKYROS)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox" checked={matchEmail}
                onChange={(e) => setMatchEmail(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700">Match on Email Address</span>
            </label>
          </div>
        </div>

        {/* Status mapping reference table */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            Status Mapping — How Source Values Are Converted
          </p>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold">Source CSV Value</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold">→ Compassion CRM Status</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_MAP_DISPLAY.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-600 font-mono">{row.source}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.color}`}>
                        {row.crm}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Unknown values default to ACTIVE.</p>
        </div>

        {/* Safety notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-800 mb-1">🔒 Compassion CRM Safety Rules</p>
          <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
            <li>Imported clients will NOT appear in Donor CRM donor lists or reports.</li>
            <li>SSN values are stripped server-side even if somehow included in the payload.</li>
            <li>All records are scoped to your organization only.</li>
          </ul>
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

        <div className="flex justify-between">
          <button
            onClick={() => setStep(3)}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep(5)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl">
            {importResult.dryRun ? "🔬" : "✅"}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800">
              {importResult.dryRun ? "Dry Run Complete" : "Import Complete!"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {importResult.dryRun
                ? "No data was saved. Review results below, then turn off Dry Run to import for real."
                : "Client records have been saved to Compassion CRM."}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4 w-full max-w-lg">
            <StatCard label="Created" value={importResult.created} accent="text-blue-600" />
            <StatCard label="Updated" value={importResult.updated} accent="text-green-600" />
            <StatCard label="Skipped" value={importResult.skipped} />
            <StatCard label="Errors" value={importResult.errors} accent={importResult.errors > 0 ? "text-red-600" : "text-gray-400"} />
          </div>
          {importResult.dryRun && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 w-full max-w-lg">
              🔬 Dry Run: no data was written. Go back to Import Settings and turn off Dry Run to commit the import.
            </div>
          )}
          <button
            onClick={() => {
              setStep(1);
              setFile(null);
              setRawText("");
              setPasteText("");
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
          <p className="text-sm text-gray-500">Review your settings and start the client import.</p>
        </div>

        {/* Settings summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">File</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{file?.name ?? "Pasted text"}</p>
            <p className="text-xs text-gray-500">
              {validationResult.valid.length} valid rows
              {validationResult.counts.skippedGarbage + validationResult.counts.skippedMissingName > 0
                ? ` · ${validationResult.counts.skippedGarbage + validationResult.counts.skippedMissingName} skipped`
                : ""}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Settings</p>
            <p className="text-sm font-semibold text-gray-800 capitalize">
              {importMode.replace("_", " ")}
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

        {/* Safety reminder */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
          <p className="font-semibold mb-1">Before importing, confirm:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>These are Compassion CRM client records, not Donor CRM donors.</li>
            <li>SSN values in the source file will be ignored.</li>
            <li>Records will be scoped to your organization only.</li>
          </ul>
        </div>

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
              dryRun ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-700 hover:bg-blue-800"
            }`}
          >
            {importing
              ? "Importing…"
              : dryRun
                ? "🔬 Run Dry Run"
                : `Import ${validationResult.valid.length.toLocaleString()} Clients`}
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
                    ? "bg-blue-600 text-white"
                    : s.id === step
                      ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.id < step ? "✓" : s.id}
              </span>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  s.id === step ? "text-blue-700" : s.id < step ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${s.id < step ? "bg-blue-300" : "bg-gray-100"}`} />
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
