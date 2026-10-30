"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface OpenTask { id: string; title: string; status: string; dueDate: string | null; snoozedUntil?: string | null }

/** Task permissions still apply; completing a workflow step does not imply its task is done. */
export default function EnrollmentTasks({ enrollmentId, constituentId }: { enrollmentId: string; constituentId: string }) {
  const [data, setData] = useState<{ items: OpenTask[]; total: number } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(false);
    try {
      const query = new URLSearchParams({ enrollmentId, constituentId, activeOnly: "true", scope: "all", limit: "5" });
      const result = await apiFetch<{ items: OpenTask[]; total: number }>(`/api/tasks?${query}`, { signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [enrollmentId, constituentId]);
  useEffect(() => {
    void load();
    const refresh = () => void load(); window.addEventListener("tasks:updated", refresh);
    return () => { request.current?.abort(); window.removeEventListener("tasks:updated", refresh); };
  }, [load]);
  return <div className="mt-4 border-t border-slate-200 pt-3" aria-busy={loading}>
    <h4 className="text-xs font-semibold text-slate-800">Outstanding workflow tasks</h4>
    {loading && !data ? <p role="status" className="donor-loading-indicator mt-2 text-xs text-slate-500">Loading linked tasks…</p> : error ? <p role="alert" className="mt-2 text-xs text-amber-800">Linked tasks could not be loaded with your current access. <button onClick={() => void load()} className="underline">Retry</button></p> : data && <>
      {!data.items.length ? <p className="mt-2 text-xs text-slate-500">No accessible open tasks linked to this workflow. Older tasks may only appear in the donor’s task list.</p> : <ul className="mt-2 space-y-3">{data.items.map((task) => <li key={task.id}>
        <Link href={`/tasks?taskId=${encodeURIComponent(task.id)}`} className="text-xs font-semibold text-[var(--crm-accent)] hover:underline">{task.title}</Link>
        <p className="mt-1 text-xs text-slate-600">{task.status.replaceAll("_", " ")} · {task.dueDate ? `${new Date(task.dueDate) < new Date() ? "Overdue" : "Due"} ${new Date(task.dueDate).toLocaleString()}` : "No follow-up date set"}</p>
        {task.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? <p className="mt-1 text-xs text-slate-500">Reminder snoozed until {new Date(task.snoozedUntil).toLocaleString()}</p> : null}
      </li>)}</ul>}
      {data.total > data.items.length ? <p className="mt-2 text-xs text-slate-500">Showing {data.items.length} of {data.total} open linked tasks. Use the donor task list to review the rest.</p> : null}
    </>}
  </div>;
}
