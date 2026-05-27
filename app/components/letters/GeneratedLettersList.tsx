/** Generated letters list with print and mail workflow actions. */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { GeneratedLetterSummary } from "@/app/components/letters/types";

const STATUS_OPTIONS = ["ALL", "GENERATED", "PRINTED", "MAILED", "ARCHIVED"] as const;

interface GeneratedLettersListProps {
  embedded?: boolean;
}

/** Lists generated letter instances and supports downstream workflow actions. */
export default function GeneratedLettersList({ embedded = false }: GeneratedLettersListProps) {
  const searchParams = useSearchParams();
  const templateIdFilter = searchParams.get("templateId") || "";
  const sourceTaskIdFilter = searchParams.get("sourceTaskId") || "";
  const stewardPathEnrollmentIdFilter = searchParams.get("stewardPathEnrollmentId") || "";

  const [letters, setLetters] = useState<GeneratedLetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (templateIdFilter) params.set("templateId", templateIdFilter);
      if (sourceTaskIdFilter) params.set("sourceTaskId", sourceTaskIdFilter);
      if (stewardPathEnrollmentIdFilter) params.set("stewardPathEnrollmentId", stewardPathEnrollmentIdFilter);
      const result = await apiFetch<GeneratedLetterSummary[]>(`/api/letters/generated?${params.toString()}`);
      setLetters(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load generated letters.");
    } finally {
      setLoading(false);
    }
  }, [status, templateIdFilter, sourceTaskIdFilter, stewardPathEnrollmentIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Updates generated letter status and refreshes list state. */
  async function setLetterStatus(letterId: string, nextStatus: string) {
    setWorkingId(letterId);
    try {
      await apiFetch(`/api/letters/generated/${letterId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } finally {
      setWorkingId(null);
    }
  }

  /** Requests server PDF export endpoint and downloads the generated PDF binary. */
  async function exportPdf(letterId: string) {
    setWorkingId(letterId);
    setError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/generated/${letterId}/export-pdf`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to export generated letter PDF.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || `generated-letter-${letterId}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to export generated letter PDF.");
    } finally {
      setWorkingId(null);
    }
  }

  /** Creates one Communications draft from a generated letter and opens it in Communications. */
  async function createEmailDraft(letterId: string) {
    setWorkingId(letterId);
    setError(null);
    try {
      const result = await apiFetch<{ emailCampaign?: { id: string } }>(`/api/letters/generated/${letterId}/create-email-draft`, {
        method: "POST",
      });
      if (result?.emailCampaign?.id) {
        window.location.href = `/communications/${result.emailCampaign.id}`;
        return;
      }
      throw new Error("Email draft created without an id.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create email draft.");
    } finally {
      setWorkingId(null);
    }
  }

  /** Opens browser print fallback using merged print HTML when server PDF is unavailable. */
  function openBrowserPrint(letter: GeneratedLetterSummary) {
    const printHtml = letter.mergedPrintBody;
    if (!printHtml) {
      setError("This generated letter does not include merged print output for browser fallback.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to use browser print fallback.");
      return;
    }

    const title = letter.mergedPrintSubject || letter.template?.name || "Generated Letter";

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #111827; }
      hr[data-page-break="true"] { border: 0; border-top: 2px dashed #9ca3af; margin: 24px 0; }
    </style>
  </head>
  <body>
    ${printHtml}
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`);
    printWindow.document.close();
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Generated Media</h1>
            <p className="mt-0.5 text-sm text-gray-500">Track, preview, and fulfill donor-specific generated outputs through print and mail queues.</p>
          </div>
          <Link href="/oyama-letters/generate" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            Generate New Media
          </Link>
        </div>
      )}

      {!embedded && <LettersWorkspaceNav />}

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((entry) => (
          <button
            key={entry}
            onClick={() => setStatus(entry)}
            className={`px-3 py-1.5 text-sm rounded-full border ${status === entry ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            {entry}
          </button>
        ))}
        <button onClick={() => void load()} className="px-3 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-gray-300">Refresh</button>
        {sourceTaskIdFilter && (
          <span className="px-3 py-1.5 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700">
            Filter: Source Task {sourceTaskIdFilter}
          </span>
        )}
        {templateIdFilter && (
          <span className="px-3 py-1.5 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
            Filter: Draft Template {templateIdFilter}
          </span>
        )}
        {stewardPathEnrollmentIdFilter && (
          <span className="px-3 py-1.5 text-xs rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
            Filter: Steward Enrollment {stewardPathEnrollmentIdFilter}
          </span>
        )}
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={String(index)} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))
        ) : letters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">No generated letters found.</div>
        ) : (
          letters.map((letter) => (
            <div key={letter.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{letter.template?.name || "Template"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {letter.category.replaceAll("_", " ")} · {letter.status}
                    {letter.constituent && ` · ${letter.constituent.firstName} ${letter.constituent.lastName}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {letter.sourceTaskId && (
                      <Link href={`/tasks?taskId=${letter.sourceTaskId}`} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100">
                        Linked Task
                      </Link>
                    )}
                    {letter.stewardPathEnrollmentId && (
                      <Link href={`/letters-printables/queues?view=production&stewardPathEnrollmentId=${letter.stewardPathEnrollmentId}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100">
                        Steward Path
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Generated {new Date(letter.generatedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => void setLetterStatus(letter.id, "PRINTED")}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Mark Printed
                  </button>
                  <button
                    onClick={() => void setLetterStatus(letter.id, "MAILED")}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Mark Mailed
                  </button>
                  <button
                    onClick={() => void exportPdf(letter.id)}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Export PDF
                  </button>
                  {letter.emailCampaignId ? (
                    <Link
                      href={`/communications/${letter.emailCampaignId}`}
                      className="px-3 py-1.5 text-xs rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      Open Email Draft
                    </Link>
                  ) : (
                    <button
                      onClick={() => void createEmailDraft(letter.id)}
                      disabled={workingId === letter.id}
                      className="px-3 py-1.5 text-xs rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Create Email Draft
                    </button>
                  )}
                  <button
                    onClick={() => openBrowserPrint(letter)}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Browser Print
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
