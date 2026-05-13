/** Batch generation workspace for producing print-ready letters at scale with skip reporting. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { LetterTemplateSummary } from "@/app/components/letters/types";

const FILTER_TYPES = ["ALL", "ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"] as const;

interface BatchResponse {
  dryRun: boolean;
  templateId: string;
  totalSelected: number;
  eligible: number;
  generatedCount: number;
  skippedCount: number;
  skippedByReason: Record<string, number>;
  skipped: Array<{ constituentId: string; reason: string }>;
  generated: Array<{ id: string; constituentId: string; constituentName: string }>;
  addToPrintQueue: boolean;
}

/** Runs batch letter generation with dry-run previews and detailed skip reasons. */
export default function LetterBatchGenerationCenter() {
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [filterType, setFilterType] = useState<(typeof FILTER_TYPES)[number]>("ALL");
  const [constituentIdsText, setConstituentIdsText] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [dryRun, setDryRun] = useState(true);
  const [addToPrintQueue, setAddToPrintQueue] = useState(true);
  const [dedupeHousehold, setDedupeHousehold] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResponse | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const rows = await apiFetch<LetterTemplateSummary[]>("/api/letters/templates?status=ACTIVE");
      setTemplates(rows);
      if (!templateId && rows[0]) setTemplateId(rows[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load active templates.");
    } finally {
      setLoadingTemplates(false);
    }
  }, [templateId]);

  // Load active templates at startup so one can be selected for batch execution.
  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  /** Parses comma/newline separated IDs into one clean list. */
  function parseConstituentIds(raw: string): string[] {
    return raw
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  /** Submits one batch generation run and stores the backend result summary. */
  async function runBatch() {
    if (!templateId) {
      setError("Select a template before running batch generation.");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const response = await apiFetch<BatchResponse>("/api/letters/generated/batch", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          filterType,
          constituentIds: parseConstituentIds(constituentIdsText),
          year: Number.parseInt(year, 10),
          dryRun,
          addToPrintQueue,
          dedupeHousehold,
        }),
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Batch generation failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Batch Generate Letters</h1>
        <p className="mt-0.5 text-sm text-gray-500">Generate stewardship letters for many constituents with eligibility checks, dry-runs, and queue handoff.</p>
      </div>

      <LettersWorkspaceNav />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm text-gray-700">
            Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} disabled={loadingTemplates} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Choose template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-700">
            Donor Filter
            <select value={filterType} onChange={(event) => setFilterType(event.target.value as (typeof FILTER_TYPES)[number])} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {FILTER_TYPES.map((entry) => (
                <option key={entry} value={entry}>{entry.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-700">
            Year
            <input value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>

        <label className="block text-sm text-gray-700">
          Optional Specific Constituent IDs
          <textarea
            value={constituentIdsText}
            onChange={(event) => setConstituentIdsText(event.target.value)}
            rows={3}
            placeholder="Paste constituent IDs separated by commas or new lines"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
            Dry-run only (no records saved)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={addToPrintQueue} onChange={(event) => setAddToPrintQueue(event.target.checked)} />
            Add generated letters to print queue
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={dedupeHousehold} onChange={(event) => setDedupeHousehold(event.target.checked)} />
            Dedupe by household
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void runBatch()} disabled={working || loadingTemplates} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
            {working ? "Running..." : dryRun ? "Run Dry-Run" : "Generate Batch"}
          </button>
          <button onClick={() => void loadTemplates()} disabled={loadingTemplates} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Refresh Templates
          </button>
        </div>
      </section>

      {result && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Batch Result</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Selected</p><p className="text-lg font-semibold text-gray-900">{result.totalSelected}</p></div>
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Eligible</p><p className="text-lg font-semibold text-gray-900">{result.eligible}</p></div>
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Generated</p><p className="text-lg font-semibold text-gray-900">{result.generatedCount}</p></div>
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Skipped</p><p className="text-lg font-semibold text-gray-900">{result.skippedCount}</p></div>
            <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Mode</p><p className="text-lg font-semibold text-gray-900">{result.dryRun ? "Dry-Run" : "Saved"}</p></div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Skipped By Reason</p>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                {Object.keys(result.skippedByReason).length === 0 ? (
                  <p>No skipped records.</p>
                ) : (
                  Object.entries(result.skippedByReason).map(([reason, count]) => (
                    <p key={reason}>{reason.replaceAll("_", " ")}: {count}</p>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Generated Sample</p>
              <div className="mt-2 space-y-1 text-sm text-gray-700 max-h-40 overflow-auto">
                {result.generated.length === 0 ? (
                  <p>No generated records in this run.</p>
                ) : (
                  result.generated.slice(0, 25).map((entry, index) => (
                    <p key={`${entry.constituentId}-${String(index)}`}>{entry.constituentName || entry.constituentId}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
