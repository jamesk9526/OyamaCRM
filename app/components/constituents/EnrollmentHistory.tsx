"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface TimelineEvent {
  id: string; eventType: string; message: string; createdAt: string;
  step?: { name: string } | null;
}

/** Load only the requested enrollment; preserve the actual event history, including failures. */
export default function EnrollmentHistory({ enrollmentId }: { enrollmentId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function load() {
    if (loading) return;
    setLoading(true); setError(false);
    try { setEvents(await apiFetch<TimelineEvent[]>(`/api/steward-paths/enrollments/${encodeURIComponent(enrollmentId)}/timeline`)); }
    catch { setError(true); }
    finally { setLoading(false); }
  }
  return <details className="mt-2" onToggle={(event) => { if (event.currentTarget.open && !events && !loading && !error) void load(); }}>
    <summary className="min-h-8 cursor-pointer py-1 text-xs font-semibold text-[var(--crm-accent)]">Completed steps and workflow history</summary>
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <p className="text-xs text-slate-500">Loading history…</p> : error ? <p role="alert" className="text-xs text-amber-800">History unavailable. <button className="underline" onClick={() => void load()}>Retry</button></p> : events && <>
        <p className="my-2 text-xs text-slate-600">{events.filter((item) => item.eventType === "STEP_COMPLETED").length} completed step events</p>
        {!events.length ? <p className="text-xs text-slate-500">No recorded workflow events.</p> : <ol className="max-h-72 space-y-2 overflow-y-auto border-l border-slate-300 pl-3">{events.map((item) => <li key={item.id} className="text-xs text-slate-700">
          <span className="font-semibold">{item.eventType.replaceAll("_", " ")}{item.step ? ` · ${item.step.name}` : ""}</span>
          <p>{item.message}</p><time className="text-slate-500" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        </li>)}</ol>}
      </>}
    </div>
  </details>;
}
