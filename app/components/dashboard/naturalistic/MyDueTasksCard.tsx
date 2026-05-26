/**
 * MyDueTasksCard — compact panel showing the user's most urgent pending tasks.
 * Fetches top 5 tasks by due date from the tasks API.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface TaskItem {
  id: string;
  title: string;
  type?: string | null;
  taskType?: string | null;
  status: string;
  dueDate: string | null;
  priority?: string | null;
  constituent?: { firstName: string; lastName: string } | null;
}

const PRIORITY_STYLES: Record<string, { badge: string; label: string }> = {
  HIGH: { badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", label: "HIGH" },
  MEDIUM: { badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", label: "MED" },
  LOW: { badge: "bg-slate-50 text-slate-500 ring-1 ring-slate-200", label: "LOW" },
};

function formatDueDate(dateStr: string | null): { label: string; overdue: boolean } {
  if (!dateStr) return { label: "No due date", overdue: false };
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Due today", overdue: false };
  if (diff === 1) return { label: "Due tomorrow", overdue: false };
  if (diff <= 7) return { label: `Due in ${diff}d`, overdue: false };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export default function MyDueTasksCard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch<{ items?: TaskItem[] }>("/api/tasks?status=PENDING&limit=5&queue=assigned-to-me")
      .then((data) => {
        if (active) setTasks(data?.items ?? []);
      })
      .catch(() => {
        if (active) setTasks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleComplete(taskId: string) {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
    } catch {
      setTasks(previous);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div>
          <h3 className="text-sm font-bold text-slate-800">My Due Tasks</h3>
          <p className="text-xs text-slate-400">Pending stewardship follow-ups</p>
        </div>
        <Link
          href="/tasks"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
        >
          View all →
        </Link>
      </div>

      {/* Task list */}
      <div className="flex-1 divide-y divide-slate-50">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-12 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <svg className="h-8 w-8 text-slate-200 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <p className="text-sm font-medium text-slate-400">No pending tasks!</p>
            <p className="text-xs text-slate-300 mt-0.5">You&apos;re all caught up.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const { label: dueLabel, overdue } = formatDueDate(task.dueDate);
            const priorityKey = (task.priority ?? "MEDIUM").toUpperCase();
            const ps = PRIORITY_STYLES[priorityKey] ?? PRIORITY_STYLES.MEDIUM;
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50 group"
              >
                {/* Checkbox circle */}
                <button
                  type="button"
                  onClick={() => void handleComplete(task.id)}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 transition hover:border-emerald-500 hover:bg-emerald-50"
                  aria-label={`Complete task: ${task.title}`}
                  title="Complete task"
                />

                {/* Text */}
                <Link href={`/tasks?task=${task.id}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">{task.title}</span>
                  {task.constituent && (
                    <span className="text-xs text-slate-400 truncate">
                      {task.constituent.firstName} {task.constituent.lastName}
                    </span>
                  )}
                </Link>

                {/* Right side: priority + due date */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ps.badge}`}>{ps.label}</span>
                  <span className={`text-[10px] font-medium ${overdue ? "text-rose-500" : "text-slate-400"}`}>{dueLabel}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      {!loading && tasks.length > 0 && (
        <div className="border-t border-slate-50 px-5 py-3">
          <Link
            href="/tasks/new"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Add new task
          </Link>
        </div>
      )}
    </div>
  );
}
