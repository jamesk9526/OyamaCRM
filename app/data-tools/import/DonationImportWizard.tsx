"use client";
/**
 * DonationImportWizard — 5-step CSV import tool for historical donation data.
 *
 * Steps:
 *   1. Upload File    — parse CSV, detect headers, show file summary
 *   2. Map Fields     — assign source columns → donation fields (amount/date required)
 *   3. Review         — validate amounts/dates, preview matched constituent count
 *   4. Settings       — matching strategy, dedup, dry run toggle
 *   5. Confirm        — run import and show results
 */

import { useState, useRef, useCallback, useMemo } from "react";
import {
  CRM_DONATION_FIELDS,
  DONATION_AUTO_MAP_ALIASES,
  DONATION_FIELD_GROUPS,
  parseAmount,
  parseDonationDate,
} from "./donationFieldMap";
import type { DonationField } from "./donationFieldMap";
import { parseCSV, computeColumnStats } from "./csvParser";
import type { CsvParseResult, ColumnStats } from "./csvParser";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Maps each CSV column header to a donation field key (or "skip") */
type FieldMapping = Record<string, string>;

/** A fully-mapped row ready for import */
type MappedRow = Record<string, string>;

/** Validation summary computed in Step 3 */
interface ValidationSummary {
  total: number;
  validRows: MappedRow[];
  missingAmount: number;
  invalidAmount: number;
  missingDate: number;
  invalidDate: number;
  hasConstituentMatch: number; // rows with at least one constituent identifier
  noConstituentMatch: number;
  warnings: string[];
}

/** Result returned from the import API */
interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  unmatched: number;
  dryRun: boolean;
  errorMessages?: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Upload File" },
  { id: 2, label: "Map Fields" },
  { id: 3, label: "Review & Validate" },
  { id: 4, label: "Import Settings" },
  { id: 5, label: "Confirm & Import" },
];

/** Constituent-matching field keys — any of these being mapped enables donor matching */
const CONSTITUENT_MATCH_KEYS = new Set([
  "constituentEmail",
  "constituentExternalId",
  "constituentFirstName",
  "constituentLastName",
  "constituentName",
]);

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Generate initial auto-mapping from CSV headers using the alias table */
function autoMap(headers: string[]): FieldMapping {
  const m: FieldMapping = {};
  for (const h of headers) {
    m[h] = DONATION_AUTO_MAP_ALIASES[h.toLowerCase().trim()] ?? "skip";
  }
  return m;
}

/** Returns true if a field key maps to a constituent-matching field */
function isMatchField(key: string) {
  return CONSTITUENT_MATCH_KEYS.has(key);
}

