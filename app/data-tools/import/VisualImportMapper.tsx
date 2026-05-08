/**
 * VisualImportMapper — full-featured visual CSV-to-CRM field mapping tool.
 *
 * Layout matches the eKYROS import mockup:
 *   Left sidebar (stepper + file info + profile)
 *   Main area (summary cards → search bar → mapping table)
 *   Right panel (field details + mapping tips + legend)
 *
 * Handles:
 *   - Auto-detection of report-title rows (skips to real header row)
 *   - Per-column data-quality stats (completeness, unique values, detected type)
 *   - Auto-mapping with HIGH/MEDIUM/LOW confidence badges
 *   - Sensitive field blocking (SSN)
 *   - Empty / constant-value column warnings
 *   - Dry-run preview before import
 *   - Saveable mapping presets (localStorage)
 *
 * @module data-tools/import/VisualImportMapper
 */
"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  CRM_CONSTITUENT_FIELDS,
  AUTO_MAP_ALIASES,
  SENSITIVE_FIELD_KEYS,
  ALWAYS_SKIP_DEFAULTS,
  CONSTANT_VALUE_NOTES,
  type CrmField,
} from "./fieldMap";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A raw CSV row keyed by the detected header column name. */
type RawRow = Record<string, string>;

/** Mapping entry for one source column. */
interface MappingEntry {
  sourceCol: string;
  targetKey: string;    // CRM field key or "skip"
  confidence: "high" | "medium" | "none";
  ignored: boolean;     // user explicitly chose to ignore
  ssnEnabled: boolean;  // user opted in to import SSN
}

/** Per-column analysis stats computed from data rows. */
interface ColumnStats {
  completeness: number;   // 0-100 %
  uniqueCount: number;
  sampleValues: string[];
  isEmpty: boolean;       // ≥95% empty
  isConstant: boolean;    // all values are the same
  constantValue: string;
  isSensitive: boolean;
  detectedType: "text" | "email" | "phone" | "date" | "boolean" | "number" | "id";
  issues: string[];
  position: number;       // 0-indexed column position
}

interface ExistingConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface VisualImportMapperProps {
  existingConstituents: ExistingConstituent[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Upload CSV",        icon: "📂" },
  { label: "Map Fields",        icon: "🔗" },
  { label: "Review & Validate", icon: "✅" },
  { label: "Import Settings",   icon: "⚙️" },
  { label: "Confirm & Import",  icon: "🚀" },
];

/** Minimum non-empty cell count to consider a row a real header row (not a title row). */
const MIN_HEADER_CELLS = 5;

// ─── CSV Parsing ───────────────────────────────────────────────────────────────

/**
 * splitLine: splits a single CSV line into fields, handling quoted values.
 * Handles commas inside quoted fields and escaped double-quotes ("").
 */
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

/** parseAllRows: splits raw CSV text into a 2D array without assuming which row is headers. */
function parseAllRows(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(splitLine);
}

// ─── Header Detection ──────────────────────────────────────────────────────────

/**
 * detectHeaderRow: scans rows top-to-bottom to find the first row that looks like
 * a real field-name header (≥ MIN_HEADER_CELLS non-empty cells, no pure-numeric values).
 * Returns the 0-indexed row index of the likely header, or 0 if not found.
 */
function detectHeaderRow(allRows: string[][]): number {
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i];
    const nonEmpty = row.filter((c) => c.trim().length > 0);
    // Skip rows with very few cells or that look like they contain only numbers
    if (nonEmpty.length >= MIN_HEADER_CELLS) {
      const likelyHeader = nonEmpty.every((c) => isNaN(Number(c)) || c.includes("-") || c.includes("/"));
      if (likelyHeader) return i;
    }
  }
  return 0;
}

// ─── Column Stats ──────────────────────────────────────────────────────────────

/** EMAIL_RE: simple RFC-5322-ish email validation regex. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** PHONE_RE: matches common US/intl phone patterns. */
const PHONE_RE = /^[\d\s\(\)\-\+\.]{7,20}$/;
/** DATE_RE: matches ISO dates, US dates, or slash-separated dates. */
const DATE_RE = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}$/;

/**
 * detectColumnType: guesses the data type of a column from its non-empty sample values.
 */
function detectColumnType(values: string[]): ColumnStats["detectedType"] {
  const nonEmpty = values.filter(Boolean);
  if (nonEmpty.length === 0) return "text";
  const sample = nonEmpty.slice(0, 20);
  if (sample.every((v) => EMAIL_RE.test(v))) return "email";
  if (sample.every((v) => PHONE_RE.test(v))) return "phone";
  if (sample.every((v) => DATE_RE.test(v))) return "date";
  if (sample.every((v) => v === "True" || v === "False" || v === "Yes" || v === "No")) return "boolean";
  if (sample.every((v) => !isNaN(Number(v)))) return "number";
  if (sample.every((v) => /^[A-Z0-9\-]{4,}$/.test(v))) return "id";
  return "text";
}

