/**
 * TasksWidget — live task list on the dashboard.
 * Fetches from /api/tasks, groups into "Due Soon" (today/overdue) and "Due Later".
 * Users can complete tasks directly from the dashboard.
 */
"use client";

import Card from "@/app/components/ui/Card";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Minimal task shape we need from the API */
interface TaskItem {
  id: string;
  title: string;
  taskType: string;
  status: string;
  dueDate: string | null;
  assignee: { firstName: string; lastName: string } | null;
  constituent: { firstName: string; lastName: string } | null;
}

export default function TasksWidget() {
  const [filter, setFilter] = useState<"all" | "my">("all");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  /** Fetch tasks from the API */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items?: TaskItem[] } | TaskItem[]>("/api/tasks?status=PENDING&limit=20");
      // Tasks API returns { items: [...], total }
      setTasks(Array.isArray(data) ? data : ((data as { items?: TaskItem[] }).items ?? []));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Mark a task as complete and refresh */
  async function complete(id: string) {
    await apiFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    load();
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 2);

  // "Due soon" = no due date set OR due within 2 days (incl. overdue)
  const dueSoon = tasks.filter((t) => !t.dueDate || new Date(t.dueDate) <= tomorrow);
  const dueLater = tasks.filter((t) => t.dueDate && new Date(t.dueDate) > tomorrow);

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          Tasks
          {!loading && tasks.length > 0 && (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </h3>
        <button
          onClick={load}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 mb-3">
        {(["all", "my"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {loading ? (
          // Skeleton rows
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <svg className="w-8 h-8 text-green-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500">No pending tasks!</p>
          </div>
        ) : (
          <>
            {dueSoon.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Due Soon
                </h4>
                <div className="space-y-2">
                  {dueSoon.map((t) => (
                    <TaskCard key={t.id} task={t} onComplete={complete} />
                  ))}
                </div>
              </div>
            )}
            {dueLater.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Due Later
                </h4>
                <div className="space-y-2">
                  {dueLater.map((t) => (
                    <TaskCard key={t.id} task={t} onComplete={complete} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Individual task row card.
 */
function TaskCard({ task, onComplete }: { task: TaskItem; onComplete: (id: string) => void }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div className="p-3 border border-gray-200 rounded-lg hover:border-green-200 hover:bg-green-50/30 transition-colors group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-900 group-hover:text-green-700 flex-1">
          {task.title}
        </p>
        <button
          onClick={() => onComplete(task.id)}
          className="shrink-0 text-gray-300 hover:text-green-600 transition-colors"
          title="Mark complete"
        >
          {/* Checkmark circle */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Constituent name */}
      {task.constituent && (
        <p className="text-xs text-gray-500">
          {task.constituent.firstName} {task.constituent.lastName}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1.5">
        {/* Task type badge */}
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
          {task.taskType}
        </span>
        {/* Due date */}
        {task.dueDate && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
            {isOverdue && (
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {/* Assignee */}
        {task.assignee && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {task.assignee.firstName} {task.assignee.lastName[0]}.
          </span>
        )}
      </div>
    </div>
  );
}
