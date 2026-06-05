"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

type PreviewCandidate = {
  constituentId: string;
  reasons: string[];
  current: {
    firstName: string;
    lastName: string;
    type: string;
    tags: string[];
  };
  suggested: {
    entityKind: "ORGANIZATION";
    organizationName: string;
    displayName: string;
    type: "ORGANIZATION" | "FOUNDATION" | "SPONSOR";
    organizationCategory: string;
    groupType: "CHURCH" | "BUSINESS" | "ORGANIZATION";
    firstName: "";
    lastName: string;
    tags: string[];
  };
};

type PreviewResponse = {
  scanned: number;
  candidateCount: number;
  candidates: PreviewCandidate[];
};

export default function OrganizationConversionPage() {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, {
    organizationName: string;
    displayName: string;
    organizationCategory: string;
    groupType: "CHURCH" | "BUSINESS" | "ORGANIZATION";
    createConstituentGroup: boolean;
    constituentGroupName: string;
  }>>({});
  const [message, setMessage] = useState<string>("");

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, checked]) => checked).map(([id]) => id), [selected]);

  async function runScan() {
    setLoading(true);
    setMessage("");
    try {
      const result = await apiFetch<PreviewResponse>("/api/data-tools/organization-conversion/preview?limit=1000");
      setPreview(result);
      const nextSelected: Record<string, boolean> = {};
      const nextDrafts: typeof drafts = {};
      for (const candidate of result.candidates) nextSelected[candidate.constituentId] = true;
      for (const candidate of result.candidates) {
        nextDrafts[candidate.constituentId] = {
          organizationName: candidate.suggested.organizationName,
          displayName: candidate.suggested.displayName,
          organizationCategory: candidate.suggested.organizationCategory,
          groupType: candidate.suggested.groupType,
          createConstituentGroup: false,
          constituentGroupName: candidate.suggested.organizationName,
        };
      }
      setSelected(nextSelected);
      setDrafts(nextDrafts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to scan constituents.");
    } finally {
      setLoading(false);
    }
  }

  async function applySelected() {
    if (!preview || selectedIds.length === 0) return;
    setApplying(true);
    setMessage("");

    try {
      const conversions = preview.candidates
        .filter((candidate) => selected[candidate.constituentId])
        .map((candidate) => ({
          constituentId: candidate.constituentId,
          organizationName: drafts[candidate.constituentId]?.organizationName ?? candidate.suggested.organizationName,
          displayName: drafts[candidate.constituentId]?.displayName ?? candidate.suggested.displayName,
          type: candidate.suggested.type,
          organizationCategory: drafts[candidate.constituentId]?.organizationCategory ?? candidate.suggested.organizationCategory,
          groupType: drafts[candidate.constituentId]?.groupType ?? candidate.suggested.groupType,
          keepOriginalNameInNotes: true,
          addTags: true,
          createConstituentGroup: drafts[candidate.constituentId]?.createConstituentGroup === true,
          constituentGroupName: drafts[candidate.constituentId]?.constituentGroupName ?? candidate.suggested.organizationName,
        }));

      const response = await apiFetch<{ appliedCount: number; skippedCount: number }>("/api/data-tools/organization-conversion/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversions }),
      });

      setMessage(`Applied ${response.appliedCount} conversion(s). Skipped ${response.skippedCount}.`);
      await runScan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to apply conversions.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Convert People-Split Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Scan for likely organizations currently split across first/last name, review suggestions, then apply selected conversions.
          </p>
        </div>
        <Link href="/data-tools" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back to Data Tools
        </Link>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Scanning..." : "Step 1: Scan"}
          </button>
          <button
            type="button"
            onClick={applySelected}
            disabled={applying || selectedIds.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {applying ? "Applying..." : `Step 4: Apply Selected (${selectedIds.length})`}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Workflow: Scan, review candidates, select rows, apply, then verify the audit trail.
        </p>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </section>

      {preview ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
            <span>Scanned: <strong>{preview.scanned}</strong></span>
            <span>Candidates: <strong>{preview.candidateCount}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-275 border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Apply</th>
                  <th className="px-3 py-2">Current</th>
                  <th className="px-3 py-2">Conversion</th>
                  <th className="px-3 py-2">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {preview.candidates.map((candidate) => (
                  <tr key={candidate.constituentId} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[candidate.constituentId])}
                        onChange={(event) => setSelected((prev) => ({ ...prev, [candidate.constituentId]: event.target.checked }))}
                        aria-label={`Select conversion ${candidate.constituentId}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p><span className="font-medium">First:</span> {candidate.current.firstName || "(blank)"}</p>
                      <p><span className="font-medium">Last:</span> {candidate.current.lastName || "(blank)"}</p>
                      <p><span className="font-medium">Type:</span> {candidate.current.type}</p>
                      <p><span className="font-medium">Tags:</span> {candidate.current.tags.join(", ") || "(none)"}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-600">
                          Organization Name
                          <input
                            value={drafts[candidate.constituentId]?.organizationName ?? candidate.suggested.organizationName}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [candidate.constituentId]: {
                                ...current[candidate.constituentId],
                                organizationName: event.target.value,
                                displayName: event.target.value,
                                constituentGroupName: current[candidate.constituentId]?.constituentGroupName || event.target.value,
                              },
                            }))}
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">
                          Organization Kind
                          <select
                            value={drafts[candidate.constituentId]?.groupType ?? candidate.suggested.groupType}
                            onChange={(event) => {
                              const groupType = event.target.value as "CHURCH" | "BUSINESS" | "ORGANIZATION";
                              const organizationCategory = groupType === "CHURCH" ? "CHURCH" : groupType === "BUSINESS" ? "BUSINESS" : "ORGANIZATION";
                              setDrafts((current) => ({
                                ...current,
                                [candidate.constituentId]: {
                                  ...current[candidate.constituentId],
                                  groupType,
                                  organizationCategory,
                                },
                              }));
                            }}
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                          >
                            <option value="ORGANIZATION">Organization</option>
                            <option value="CHURCH">Church</option>
                            <option value="BUSINESS">Business</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={drafts[candidate.constituentId]?.createConstituentGroup === true}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [candidate.constituentId]: {
                                ...current[candidate.constituentId],
                                createConstituentGroup: event.target.checked,
                              },
                            }))}
                          />
                          Create constituent group
                        </label>
                        {(drafts[candidate.constituentId]?.createConstituentGroup ?? false) ? (
                          <label className="block text-xs font-medium text-slate-600">
                            Group Name
                            <input
                              value={drafts[candidate.constituentId]?.constituentGroupName ?? candidate.suggested.organizationName}
                              onChange={(event) => setDrafts((current) => ({
                                ...current,
                                [candidate.constituentId]: {
                                  ...current[candidate.constituentId],
                                  constituentGroupName: event.target.value,
                                },
                              }))}
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                            />
                          </label>
                        ) : null}
                        <div className="text-xs text-slate-500">
                          <p><span className="font-medium text-slate-700">Entity Kind:</span> {candidate.suggested.entityKind}</p>
                          <p><span className="font-medium text-slate-700">Legacy Last:</span> {candidate.suggested.lastName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ul className="list-disc pl-5 text-slate-700">
                        {candidate.reasons.map((reason, index) => (
                          <li key={`${candidate.constituentId}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
                {preview.candidates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                      No conversion candidates found in this scan.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
