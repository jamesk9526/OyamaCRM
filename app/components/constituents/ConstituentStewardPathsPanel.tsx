"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

interface PathTemplate {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  steps: Array<{ id: string; name: string; stepType: string; orderIndex: number; isActive: boolean }>;
}

interface PathEnrollment {
  id: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  startedAt: string;
  nextStepDueAt?: string | null;
  path: { id: string; name: string; status: string };
  currentStep?: { id: string; name: string; stepType: string; orderIndex: number } | null;
}

function enrollmentTone(status: PathEnrollment["status"]): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "PAUSED") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function formatDueAt(value?: string | null): string {
  if (!value) return "No scheduled step";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No scheduled step" : `Next ${date.toLocaleString()}`;
}

/** Current Steward Paths and enrollment control for one constituent profile. */
export default function ConstituentStewardPathsPanel({ constituentId }: { constituentId: string }) {
  const [templates, setTemplates] = useState<PathTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<PathEnrollment[]>([]);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, enrollmentRows] = await Promise.all([
        apiFetch<PathTemplate[]>("/api/steward-paths/templates"),
        apiFetch<PathEnrollment[]>(`/api/steward-paths/enrollments?constituentId=${encodeURIComponent(constituentId)}&limit=100`),
      ]);
      const activeTemplates = (Array.isArray(templateRows) ? templateRows : []).filter((path) => path.status === "ACTIVE");
      setTemplates(activeTemplates);
      setEnrollments(Array.isArray(enrollmentRows) ? enrollmentRows : []);
      setSelectedPathId((current) => current && activeTemplates.some((path) => path.id === current) ? current : activeTemplates[0]?.id ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Steward Paths.");
    } finally {
      setLoading(false);
    }
  }, [constituentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status === "ACTIVE" || enrollment.status === "PAUSED"),
    [enrollments],
  );
  const selectedPath = useMemo(() => templates.find((path) => path.id === selectedPathId) ?? null, [selectedPathId, templates]);
  const isAlreadyEnrolled = Boolean(selectedPath && currentEnrollments.some((enrollment) => enrollment.path.id === selectedPath.id));

  async function enroll(): Promise<void> {
    if (!selectedPath || isAlreadyEnrolled) return;
    if (replaceExisting && currentEnrollments.length > 0 && !window.confirm("Replace all active or paused paths for this constituent? Their current paths will be cancelled.")) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ reused: boolean; replacedCount: number }>(`/api/constituents/${encodeURIComponent(constituentId)}/steward-paths`, {
        method: "POST",
        body: JSON.stringify({ pathId: selectedPath.id, replaceExisting }),
      });
      setNotice(result.reused ? "This constituent is already enrolled in the selected path." : `Enrolled in ${selectedPath.name}${result.replacedCount ? ` and replaced ${result.replacedCount} existing path(s)` : ""}.`);
      setReplaceExisting(false);
      await load();
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Failed to enroll constituent in the selected path.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Steward Paths</p>
          <p className="mt-1 text-xs text-slate-600">Active relationship workflows for this constituent.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
      </div>

      {notice ? <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">{notice}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">{error}</p> : null}

      {loading ? <p className="mt-3 text-xs text-slate-500">Loading paths...</p> : (
        <>
          <div className="mt-3 space-y-2">
            {currentEnrollments.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">No active Steward Path enrollment.</p> : null}
            {currentEnrollments.map((enrollment) => (
              <div key={enrollment.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/steward-paths/${encodeURIComponent(enrollment.path.id)}/history`} className="min-w-0 truncate text-xs font-semibold text-slate-900 hover:text-[#0f6cbd]">{enrollment.path.name}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${enrollmentTone(enrollment.status)}`}>{enrollment.status}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-600">{enrollment.currentStep ? `Current: ${enrollment.currentStep.name}` : "No remaining step"}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatDueAt(enrollment.nextStepDueAt)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <label className="block text-xs font-semibold text-slate-700">
              Add or change path
              <select value={selectedPathId} onChange={(event) => setSelectedPathId(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800">
                {templates.length === 0 ? <option value="">No active paths available</option> : null}
                {templates.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
              </select>
            </label>

            {selectedPath ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-xs font-semibold text-slate-800">Path preview</p>
                <p className="mt-1 text-[11px] text-slate-600">{selectedPath.description || "No path description."}</p>
                <ol className="mt-2 space-y-1 border-l border-slate-300 pl-3">
                  {selectedPath.steps.filter((step) => step.isActive).slice(0, 5).map((step) => <li key={step.id} className="text-[11px] text-slate-700">{step.orderIndex + 1}. {step.name}</li>)}
                  {selectedPath.steps.filter((step) => step.isActive).length > 5 ? <li className="text-[11px] text-slate-500">Additional steps continue in the builder.</li> : null}
                </ol>
                <Link href={`/steward-paths/builder/${encodeURIComponent(selectedPath.id)}`} className="mt-2 inline-flex text-[11px] font-semibold text-[#0f6cbd] hover:underline">Open full path preview</Link>
              </div>
            ) : null}

            {currentEnrollments.length > 0 && !isAlreadyEnrolled ? (
              <label className="mt-3 flex items-start gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} className="mt-0.5 rounded border-slate-300" />Replace active paths before enrolling</label>
            ) : null}

            <button type="button" onClick={() => void enroll()} disabled={!selectedPath || isAlreadyEnrolled || saving} className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-[#0f6cbd] px-3 py-2 text-xs font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-50">
              {isAlreadyEnrolled ? "Already enrolled" : saving ? "Enrolling..." : replaceExisting ? "Replace and enroll" : "Enroll in path"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}