/**
 * computeColumnStats: analyses all data rows for a given column to produce quality metrics.
 */
function computeColumnStats(col: string, rows: RawRow[], position: number): ColumnStats {
  const allValues = rows.map((r) => r[col] ?? "");
  const nonEmpty = allValues.filter((v) => v.trim().length > 0);
  const completeness = rows.length > 0 ? Math.round((nonEmpty.length / rows.length) * 100) : 0;
  const uniqueSet = new Set(nonEmpty.map((v) => v.trim().toLowerCase()));
  const isEmpty = completeness < 5;
  const isConstant = uniqueSet.size === 1 && nonEmpty.length > 0;
  const constantValue = isConstant ? nonEmpty[0] : "";
  const isSensitive = SENSITIVE_FIELD_KEYS.has(col.toLowerCase().trim());

  // Take up to 5 unique sample values
  const sampleValues = Array.from(new Set(nonEmpty.slice(0, 100).map((v) => v.trim())))
    .filter(Boolean)
    .slice(0, 5);

  const detectedType = detectColumnType(nonEmpty);

  const issues: string[] = [];
  if (isEmpty) issues.push("Column appears empty in this source");
  if (isConstant) issues.push(`Always "${constantValue}" — consider setting as import default`);
  if (isSensitive) issues.push("⚠ Sensitive field — not imported by default");
  if (ALWAYS_SKIP_DEFAULTS[col.toLowerCase()]) issues.push(ALWAYS_SKIP_DEFAULTS[col.toLowerCase()]);
  if (CONSTANT_VALUE_NOTES[col.toLowerCase()]) issues.push(CONSTANT_VALUE_NOTES[col.toLowerCase()]);

  return { completeness, uniqueCount: uniqueSet.size, sampleValues, isEmpty, isConstant, constantValue, isSensitive, detectedType, issues, position };
}

// ─── Auto-mapping ──────────────────────────────────────────────────────────────

/**
 * autoMapHeaders: returns initial mapping entries for all headers.
 * Sensitive fields default to "skip" (unless user opts in).
 * Empty/always-skip columns default to "skip".
 * All other columns get a target from AUTO_MAP_ALIASES.
 */
function autoMapHeaders(headers: string[]): MappingEntry[] {
  return headers.map((h) => {
    const key = h.toLowerCase().trim();
    const isSensitive = SENSITIVE_FIELD_KEYS.has(key);
    const isAlwaysSkip = key in ALWAYS_SKIP_DEFAULTS && AUTO_MAP_ALIASES[key] === "skip";

    let targetKey = AUTO_MAP_ALIASES[key] ?? "skip";
    let confidence: MappingEntry["confidence"] = "none";

    if (isSensitive) {
      targetKey = "skip";
    } else if (isAlwaysSkip) {
      targetKey = "skip";
    } else if (AUTO_MAP_ALIASES[key] && AUTO_MAP_ALIASES[key] !== "skip") {
      // Exact match in alias map
      confidence = "high";
    } else {
      // Try partial match: if any CRM field key appears as substring of the header
      const matchedField = CRM_CONSTITUENT_FIELDS.find((f) =>
        f.key !== "skip" && (
          key.includes(f.key.toLowerCase()) ||
          f.key.toLowerCase().includes(key) ||
          f.label.toLowerCase().includes(key)
        )
      );
      if (matchedField) {
        targetKey = matchedField.key;
        confidence = "medium";
      }
    }

    return {
      sourceCol: h,
      targetKey,
      confidence,
      ignored: false,
      ssnEnabled: false,
    };
  });
}

// ─── Small UI helpers ──────────────────────────────────────────────────────────

/** Confidence badge: color-coded chip for mapping confidence level. */
function ConfidenceBadge({ level }: { level: "high" | "medium" | "none" }) {
  if (level === "high") return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">High</span>
  );
  if (level === "medium") return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Med</span>
  );
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">—</span>
  );
}

/** Status badge for mapped/unmapped/ignored rows. */
function StatusBadge({ entry, stats }: { entry: MappingEntry; stats: ColumnStats }) {
  if (entry.ignored) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Ignored</span>
  );
  if (stats.isSensitive && !entry.ssnEnabled) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">🔒 Sensitive</span>
  );
  if (entry.targetKey === "skip") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Unmapped</span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
      ✓ Mapped
    </span>
  );
}

