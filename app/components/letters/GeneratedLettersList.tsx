/** Generated letters list with status updates and communication actions. */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { GeneratedLetterSummary } from "@/app/components/letters/types";

const STATUS_OPTIONS = ["ALL", "GENERATED", "PRINTED", "MAILED", "EMAIL_DRAFT_CREATED", "EMAIL_SENT", "ARCHIVED"] as const;

/** Lists generated letter instances and supports downstream workflow actions. */
export default function GeneratedLettersList() {
  const searchParams = useSearchParams();
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
      if (sourceTaskIdFilter) params.set("sourceTaskId", sourceTaskIdFilter);
      if (stewardPathEnrollmentIdFilter) params.set("stewardPathEnrollmentId", stewardPathEnrollmentIdFilter);
      const result = await apiFetch<GeneratedLetterSummary[]>(`/api/letters/generated?${params.toString()}`);
      setLetters(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load generated letters.");
    } finally {
      setLoading(false);
    }
  }, [status, sourceTaskIdFilter, stewardPathEnrollmentIdFilter]);

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

  /** Creates communication draft from one generated letter. */
  async function createEmailDraft(letterId: string) {
    setWorkingId(letterId);
    try {
      await apiFetch(`/api/letters/generated/${letterId}/create-email-draft`, { method: "POST" });
      await load();
    } finally {
      setWorkingId(null);
    }
  }

  /** Requests PDF export endpoint; currently returns partial implementation notice from backend. */
  async function exportPdf(letterId: string) {
    setWorkingId(letterId);
    try {
      await apiFetch(`/api/letters/generated/${letterId}/export-pdf`, { method: "POST" });
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : "PDF export currently partially implemented.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Generated Letters</h1>
          <p className="mt-0.5 text-sm text-gray-500">Track print status, mail status, and email drafts from generated communication records.</p>
        </div>
        <Link href="/letters-printables/generate" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          Generate New Letter
        </Link>
      </div>

      <LettersWorkspaceNav />

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
                      <Link href={`/letters-printables/generated?stewardPathEnrollmentId=${letter.stewardPathEnrollmentId}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100">
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
                    onClick={() => void createEmailDraft(letter.id)}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-60"
                  >
                    Create Email Draft
                  </button>
                  {letter.emailCampaignId && (
                    <Link href={`/communications/${letter.emailCampaignId}`} className="px-3 py-1.5 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
                      Open Draft
                    </Link>
                  )}
                  <button
                    onClick={() => void exportPdf(letter.id)}
                    disabled={workingId === letter.id}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Export PDF
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
