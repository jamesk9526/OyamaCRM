// Multi-step CSV import wizard for constituents — handles upload, mapping, validation, dedup, and confirm.
"use client";

import { useState, useRef, useCallback } from "react";
import { CRM_CONSTITUENT_FIELDS, AUTO_MAP_ALIASES } from "./fieldMap";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A raw row parsed from the uploaded CSV. Keys are CSV header names. */
type RawRow = Record<string, string>;

/** Mapping from CSV column header → CRM field key (or "skip") */
type FieldMapping = Record<string, string>;

/** A row with column names replaced by mapped CRM field keys */
type MappedRow = Record<string, string>;

/** An existing constituent from the CRM (used for duplicate detection) */
interface ExistingConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface ImportWizardProps {
  /** Existing CRM constituents used for client-side duplicate detection */
  existingConstituents: ExistingConstituent[];
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────

/**
 * parseCSV: minimal CSV parser that handles quoted fields with commas and escaped quotes.
 * Returns [headers, rows] where rows is an array of raw string-keyed objects.
 * No external library needed — handles the 99% case for typical CRM exports.
 */
function parseCSV(text: string): [string[], RawRow[]] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return [[], []];

  /** Split a single CSV line respecting quoted fields */
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Escaped double-quote inside a quoted field: ""
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

  const headers = splitLine(lines[0]);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines
    const values = splitLine(line);
    const row: RawRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }

  return [headers, rows];
}

/**
 * autoMap: returns an initial FieldMapping by matching CSV headers to AUTO_MAP_ALIASES.
 * Unrecognised columns default to "skip".
 */
function autoMap(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const h of headers) {
    const alias = AUTO_MAP_ALIASES[h.toLowerCase().trim()];
    mapping[h] = alias ?? "skip";
  }
  return mapping;
}

/**
 * applyMapping: converts raw CSV rows to mapped constituent objects using the field mapping.
 * Columns mapped to "skip" are omitted. Duplicate CRM field targets from multiple columns
 * use the last non-empty value found.
 */
function applyMapping(rows: RawRow[], mapping: FieldMapping): MappedRow[] {
  return rows.map((row) => {
    const mapped: MappedRow = {};
    for (const [csvCol, crmKey] of Object.entries(mapping)) {
      if (crmKey === "skip") continue;
      const val = row[csvCol]?.trim() ?? "";
      if (val) mapped[crmKey] = val; // last non-empty wins
    }
    return mapped;
  });
}

/**
 * toCsvString: serialises an array of objects to a CSV string for download.
 */
function toCsvString(rows: MappedRow[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ].join("\n");
}

// ─── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = [
  "Upload CSV",
  "Map Fields",
  "Validate",
  "Duplicates",
  "Confirm",
];