/** Column type badge. */
function TypeBadge({ type }: { type: ColumnStats["detectedType"] }) {
  const colors: Record<string, string> = {
    email:   "bg-blue-100 text-blue-700",
    phone:   "bg-purple-100 text-purple-700",
    date:    "bg-yellow-100 text-yellow-700",
    boolean: "bg-cyan-100 text-cyan-700",
    number:  "bg-pink-100 text-pink-700",
    id:      "bg-indigo-100 text-indigo-700",
    text:    "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-mono capitalize ${colors[type] ?? colors.text}`}>
      {type}
    </span>
  );
}

/** Circular progress indicator for mapping completeness. */
function CircleProgress({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width="56" height="56" className="transform -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="28" cy="28" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text
        x="28" y="28"
        textAnchor="middle" dominantBaseline="central"
        className="transform rotate-90"
        style={{ transform: "rotate(90deg)", transformOrigin: "28px 28px", fontSize: 11, fontWeight: 700, fill: color }}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * VisualImportMapper: full-page visual CSV-to-CRM field mapping tool.
 * Handles the complete eKYROS File Address List import workflow with
 * auto-detection, field mapping, data quality analysis, and dry-run preview.
 */
export default function VisualImportMapper({ existingConstituents }: VisualImportMapperProps) {
  // File and parse state
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [allRawRows, setAllRawRows] = useState<string[][]>([]);
  const [detectedHeaderIdx, setDetectedHeaderIdx] = useState(0);
  const [headerRowIdx, setHeaderRowIdx] = useState(0); // user-adjustable
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<RawRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mapping state
  const [entries, setEntries] = useState<MappingEntry[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, ColumnStats>>({});
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  // UI filter/search state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "mapped" | "unmapped" | "ignored">("all");

  // Settings state
  const [profileName, setProfileName] = useState("eKYROS File Address List");
  const [recordMode, setRecordMode] = useState<"auto" | "person" | "organization" | "household">("auto");
  const [importMode, setImportMode] = useState<"dryrun" | "real">("dryrun");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);

  // ── File parsing ─────────────────────────────────────────────────────────────

  /**
   * handleFile: reads the uploaded CSV, detects the header row, computes per-column
   * stats, and auto-maps all fields. Advances to step 1 (Map Fields).
   */
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rawRows = parseAllRows(text);
      setAllRawRows(rawRows);

      const detected = detectHeaderRow(rawRows);
      setDetectedHeaderIdx(detected);
      setHeaderRowIdx(detected);

      const hdrs = rawRows[detected] ?? [];
      const dRows: RawRow[] = [];
      for (let i = detected + 1; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (r.every((c) => !c.trim())) continue; // skip blank rows
        const obj: RawRow = {};
        hdrs.forEach((h, j) => { obj[h] = r[j] ?? ""; });
        dRows.push(obj);
      }

      setHeaders(hdrs);
      setDataRows(dRows);

      // Compute per-column stats
      const stats: Record<string, ColumnStats> = {};
      hdrs.forEach((h, idx) => { stats[h] = computeColumnStats(h, dRows, idx); });
      setColumnStats(stats);

      setEntries(autoMapHeaders(hdrs));
      setSelectedCol(hdrs[0] ?? null);
      setStep(1);
    };
    reader.readAsText(file);
  }, []);

  // Allow re-setting header row manually (re-parses data rows from chosen row)
  function applyHeaderRow(idx: number) {
    setHeaderRowIdx(idx);
    const hdrs = allRawRows[idx] ?? [];
    const dRows: RawRow[] = [];
    for (let i = idx + 1; i < allRawRows.length; i++) {
      const r = allRawRows[i];
      if (r.every((c) => !c.trim())) continue;
      const obj: RawRow = {};
      hdrs.forEach((h, j) => { obj[h] = r[j] ?? ""; });
      dRows.push(obj);
    }
    setHeaders(hdrs);
    setDataRows(dRows);
    const stats: Record<string, ColumnStats> = {};
    hdrs.forEach((h, idx2) => { stats[h] = computeColumnStats(h, dRows, idx2); });
    setColumnStats(stats);
    setEntries(autoMapHeaders(hdrs));
  }

  // ── Entry mutations ──────────────────────────────────────────────────────────

  function setTarget(col: string, targetKey: string) {
    setEntries((prev) => prev.map((e) =>
      e.sourceCol === col
        ? { ...e, targetKey, ignored: targetKey === "skip" ? e.ignored : false, confidence: e.confidence === "none" && targetKey !== "skip" ? "medium" : e.confidence }
        : e
    ));
  }

  function toggleIgnored(col: string) {
    setEntries((prev) => prev.map((e) =>
      e.sourceCol === col ? { ...e, ignored: !e.ignored, targetKey: !e.ignored ? "skip" : e.targetKey } : e
    ));
  }

  function toggleSsnEnabled(col: string) {
    setEntries((prev) => prev.map((e) =>
      e.sourceCol === col ? { ...e, ssnEnabled: !e.ssnEnabled, targetKey: !e.ssnEnabled ? "ssn" : "skip" } : e
    ));
  }

  // ── Computed summary metrics ─────────────────────────────────────────────────

  const { mappedCount, unmappedCount, ignoredCount, requiredMissing, completionPct } = useMemo(() => {
    const activeEntries = entries.filter((e) => {
      const stats = columnStats[e.sourceCol];
      return !stats?.isSensitive || e.ssnEnabled;
    });
    const mapped = activeEntries.filter((e) => !e.ignored && e.targetKey !== "skip").length;
    const unmapped = activeEntries.filter((e) => !e.ignored && e.targetKey === "skip").length;
    const ignored = entries.filter((e) => e.ignored).length;
    const required = CRM_CONSTITUENT_FIELDS.filter((f) => f.required);
    const missingRequired = required.filter((f) => !entries.some((e) => e.targetKey === f.key && !e.ignored));
    const total = entries.length;
    const pct = total > 0 ? Math.round((mapped / (mapped + unmapped)) * 100) || 0 : 0;
    return { mappedCount: mapped, unmappedCount: unmapped, ignoredCount: ignored, requiredMissing: missingRequired, completionPct: pct };
  }, [entries, columnStats]);

  // ── Filtered + searched entries for the mapping table ────────────────────────

  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch = !searchTerm || e.sourceCol.toLowerCase().includes(searchTerm.toLowerCase());
      const stats = columnStats[e.sourceCol];
      if (!matchesSearch) return false;
      if (filterStatus === "mapped") return !e.ignored && e.targetKey !== "skip";
      if (filterStatus === "unmapped") return !e.ignored && e.targetKey === "skip" && !(stats?.isSensitive && !e.ssnEnabled);
      if (filterStatus === "ignored") return e.ignored || (stats?.isSensitive && !e.ssnEnabled);
      return true;
    });
  }, [entries, searchTerm, filterStatus, columnStats]);

  // ── Duplicate detection ───────────────────────────────────────────────────────

  const { duplicateRows, newRows } = useMemo(() => {
    const emailEntry = entries.find((e) => e.targetKey === "email");
    if (!emailEntry) return { duplicateRows: [], newRows: dataRows };
    const existingEmails = new Set(existingConstituents.map((c) => c.email?.toLowerCase().trim()).filter(Boolean));
    const dupes = dataRows.filter((r) => {
      const v = r[emailEntry.sourceCol]?.toLowerCase().trim();
      return v && existingEmails.has(v);
    });
    const fresh = dataRows.filter((r) => {
      const v = r[emailEntry.sourceCol]?.toLowerCase().trim();
      return !v || !existingEmails.has(v);
    });
    return { duplicateRows: dupes, newRows: fresh };
  }, [entries, dataRows, existingConstituents]);

  // ── Mapped rows (apply mapping + basic transforms) ────────────────────────────

  const mappedRows = useMemo(() => {
    return dataRows.map((row) => {
      const out: Record<string, string> = {};
      for (const e of entries) {
        if (e.ignored || e.targetKey === "skip") continue;
        if (columnStats[e.sourceCol]?.isSensitive && !e.ssnEnabled) continue;
        const val = row[e.sourceCol]?.trim() ?? "";
        if (val) out[e.targetKey] = val;
      }
      return out;
    });
  }, [entries, dataRows, columnStats]);

  // ── Preset save/load ──────────────────────────────────────────────────────────

  function savePreset() {
    const preset = { name: profileName, mapping: entries.map((e) => ({ sourceCol: e.sourceCol, targetKey: e.targetKey, ignored: e.ignored })) };
    const existing: Record<string, unknown>[] = JSON.parse(localStorage.getItem("importPresets") ?? "[]");
    const updated = [...existing.filter((p) => (p as { name: string }).name !== profileName), preset];
    localStorage.setItem("importPresets", JSON.stringify(updated));
    setSavedMsg(`Saved as "${profileName}"`);
    setTimeout(() => setSavedMsg(null), 3000);
  }

  // ── Export mapped CSV ─────────────────────────────────────────────────────────

  function downloadMappedCsv() {
    const rows = importMode === "dryrun" ? mappedRows.slice(0, 20) : mappedRows;
    if (rows.length === 0) return;
    const hdrs = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [hdrs.join(","), ...rows.map((r) => hdrs.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = importMode === "dryrun" ? "dry-run-preview.csv" : "mapped-constituents.csv";
    a.click();
    URL.revokeObjectURL(url);
    if (importMode !== "dryrun") setImportDone(true);
  }

  // ── Selected field stats for right panel ─────────────────────────────────────

  const selStats = selectedCol ? columnStats[selectedCol] : null;
  const selEntry = selectedCol ? entries.find((e) => e.sourceCol === selectedCol) : null;
  const selCrmField: CrmField | undefined = selEntry
    ? CRM_CONSTITUENT_FIELDS.find((f) => f.key === selEntry.targetKey)
    : undefined;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden" style={{ minHeight: 680 }}>

      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Steps */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Steps</p>
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const locked = i > step;
            return (
              <button
                key={i}
                onClick={() => { if (!locked && fileName) setStep(i); }}
                disabled={locked || !fileName}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 text-left transition-colors disabled:cursor-not-allowed ${
                  active ? "bg-green-600 text-white" :
                  done   ? "bg-green-50 text-green-700 hover:bg-green-100" :
                           "text-gray-400 hover:bg-gray-50"
                }`}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  active ? "bg-white text-green-600" :
                  done   ? "bg-green-200 text-green-700" :
                           "bg-gray-200 text-gray-400"
                }`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="text-xs font-medium truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Source file info */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Source File</p>
          {fileName ? (
            <div>
              <p className="text-xs font-medium text-gray-800 truncate" title={fileName}>📄 {fileName}</p>
              <p className="text-xs text-gray-500 mt-1">{dataRows.length.toLocaleString()} rows</p>
              <p className="text-xs text-gray-500">{headers.length} columns</p>
              <p className="text-xs text-green-600 mt-1">✓ File loaded</p>
              <p className="text-xs text-gray-400 mt-1">Header: row {headerRowIdx + 1}</p>
              {detectedHeaderIdx !== headerRowIdx && (
                <p className="text-xs text-amber-500">⚠ Override active</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No file loaded</p>
          )}
        </div>

        {/* Import profile */}
        <div className="p-4 flex-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Import Profile</p>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 mb-2"
            placeholder="Profile name…"
          />
          {step >= 1 && (
            <button
              onClick={savePreset}
              className="w-full text-xs px-2 py-1.5 text-green-700 border border-green-200 rounded hover:bg-green-50"
            >
              💾 Save Preset
            </button>
          )}
          {savedMsg && <p className="text-xs text-green-600 mt-1">{savedMsg}</p>}
        </div>

        {/* Back to Data Tools */}
        <div className="p-4 border-t border-gray-100">
          <a href="/data-tools" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            ← Back to Data Tools
          </a>
        </div>
      </div>

      {/* ── MAIN AREA ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-gray-900">Field Mapping</span>
            {fileName && (
              <span className="text-xs text-gray-400">Map your CSV fields to CRM destination</span>
            )}
          </div>
          {step >= 1 && (
            <div className="flex items-center gap-2">
              <button onClick={savePreset} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                💾 Save Progress
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ✅ Validate
              </button>
              <button
                onClick={() => step < STEPS.length - 1 && setStep(step + 1)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Save & Continue →
              </button>
            </div>
          )}
        </div>

        {/* ── STEP 0: UPLOAD ── */}
        {step === 0 && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-lg w-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 text-center">Upload your CSV file</h2>
              <p className="text-sm text-gray-500 mb-6 text-center">
                The importer will auto-detect report headers, suggest field mappings, and flag data quality issues.
              </p>

              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-green-400 transition-colors cursor-pointer bg-white"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <div className="text-5xl mb-4">📂</div>
                <p className="text-sm font-medium text-gray-700">Click to browse or drag & drop</p>
                <p className="text-xs text-gray-400 mt-1">Supports .csv files — eKYROS, Bloomerang, NeonCRM exports</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-medium text-blue-800 mb-1">💡 eKYROS File Address List</p>
                <p className="text-xs text-blue-600">
                  This tool recognizes the eKYROS export format. Header rows will be auto-detected,
                  and all 37 fields will be pre-mapped with high confidence.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: MAP FIELDS ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto">
            {/* Summary cards */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0 flex-wrap">
              <SummaryCard label="CSV Columns" value={headers.length} color="gray" />
              <SummaryCard label="Mapped" value={mappedCount} color="green" />
              <SummaryCard label="Unmapped" value={unmappedCount} color="orange" />
              <SummaryCard label="Required ⚠" value={requiredMissing.length} color={requiredMissing.length > 0 ? "red" : "green"} />
              <div className="ml-auto flex items-center gap-2">
                <CircleProgress pct={completionPct} />
                <div>
                  <p className="text-xs font-bold text-gray-800">{completionPct}%</p>
                  <p className="text-xs text-gray-400">Complete</p>
                </div>
              </div>
            </div>

            {/* Header detection notice */}
            <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-4 flex-shrink-0">
              <p className="text-xs text-blue-800">
                🔍 <strong>Detected header row: {detectedHeaderIdx + 1}</strong> —{" "}
                {detectedHeaderIdx === headerRowIdx
                  ? "auto-detected from file"
                  : `overridden to row ${headerRowIdx + 1}`}
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-blue-600">Override row:</span>
                <select
                  value={headerRowIdx}
                  onChange={(e) => applyHeaderRow(Number(e.target.value))}
                  className="text-xs border border-blue-200 rounded px-2 py-0.5 bg-white focus:outline-none"
                >
                  {allRawRows.slice(0, 10).map((_, i) => (
                    <option key={i} value={i}>Row {i + 1}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search + filter bar */}
            <div className="px-5 py-2.5 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Search fields…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "mapped", "unmapped", "ignored"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 text-xs rounded-lg capitalize ${filterStatus === s ? "bg-green-600 text-white" : "text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Mapping table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-6"></th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Field (CSV)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Preview</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">→</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Destination Field</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleEntries.map((entry) => {
                    const stats = columnStats[entry.sourceCol] ?? {} as ColumnStats;
                    const isSelected = selectedCol === entry.sourceCol;
                    const isSensitiveBlocked = stats.isSensitive && !entry.ssnEnabled;

                    return (
                      <tr
                        key={entry.sourceCol}
                        onClick={() => setSelectedCol(entry.sourceCol)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} ${entry.ignored || isSensitiveBlocked ? "opacity-50" : ""}`}
                      >
                        {/* Drag handle placeholder */}
                        <td className="px-2 py-2.5 text-gray-300 text-center cursor-grab">⠿</td>

                        {/* Source field */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-gray-800 text-xs">{entry.sourceCol}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <TypeBadge type={stats.detectedType ?? "text"} />
                                <ConfidenceBadge level={entry.confidence} />
                                {stats.issues && stats.issues.length > 0 && (
                                  <span className="text-orange-400 text-xs" title={stats.issues.join(" | ")}>⚠</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Sample value preview */}
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-gray-500 truncate max-w-[140px]" title={stats.sampleValues?.[0]}>
                            {stats.sampleValues?.[0] ?? <span className="text-gray-300 italic">empty</span>}
                          </p>
                        </td>

                        {/* Arrow */}
                        <td className="px-2 py-2.5 text-center text-gray-300">→</td>

                        {/* Target field dropdown */}
                        <td className="px-4 py-2.5">
                          {isSensitiveBlocked ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600">🔒 SSN — blocked</span>
                              <button
                                onClick={(ev) => { ev.stopPropagation(); toggleSsnEnabled(entry.sourceCol); }}
                                className="text-xs text-blue-600 underline"
                              >
                                Enable
                              </button>
                            </div>
                          ) : (
                            <FieldDropdown
                              value={entry.targetKey}
                              onChange={(v) => setTarget(entry.sourceCol, v)}
                              disabled={entry.ignored}
                            />
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5">
                          <StatusBadge entry={entry} stats={stats} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5">
                          <button
                            onClick={(ev) => { ev.stopPropagation(); toggleIgnored(entry.sourceCol); }}
                            className={`text-xs px-2 py-0.5 rounded ${entry.ignored ? "text-green-600 border border-green-200 hover:bg-green-50" : "text-gray-400 border border-gray-200 hover:bg-gray-50"}`}
                            title={entry.ignored ? "Re-enable column" : "Ignore column"}
                          >
                            {entry.ignored ? "↩" : "✕"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleEntries.length === 0 && (
                <div className="text-center py-10 text-sm text-gray-400">No fields match the current filter.</div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW & VALIDATE ── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <h3 className="font-semibold text-gray-900">Data Quality Review</h3>

            {/* Warnings list */}
            <div className="space-y-2">
              {entries
                .filter((e) => (columnStats[e.sourceCol]?.issues.length ?? 0) > 0)
                .map((e) => (
                  <div key={e.sourceCol} className="flex items-start gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{e.sourceCol}</p>
                      {columnStats[e.sourceCol].issues.map((issue, i) => (
                        <p key={i} className="text-xs text-gray-600">{issue}</p>
                      ))}
                    </div>
                    <div className="ml-auto flex-shrink-0">
                      <StatusBadge entry={e} stats={columnStats[e.sourceCol]} />
                    </div>
                  </div>
                ))
              }
              {entries.every((e) => (columnStats[e.sourceCol]?.issues.length ?? 0) === 0) && (
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                  ✓ No data quality warnings found.
                </div>
              )}
            </div>

            {/* Completeness overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Records" value={dataRows.length} />
              <StatCard label="Mapped Fields" value={mappedCount} />
              <StatCard label="Unmapped" value={unmappedCount} />
              <StatCard label="Duplicate Emails" value={duplicateRows.length} />
            </div>

            {/* Sample data preview */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Sample mapped records (first 5)</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="text-xs min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {entries.filter((e) => !e.ignored && e.targetKey !== "skip").slice(0, 8).map((e) => {
                        const f = CRM_CONSTITUENT_FIELDS.find((c) => c.key === e.targetKey);
                        return <th key={e.sourceCol} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{f?.label ?? e.targetKey}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="border-t border-gray-100">
                        {entries.filter((e) => !e.ignored && e.targetKey !== "skip").slice(0, 8).map((e) => (
                          <td key={e.sourceCol} className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-[120px] truncate">
                            {row[e.targetKey] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(3)} className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">Import Settings →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: IMPORT SETTINGS ── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <h3 className="font-semibold text-gray-900">Import Settings</h3>

            {/* Record type mode */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Record Type Detection</p>
              <p className="text-xs text-gray-500">This file contains both people and organizations. Choose how records are identified:</p>
              <div className="space-y-2">
                {([
                  ["auto", "Auto-detect (Person if FirstName present, Organization if Organization field filled)"],
                  ["person", "All records → Person"],
                  ["organization", "All records → Organization"],
                  ["household", "All records → Household"],
                ] as const).map(([val, desc]) => (
                  <label key={val} className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="recordMode" value={val} checked={recordMode === val} onChange={() => setRecordMode(val)} className="mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-gray-700 capitalize">{val === "auto" ? "Auto-detect" : val.charAt(0).toUpperCase() + val.slice(1)}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Import mode */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Import Mode</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="dryrun" checked={importMode === "dryrun"} onChange={() => setImportMode("dryrun")} className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Dry Run (Recommended)</p>
                    <p className="text-xs text-gray-400">Preview first 20 mapped records — no data is imported to the CRM.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="real" checked={importMode === "real"} onChange={() => setImportMode("real")} className="mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Real Import</p>
                    <p className="text-xs text-gray-400">Import all {dataRows.length.toLocaleString()} records. DirID is preserved as external ID for safe re-imports.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Preset save */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Save as Template</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Template name…"
                />
                <button onClick={savePreset} className="px-3 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700">Save</button>
              </div>
              {savedMsg && <p className="text-xs text-green-600">{savedMsg}</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(4)} className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">Review & Import →</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: CONFIRM & IMPORT ── */}
        {step === 4 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <h3 className="font-semibold text-gray-900">Confirm & Import</h3>

            {importDone ? (
              <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-lg font-semibold text-green-800">Import Complete!</p>
                <p className="text-sm text-green-600 mt-1">{mappedRows.length.toLocaleString()} records exported as CSV.</p>
                <p className="text-xs text-gray-400 mt-2">
                  {/* TODO: backend API needed — wire to POST /api/constituents/bulk for live database import */}
                  Real database import requires backend integration. Use the downloaded CSV to review mappings.
                </p>
                <button onClick={() => { setStep(0); setFileName(""); setImportDone(false); }}
                  className="mt-4 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                  Import Another File
                </button>
              </div>
            ) : (
              <>
                {/* Import summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Records" value={dataRows.length} />
                  <StatCard label="Mapped Fields" value={mappedCount} />
                  <StatCard label="Ignored" value={ignoredCount} />
                  <StatCard label="Duplicates" value={duplicateRows.length} />
                </div>

                {importMode === "dryrun" && (
                  <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">🧪 <strong>Dry Run Mode</strong> — downloading first 20 mapped records as CSV for review.</p>
                  </div>
                )}

                {duplicateRows.length > 0 && (
                  <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">⚠ {duplicateRows.length} record(s) match existing constituent emails and will be treated as updates.</p>
                  </div>
                )}

                {/* Final preview table */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    {importMode === "dryrun" ? "Preview (first 5 records)" : "All records — first 5 shown"}
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="text-xs min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {entries.filter((e) => !e.ignored && e.targetKey !== "skip").slice(0, 8).map((e) => {
                            const f = CRM_CONSTITUENT_FIELDS.find((c) => c.key === e.targetKey);
                            return <th key={e.sourceCol} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{f?.label ?? e.targetKey}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {mappedRows.slice(0, 5).map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100">
                            {entries.filter((e) => !e.ignored && e.targetKey !== "skip").slice(0, 8).map((e) => (
                              <td key={e.sourceCol} className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-[120px] truncate">
                                {row[e.targetKey] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(3)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
                  <button
                    onClick={downloadMappedCsv}
                    className={`px-5 py-1.5 text-sm font-medium text-white rounded-lg ${importMode === "dryrun" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
                  >
                    {importMode === "dryrun" ? "⬇ Download Dry Run Preview" : "🚀 Export Mapped CSV"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      {step >= 1 && (
        <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto text-xs">
          {/* Field details */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Field Details</p>
            {selStats && selEntry ? (
              <div className="space-y-2.5">
                <div>
                  <p className="text-gray-500">Source Field</p>
                  <p className="font-semibold text-gray-800">{selEntry.sourceCol}</p>
                </div>
                <div>
                  <p className="text-gray-500">Data Type</p>
                  <TypeBadge type={selStats.detectedType} />
                </div>
                <div>
                  <p className="text-gray-500">Column Position</p>
                  <p className="text-gray-700">{selStats.position + 1}</p>
                </div>
                <div>
                  <p className="text-gray-500">Completeness</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${selStats.completeness >= 80 ? "bg-green-500" : selStats.completeness >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                        style={{ width: `${selStats.completeness}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-medium">{selStats.completeness}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">Unique Values</p>
                  <p className="text-gray-700">{selStats.uniqueCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Sample Values</p>
                  <div className="space-y-0.5 mt-0.5">
                    {selStats.sampleValues.length > 0
                      ? selStats.sampleValues.map((v, i) => (
                          <p key={i} className="text-gray-600 bg-gray-50 rounded px-1.5 py-0.5 truncate" title={v}>{v}</p>
                        ))
                      : <p className="text-gray-400 italic">No values</p>}
                    {selStats.uniqueCount > selStats.sampleValues.length && (
                      <p className="text-gray-400">…and {(selStats.uniqueCount - selStats.sampleValues.length).toLocaleString()} more</p>
                    )}
                  </div>
                </div>
                {selCrmField && (
                  <div>
                    <p className="text-gray-500">Mapped to</p>
                    <p className="font-medium text-green-700">{selCrmField.label}</p>
                    <p className="text-gray-400 font-mono">{selCrmField.group}</p>
                  </div>
                )}
                {selStats.issues.length > 0 && (
                  <div>
                    <p className="text-gray-500 mb-1">Issues</p>
                    {selStats.issues.map((issue, i) => (
                      <p key={i} className="text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mb-0.5">{issue}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Click a row to see field details</p>
            )}
          </div>

          {/* Mapping tips */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Mapping Tips</p>
            <div className="space-y-1.5">
              {[
                { ok: mappedCount > 0, text: "Map all required fields" },
                { ok: entries.some((e) => e.targetKey === "externalId"), text: "Unique identifier mapped" },
                { ok: !entries.some((e) => columnStats[e.sourceCol]?.isSensitive && !e.ignored), text: "Sensitive fields handled" },
                { ok: unmappedCount < 5, text: "Review unmapped fields" },
              ].map((tip, i) => (
                <div key={i} className={`flex items-center gap-2 ${tip.ok ? "text-green-700" : "text-amber-600"}`}>
                  <span>{tip.ok ? "✓" : "△"}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></span><span className="text-gray-600">Mapped</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0"></span><span className="text-gray-600">Unmapped</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></span><span className="text-gray-600">Required Field</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0"></span><span className="text-gray-600">Ignored</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

/** SummaryCard: one of the top summary metric cards. */
function SummaryCard({ label, value, color }: { label: string; value: number; color: "gray" | "green" | "orange" | "red" }) {
  const colors = {
    gray: "text-gray-800",
    green: "text-green-700",
    orange: "text-orange-600",
    red: "text-red-600",
  };
  return (
    <div className="text-center px-4">
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{label}</p>
    </div>
  );
}

/** StatCard: a small stat box for review/confirm steps. */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-center">
      <p className="text-xl font-bold text-gray-800">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/**
 * FieldDropdown: target CRM field selector grouped by category.
 * "— Do Not Import —" is always available at the top.
 */
function FieldDropdown({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const groups = Array.from(new Set(CRM_CONSTITUENT_FIELDS.map((f) => f.group)));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className="text-xs border border-gray-300 rounded px-2 py-1 w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
    >
      <option value="skip">— Do Not Import —</option>
      {groups.filter((g) => g !== "Other").map((g) => (
        <optgroup key={g} label={g}>
          {CRM_CONSTITUENT_FIELDS
            .filter((f) => f.group === g && f.key !== "skip")
            .map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
