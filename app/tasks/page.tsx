/**
 * Tasks page.
 * Full task management UI wired to /api/tasks.
 * Features: list, filter by status/type, complete action, new task modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import TaskTable from "@/app/components/tasks/TaskTable";
import NewTaskModal from "@/app/components/tasks/NewTaskModal";
import { apiFetch } from "@/app/lib/auth-client";

/** Task as returned from the API */
export interface Task {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignee?: { id: string; firstName: string; lastName: string };
  constituent?: { id: string; firstName: string; lastName: string };
}

const TASK_TYPES = ["CALL", "EMAIL", "MAIL", "MEETING", "THANK_YOU", "FOLLOW_UP", "OTHER"];
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

/** Tasks page — list, filter, complete, and create tasks */
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [total, setTotal] = useState(0);

  /** Load tasks from API with optional filters */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<{ items?: Task[]; total?: number }>(`/api/tasks?${params}`);
      let items: Task[] = data.items ?? [];
      if (typeFilter) items = items.filter((t) => t.type === typeFilter);
      setTasks(items);
      setTotal(data.total ?? items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  /** Mark a task as COMPLETED via PATCH */
  async function handleComplete(id: string) {
    await apiFetch(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    loadTasks();
  }

  /** Delete a task */
  async function handleDelete(id: string) {
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  }

  const pending = tasks.filter((t) => t.status === "PENDING").length;
  const overdue = tasks.filter((t) => t.status === "PENDING" && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stewardship tasks, follow-ups, and team assignments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, color: "text-gray-900" },
          { label: "Pending", value: pending, color: "text-blue-700" },
          { label: "Overdue", value: overdue, color: "text-red-600" },
          { label: "Completed", value: completed, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Types</option>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
        {(statusFilter || typeFilter) && (
          <button onClick={() => { setStatusFilter(""); setTypeFilter(""); }} className="text-sm text-gray-500 hover:text-gray-700 px-2">
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      <TaskTable tasks={tasks} loading={loading && !error} onComplete={handleComplete} onDelete={handleDelete} />

      {showModal && (
        <NewTaskModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadTasks(); }}
        />
      )}
    </div>
  );
}