/** StepIndicator: horizontal breadcrumb showing current step number and label. */
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-6">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className={`w-6 h-px ${done ? "bg-green-400" : "bg-gray-200"}`} />}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active  ? "bg-green-600 text-white" :
              done    ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-400"
            }`}>
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

/**
 * ImportWizard: 5-step CSV import wizard for constituents.
 * Steps: Upload → Map Fields → Validate → Duplicate Detection → Confirm/Download
 * All processing is client-side; backend import is not yet implemented.
 */
export default function ImportWizard({ existingConstituents }: ImportWizardProps) {
  const [step, setStep]             = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows]       = useState<RawRow[]>([]);
  const [mapping, setMapping]       = useState<FieldMapping>({});
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName]     = useState("");
  const fileInputRef                = useRef<HTMLInputElement>(null);

  // ── Step 1: Upload CSV ──────────────────────────────────────────────────────

  /** handleFile: reads the selected CSV file and parses it client-side. */
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const [headers, rows] = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoMap(headers));
      setStep(1); // advance to mapping
    };
    reader.readAsText(file);
  }, []);

  // ── Step 2: Map Fields ───────────────────────────────────────────────────────

  /** Returns true if all required CRM fields have at least one CSV column mapped to them */
  const requiredFieldsMapped = CRM_CONSTITUENT_FIELDS
    .filter((f) => f.required)
    .every((f) => Object.values(mapping).includes(f.key));

  // ── Step 3: Validate ─────────────────────────────────────────────────────────

  /** Run mapping before entering validate step */
  function goToValidate() {
    setMappedRows(applyMapping(csvRows, mapping));
    setStep(2);
  }

  /** Rows missing at least one required field */
  const invalidRows = mappedRows.filter((r) =>
    CRM_CONSTITUENT_FIELDS.filter((f) => f.required).some((f) => !r[f.key]?.trim())
  );
  const validRows   = mappedRows.filter((r) =>
    CRM_CONSTITUENT_FIELDS.filter((f) => f.required).every((f) => r[f.key]?.trim())
  );
  const qualityPct  = mappedRows.length > 0 ? Math.round((validRows.length / mappedRows.length) * 100) : 0;

  // ── Step 4: Duplicate Detection ───────────────────────────────────────────────

  /** Build a set of existing emails (lowercased) for O(1) lookup */
  const existingEmailSet = new Set(
    existingConstituents.map((c) => c.email?.toLowerCase().trim()).filter(Boolean)
  );

  /** Flag imported rows whose email matches an existing constituent */
  const duplicateRows = mappedRows.filter((r) => {
    const email = r.email?.toLowerCase().trim();
    return email && existingEmailSet.has(email);
  });
  const newRows = mappedRows.filter((r) => {
    const email = r.email?.toLowerCase().trim();
    return !email || !existingEmailSet.has(email);
  });

  // ── Step 5: Confirm / Download ────────────────────────────────────────────────

  /** downloadMappedCsv: triggers a browser download of the final mapped data as CSV */
  function downloadMappedCsv() {
    const csv = toCsvString(validRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapped-constituents.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Import Constituents</h2>
        <p className="text-sm text-gray-500">Upload a CSV file to import constituent records.</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Upload ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-green-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-600">Click or drag a CSV file here</p>
            <p className="text-xs text-gray-400 mt-1">Supports standard CSV with headers in the first row</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* ── Step 2: Map Fields ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{fileName}</span> — {csvRows.length} rows, {csvHeaders.length} columns.
            Auto-mapped fields are pre-filled. Adjust as needed.
          </p>

          {/* Preview of first 5 raw rows */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="text-xs min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {csvHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 5).map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    {csvHeaders.map((h) => (
                      <td key={h} className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-[140px] truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="text-sm min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">CSV Column</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Map to CRM Field</th>
                </tr>
              </thead>
              <tbody>
                {csvHeaders.map((h) => {
                  /** Highlight if a required field is unresolved */
                  const isRequired = CRM_CONSTITUENT_FIELDS
                    .filter((f) => f.required)
                    .some((f) => f.key === mapping[h]);
                  const isUnmappedRequired = CRM_CONSTITUENT_FIELDS
                    .filter((f) => f.required)
                    .some((f) => !Object.values(mapping).includes(f.key));
                  const rowWarning = isUnmappedRequired && mapping[h] === "skip";
                  return (
                    <tr key={h} className={`border-t border-gray-100 ${rowWarning ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{h}</td>
                      <td className="px-4 py-2">
                        <select
                          value={mapping[h] ?? "skip"}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                          className={`text-sm border rounded px-2 py-1 w-full max-w-xs focus:outline-none focus:ring-1 ${
                            isRequired ? "border-green-400 bg-green-50" :
                            rowWarning  ? "border-amber-400 bg-amber-50" :
                                          "border-gray-300"
                          }`}
                        >
                          {CRM_CONSTITUENT_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Required fields not yet mapped */}
          {!requiredFieldsMapped && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ Required fields not yet mapped:{" "}
              {CRM_CONSTITUENT_FIELDS.filter((f) => f.required && !Object.values(mapping).includes(f.key))
                .map((f) => f.label).join(", ")}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(0)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
            <button
              onClick={goToValidate}
              disabled={!requiredFieldsMapped}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-40"
            >
              Validate →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Validate & Preview ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Data quality score */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-center">
              <p className="text-2xl font-bold text-gray-900">{mappedRows.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
            </div>
            <div className="rounded-lg border border-green-200 p-3 bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Valid rows</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${invalidRows.length > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
              <p className={`text-2xl font-bold ${invalidRows.length > 0 ? "text-amber-600" : "text-gray-500"}`}>{invalidRows.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Missing required fields</p>
            </div>
          </div>

          {/* Data quality score bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Data Quality Score</span>
              <span className={qualityPct >= 90 ? "text-green-600 font-semibold" : qualityPct >= 60 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                {qualityPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-2 rounded-full ${qualityPct >= 90 ? "bg-green-500" : qualityPct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${qualityPct}%` }}
              />
            </div>
          </div>

          {/* Dry-run preview — first 10 mapped rows */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Dry-run preview (first 10 rows)</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="text-xs min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {CRM_CONSTITUENT_FIELDS.filter((f) => f.key !== "skip").map((f) => (
                      <th key={f.key} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${f.required ? "text-green-700" : "text-gray-500"}`}>
                        {f.label}{f.required ? " *" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 10).map((row, ri) => {
                    const missing = CRM_CONSTITUENT_FIELDS.filter((f) => f.required && !row[f.key]?.trim());
                    return (
                      <tr key={ri} className={`border-t border-gray-100 ${missing.length > 0 ? "bg-amber-50" : ""}`}>
                        {CRM_CONSTITUENT_FIELDS.filter((f) => f.key !== "skip").map((f) => (
                          <td key={f.key} className={`px-3 py-1.5 whitespace-nowrap max-w-[120px] truncate ${f.required && !row[f.key]?.trim() ? "text-red-500 italic" : "text-gray-600"}`}>
                            {row[f.key] ?? (f.required ? "⚠ missing" : "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => setStep(3)} className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500">
              Check Duplicates →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Duplicate Detection ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{newRows.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">New records</p>
            </div>
            <div className={`rounded-lg border p-3 text-center ${duplicateRows.length > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
              <p className={`text-2xl font-bold ${duplicateRows.length > 0 ? "text-amber-600" : "text-gray-500"}`}>{duplicateRows.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Match existing by email</p>
            </div>
          </div>

          {duplicateRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ These rows match existing constituent emails:</p>
              <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50">
                <table className="text-xs min-w-full">
                  <thead className="bg-amber-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-amber-700">First Name</th>
                      <th className="px-3 py-2 text-left font-medium text-amber-700">Last Name</th>
                      <th className="px-3 py-2 text-left font-medium text-amber-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRows.slice(0, 10).map((row, ri) => (
                      <tr key={ri} className="border-t border-amber-200">
                        <td className="px-3 py-1.5 text-gray-700">{row.firstName}</td>
                        <td className="px-3 py-1.5 text-gray-700">{row.lastName}</td>
                        <td className="px-3 py-1.5 text-gray-700">{row.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => setStep(4)} className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500">
              Review &amp; Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Confirm ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-green-800">Import Summary</p>
            <p className="text-sm text-green-700">✓ {validRows.length} new records will be imported</p>
            {duplicateRows.length > 0 && (
              <p className="text-sm text-amber-700">⚠ {duplicateRows.length} rows skipped (duplicate email)</p>
            )}
            {invalidRows.length > 0 && (
              <p className="text-sm text-amber-700">⚠ {invalidRows.length} rows skipped (missing required fields)</p>
            )}
          </div>

          {/* Backend import not yet implemented */}
          {/* TODO: POST to /api/imports/constituents endpoint — not yet implemented */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Backend import endpoint not yet implemented. You can download the mapped CSV below to import manually.
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setStep(3)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
            <button
              onClick={downloadMappedCsv}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Mapped CSV
            </button>
            <button
              onClick={() => { setStep(0); setCsvHeaders([]); setCsvRows([]); setMappedRows([]); setFileName(""); }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