/** Compute validation summary for the mapped rows */
function validate(rows: Array<Record<string, string>>, mapping: FieldMapping): ValidationSummary {
  // Invert mapping: crmKey → csvHeader
  const reverseMap: Record<string, string> = {};
  for (const [csv, crm] of Object.entries(mapping)) {
    if (crm !== "skip") reverseMap[crm] = csv;
  }

  const hasAmountCol = "amount" in reverseMap;
  const hasDateCol = "date" in reverseMap;

  let missingAmount = 0;
  let invalidAmount = 0;
  let missingDate = 0;
  let invalidDate = 0;
  let hasConstituentMatch = 0;
  let noConstituentMatch = 0;
  const validRows: MappedRow[] = [];
  const warnings: string[] = [];

  const mappedMatchKeys = Object.values(mapping).filter((v) => isMatchField(v));
  if (mappedMatchKeys.length === 0) {
    warnings.push("No constituent matching fields are mapped. Donations will be imported without linking to any donor record.");
  }

  for (const row of rows) {
    const mapped: MappedRow = {};
    for (const [csv, crm] of Object.entries(mapping)) {
      if (crm !== "skip") mapped[crm] = row[csv] ?? "";
    }

    // Validate amount
    if (!hasAmountCol) { missingAmount++; }
    else {
      const amt = parseAmount(mapped.amount ?? "");
      if (amt === null) {
        if (!mapped.amount?.trim()) missingAmount++;
        else invalidAmount++;
        continue;
      }
    }

    // Validate date
    if (!hasDateCol) { missingDate++; }
    else {
      const dt = parseDonationDate(mapped.date ?? "");
      if (dt === null) {
        if (!mapped.date?.trim()) missingDate++;
        else invalidDate++;
        continue;
      }
    }

    // Check constituent match
    const hasMatch = mappedMatchKeys.some((k) => mapped[k]?.trim());
    if (hasMatch) hasConstituentMatch++;
    else noConstituentMatch++;

    validRows.push(mapped);
  }

  if (!hasAmountCol) warnings.push("Amount column is not mapped — no donations can be imported.");
  if (!hasDateCol) warnings.push("Gift Date column is not mapped — no donations can be imported.");
  if (invalidAmount > 0) warnings.push(`${invalidAmount} rows have invalid (non-numeric) amount values and will be skipped.`);
  if (invalidDate > 0) warnings.push(`${invalidDate} rows have unparseable date values and will be skipped.`);
  if (noConstituentMatch > 0 && mappedMatchKeys.length > 0) {
    warnings.push(`${noConstituentMatch} rows are missing all constituent matching fields and may be imported without a linked donor.`);
  }

  return {
    total: rows.length,
    validRows,
    missingAmount,
    invalidAmount,
    missingDate,
    invalidDate,
    hasConstituentMatch,
    noConstituentMatch,
    warnings,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Left sidebar progress stepper */
function StepperSidebar({ step }: { step: number }) {
  return (
    <div className="w-48 flex-shrink-0">
      <nav className="space-y-1">
        {STEPS.map((s) => {
          const done = s.id < step;
          const active = s.id === step;
          return (
            <div key={s.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
              active ? "bg-green-50 text-green-700 font-semibold" :
              done   ? "text-gray-500" : "text-gray-400"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                done   ? "bg-green-500 text-white" :
                active ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {done ? "✓" : s.id}
              </span>
              {s.label}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/** Summary stat card */
function StatCard({ label, value, color = "gray" }: { label: string; value: string | number; color?: "green" | "amber" | "red" | "blue" | "gray" }) {
  const colors: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-700 border-red-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
    gray:  "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`border rounded-lg px-4 py-3 ${colors[color]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/** The full 5-step donation CSV import wizard. */
export default function DonationImportWizard() {
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [columnStats, setColumnStats] = useState<Record<string, ColumnStats>>({});
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [matchEmail, setMatchEmail] = useState(true);
  const [matchExternalId, setMatchExternalId] = useState(true);
  const [matchName, setMatchName] = useState(true);
  const [skipUnmatched, setSkipUnmatched] = useState(false);
  const [dedupByReceipt, setDedupByReceipt] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Step 1: File Upload ────────────────────────────────────────────────

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      const stats = computeColumnStats(result.headers, result.rows);
      setParsed(result);
      setColumnStats(stats);
      setMapping(autoMap(result.headers));
    };
    reader.readAsText(file);
  }, []);

  // ─── Step 2: Field Mapping ──────────────────────────────────────────────

  const mappedRequiredKeys = useMemo(() => {
    const mapped = new Set(Object.values(mapping));
    return CRM_DONATION_FIELDS.filter((f) => f.required && mapped.has(f.key)).map((f) => f.key);
  }, [mapping]);

  const requiredMissing = useMemo(() =>
    CRM_DONATION_FIELDS.filter((f) => f.required && !mappedRequiredKeys.includes(f.key)),
  [mappedRequiredKeys]);

  const canProceedToStep3 = useMemo(() => requiredMissing.length === 0, [requiredMissing]);

  const getMappingBadge = useCallback((crmKey: string) => {
    if (crmKey === "skip") return "bg-gray-100 text-gray-500";
    const field = CRM_DONATION_FIELDS.find((f) => f.key === crmKey);
    if (!field) return "bg-gray-100 text-gray-500";
    if (field.required) return "bg-green-50 text-green-700 border border-green-200";
    if (isMatchField(crmKey)) return "bg-blue-50 text-blue-700 border border-blue-200";
    return "bg-gray-50 text-gray-600 border border-gray-200";
  }, []);

  // ─── Step 3: Validate ───────────────────────────────────────────────────

  const runValidation = useCallback(() => {
    if (!parsed) return;
    const v = validate(parsed.rows, mapping);
    setValidation(v);
  }, [parsed, mapping]);

  // ─── Step 5: Import ─────────────────────────────────────────────────────

  const runImport = useCallback(async () => {
    if (!validation) return;
    setImporting(true);
    try {
      const res = await apiFetch<ImportResult>("/api/donations/import", {
        method: "POST",
        body: JSON.stringify({
          records: validation.validRows,
          dryRun,
          matchEmail,
          matchExternalId,
          matchName,
          skipUnmatched,
          dedupByReceipt,
          updateExisting,
        }),
      });
      setResult(res);
      setStep(5);
    } catch (err) {
      setResult({
        created: 0, skipped: 0, errors: 1, unmatched: 0, dryRun,
        errorMessages: [err instanceof Error ? err.message : "Unknown error"],
      });
      setStep(5);
    } finally {
      setImporting(false);
    }
  }, [validation, dryRun, matchEmail, matchExternalId, matchName, skipUnmatched, dedupByReceipt, updateExisting]);

  const reset = useCallback(() => {
    setStep(1); setParsed(null); setFileName(""); setColumnStats({});
    setMapping({}); setValidation(null); setResult(null); setSelectedCol(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6">
      {/* Stepper sidebar */}
      <StepperSidebar step={step} />

      {/* Main content */}
      <div className="flex-1 min-w-0">

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Upload Donation CSV</h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload a CSV export from Bloomerang, NeonCRM, eKYROS, spreadsheets, or any system.
                The wizard auto-detects headers and maps columns to donation fields.
              </p>
            </div>

            {/* Drop zone */}
            <label className="block border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors">
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="sr-only" onChange={onFile} />
              <div className="text-4xl mb-3">📤</div>
              <div className="text-sm font-medium text-gray-700">Click to select a CSV file</div>
              <div className="text-xs text-gray-400 mt-1">or drag and drop your donation export here</div>
            </label>

            {parsed && (
              <>
                {/* File summary */}
                <div className="grid grid-cols-4 gap-3">
                  <StatCard label="File" value={fileName} color="gray" />
                  <StatCard label="Records" value={parsed.rows.length.toLocaleString()} color="blue" />
                  <StatCard label="Columns" value={parsed.headers.length} color="gray" />
                  <StatCard label="Header Row" value={`Row ${parsed.detectedHeaderRow}`} color="green" />
                </div>

                {/* Column preview */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Detected Columns</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4">
                    {parsed.headers.map((h) => (
                      <span key={h} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 font-mono">{h}</span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                >
                  Map Fields →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Map Fields ── */}
        {step === 2 && parsed && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Map Fields</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Assign each source column to the correct donation field.
                  <span className="ml-1 text-green-700 font-medium">Green = required.</span>
                  <span className="ml-1 text-blue-700 font-medium">Blue = constituent matching.</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
                <button
                  onClick={() => { runValidation(); setStep(3); }}
                  disabled={!canProceedToStep3}
                  className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review →
                </button>
              </div>
            </div>

            {/* Required field warnings */}
            {requiredMissing.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>Required fields not yet mapped:</strong>{" "}
                {requiredMissing.map((f) => f.label).join(", ")}
              </div>
            )}

            {/* Mapping table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-1/3">Source Column</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-1/4">Sample Values</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Maps To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.headers.map((h) => {
                    const crmKey = mapping[h] ?? "skip";
                    const stats = columnStats[h];
                    const badgeCls = getMappingBadge(crmKey);
                    const isFocused = selectedCol === h;

                    return (
                      <tr
                        key={h}
                        onClick={() => setSelectedCol(isFocused ? null : h)}
                        className={`cursor-pointer hover:bg-gray-50 ${isFocused ? "bg-blue-50/30" : ""}`}
                      >
                        {/* Source column */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 font-mono text-xs">{h}</div>
                          {stats && (
                            <div className="flex gap-2 mt-1 text-xs text-gray-400">
                              <span>{stats.fillRate}% filled</span>
                              <span>·</span>
                              <span>{stats.uniqueCount} unique</span>
                              <span>·</span>
                              <span className="text-gray-500">{stats.detectedType}</span>
                            </div>
                          )}
                        </td>

                        {/* Sample values */}
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {(stats?.sampleValues ?? []).slice(0, 3).map((v, i) => (
                              <div key={i} className="text-xs text-gray-500 truncate max-w-[160px]">{v}</div>
                            ))}
                          </div>
                        </td>

                        {/* Destination dropdown */}
                        <td className="px-4 py-3">
                          <select
                            value={crmKey}
                            onChange={(e) => {
                              e.stopPropagation();
                              setMapping((m) => ({ ...m, [h]: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="skip">— Skip this column —</option>
                            {Object.entries(DONATION_FIELD_GROUPS).map(([group, fields]) => (
                              <optgroup key={group} label={group}>
                                {fields.map((f: DonationField) => (
                                  <option key={f.key} value={f.key}>
                                    {f.required ? "★ " : ""}{f.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {crmKey !== "skip" && (
                            <span className={`mt-1 inline-flex px-2 py-0.5 rounded text-xs font-medium ${badgeCls}`}>
                              {crmKey}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Field details panel for selected column */}
            {selectedCol && columnStats[selectedCol] && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <div className="font-semibold text-blue-800 mb-2">{selectedCol} — Field Details</div>
                <div className="grid grid-cols-3 gap-4 text-xs text-blue-700 mb-3">
                  <div><span className="font-medium">Type:</span> {columnStats[selectedCol].detectedType}</div>
                  <div><span className="font-medium">Fill rate:</span> {columnStats[selectedCol].fillRate}%</div>
                  <div><span className="font-medium">Unique values:</span> {columnStats[selectedCol].uniqueCount}</div>
                </div>
                <div className="text-xs text-blue-700">
                  <span className="font-medium">Sample values:</span>{" "}
                  {columnStats[selectedCol].sampleValues.join(", ")}
                </div>
                {mapping[selectedCol] !== "skip" && (
                  <div className="mt-2 text-xs text-blue-600">
                    {CRM_DONATION_FIELDS.find((f) => f.key === mapping[selectedCol])?.hint}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Review & Validate ── */}
        {step === 3 && validation && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Review & Validate</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {validation.validRows.length.toLocaleString()} of {validation.total.toLocaleString()} rows are valid and ready to import.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
                <button
                  onClick={() => setStep(4)}
                  disabled={validation.validRows.length === 0}
                  className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
                >
                  Import Settings →
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Total Rows" value={validation.total} color="gray" />
              <StatCard label="Valid Rows" value={validation.validRows.length} color="green" />
              <StatCard
                label="Skipped (errors)"
                value={validation.total - validation.validRows.length}
                color={validation.total - validation.validRows.length > 0 ? "red" : "gray"}
              />
              <StatCard
                label="With Donor Match"
                value={validation.hasConstituentMatch}
                color="blue"
              />
            </div>

            {/* Issue breakdown */}
            {(validation.missingAmount > 0 || validation.invalidAmount > 0 || validation.missingDate > 0 || validation.invalidDate > 0) && (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                <div className="px-4 py-3 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Validation Issues</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  {validation.missingAmount > 0 && (
                    <div className="text-red-600">❌ {validation.missingAmount} rows missing amount</div>
                  )}
                  {validation.invalidAmount > 0 && (
                    <div className="text-red-600">❌ {validation.invalidAmount} rows with invalid amount</div>
                  )}
                  {validation.missingDate > 0 && (
                    <div className="text-red-600">❌ {validation.missingDate} rows missing date</div>
                  )}
                  {validation.invalidDate > 0 && (
                    <div className="text-red-600">❌ {validation.invalidDate} rows with invalid date</div>
                  )}
                  {validation.noConstituentMatch > 0 && (
                    <div className="text-amber-600">⚠️ {validation.noConstituentMatch} rows have no donor identifier</div>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                {validation.warnings.map((w, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2">
                    ⚠️ {w}
                  </div>
                ))}
              </div>
            )}

            {/* Preview table */}
            {validation.validRows.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Preview — First {Math.min(10, validation.validRows.length)} Records
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {["amount", "date", "paymentMethod", "constituentEmail", "constituentName", "campaignName", "designationName"].map((k) =>
                          Object.keys(validation.validRows[0]).includes(k) ? (
                            <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium">{k}</th>
                          ) : null
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {validation.validRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {["amount", "date", "paymentMethod", "constituentEmail", "constituentName", "campaignName", "designationName"].map((k) =>
                            Object.keys(validation.validRows[0]).includes(k) ? (
                              <td key={k} className="px-3 py-2 text-gray-700 truncate max-w-[140px]">{row[k] || "—"}</td>
                            ) : null
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Import Settings ── */}
        {step === 4 && validation && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Import Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Configure how donations are matched to existing constituents and how duplicates are handled.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
                <button
                  onClick={runImport}
                  disabled={importing}
                  className={`px-5 py-1.5 text-sm font-medium text-white rounded-lg ${dryRun ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"} disabled:opacity-50`}
                >
                  {importing ? "Running…" : dryRun ? "▶ Run Dry Run" : `⬆ Import ${validation.validRows.length} Donations`}
                </button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Constituent matching */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Constituent Matching</h3>
                <p className="text-xs text-gray-500">How to link each donation row to an existing donor record. Multiple methods are tried in order.</p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={matchEmail} onChange={(e) => setMatchEmail(e.target.checked)} className="rounded accent-green-600" />
                  <span className="text-sm text-gray-700">Match by email address</span>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-auto">Best</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={matchExternalId} onChange={(e) => setMatchExternalId(e.target.checked)} className="rounded accent-green-600" />
                  <span className="text-sm text-gray-700">Match by external ID (DirID)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={matchName} onChange={(e) => setMatchName(e.target.checked)} className="rounded accent-green-600" />
                  <span className="text-sm text-gray-700">Match by name (first + last)</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-auto">Fuzzy</span>
                </label>
                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={skipUnmatched} onChange={(e) => setSkipUnmatched(e.target.checked)} className="rounded accent-green-600" />
                    <span className="text-sm text-gray-700">Skip rows with no constituent match</span>
                  </label>
                  {!skipUnmatched && (
                    <p className="text-xs text-amber-600 mt-1 ml-7">Unmatched donations will be imported without a linked donor.</p>
                  )}
                </div>
              </div>

              {/* Deduplication */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Deduplication</h3>
                <p className="text-xs text-gray-500">Prevent duplicate donations from being imported if this CSV is re-imported later.</p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={dedupByReceipt} onChange={(e) => setDedupByReceipt(e.target.checked)} className="rounded accent-green-600" />
                  <span className="text-sm text-gray-700">Skip if receipt number already exists in CRM</span>
                </label>
                {dedupByReceipt && (
                  <label className="flex items-center gap-2.5 cursor-pointer ml-6">
                    <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="rounded accent-green-600" />
                    <span className="text-sm text-gray-700">Update existing donation with new data <span className="text-xs text-green-700">(recommended)</span></span>
                  </label>
                )}
                <p className="text-xs text-gray-400">Receipt number must be mapped in Step 2 for this to apply.</p>
              </div>

              {/* Dry run toggle */}
              <div className={`border-2 rounded-lg p-5 space-y-3 col-span-2 ${dryRun ? "border-blue-300 bg-blue-50" : "border-green-300 bg-green-50"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {dryRun ? "🔍 Dry Run Mode (No data will be written)" : "✅ Live Import Mode"}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {dryRun
                        ? "A dry run simulates the import and reports what would be created, skipped, and unmatched — without writing any records."
                        : "Live import will write donation records to the CRM and update donor giving statistics immediately."}
                    </p>
                  </div>
                  <button
                    onClick={() => setDryRun(!dryRun)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg ${dryRun ? "bg-blue-600 text-white" : "bg-green-600 text-white"}`}
                  >
                    {dryRun ? "Switch to Live Import" : "Switch to Dry Run"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Results ── */}
        {step === 5 && result && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {result.dryRun ? "Dry Run Complete" : "Import Complete"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {result.dryRun ? "No records were written. Review results and switch to Live Import to commit." : "Donations have been imported and donor giving statistics updated."}
              </p>
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label={result.dryRun ? "Would Create" : "Created"} value={result.created} color="green" />
              <StatCard label="Skipped / Dedup" value={result.skipped} color="gray" />
              <StatCard label="Unmatched Donors" value={result.unmatched} color={result.unmatched > 0 ? "amber" : "gray"} />
              <StatCard label="Errors" value={result.errors} color={result.errors > 0 ? "red" : "gray"} />
            </div>

            {/* Error messages */}
            {result.errorMessages && result.errorMessages.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
                <div className="text-sm font-semibold text-red-700 mb-2">Errors during import:</div>
                {result.errorMessages.map((e, i) => (
                  <div key={i} className="text-xs text-red-600 font-mono">{e}</div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {result.dryRun && (
                <button
                  onClick={() => { setDryRun(false); setStep(4); }}
                  className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  ⬆ Run Live Import
                </button>
              )}
              <button
                onClick={reset}
                className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Import Another File
              </button>
              <a
                href="/donations"
                className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                View Donations →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
