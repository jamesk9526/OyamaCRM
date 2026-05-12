/**
 * Tasks workspace page.
 * Full task management UI wired to /api/tasks plus donor notification context.
 * Features: focus modes (my/team/follow-ups), notification deep-links, list filters,
 * complete action, and an integrated task creation modal for assignments.
 */
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import TaskTable from "@/app/components/tasks/TaskTable";
import NewTaskModal from "@/app/components/tasks/NewTaskModal";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

/** Task as returned from the API */
export interface Task {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  dueDate?: string;
  generatedLetterId?: string | null;
  stewardPathEnrollmentId?: string | null;
  stewardPathStepRunId?: string | null;
  assignee?: { id: string; firstName: string; lastName: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  constituent?: { id: string; firstName: string; lastName: string };
}

interface NotificationItem {
  id: string;
  type: "task" | "meeting" | "follow_up" | "appointment";
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
}

type FocusMode = "my" | "team" | "followups";

const TASK_TYPES = ["CALL", "EMAIL", "MAIL", "MEETING", "THANK_YOU", "FOLLOW_UP", "OTHER"];
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const FOLLOW_UP_TYPES = new Set(["FOLLOW_UP", "THANK_YOU", "CALL", "EMAIL"]);

/** Converts notification API errors into actionable operator guidance. */
function normalizeNotificationsError(error: unknown): string {
  const fallback = "Failed to load notifications.";
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes("database migrations are pending")) {
    return "Notifications are temporarily unavailable because a database migration is pending. Run pnpm db:migrate, pnpm db:generate, then restart the API.";
  }

  return error.message || fallback;
}

/** Tasks page — list, filter, complete, and create tasks */
export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const isAdmin = user?.role === "admin";
  const queryFocus = searchParams.get("focus");
  const queryTaskId = searchParams.get("taskId");
  const initialFocusMode: FocusMode = queryFocus === "team"
    ? (isAdmin ? "team" : "my")
    : queryFocus === "followups"
      ? "followups"
      : "my";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>(initialFocusMode);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [total, setTotal] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const highlightTaskId = useMemo(() => (queryTaskId ? String(queryTaskId) : null), [queryTaskId]);

  /** Load tasks from API with optional filters */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        scope: focusMode === "team" && isAdmin ? "all" : "personal",
      });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<{ items?: Task[]; total?: number }>(`/api/tasks?${params}`);

      let items: Task[] = data.items ?? [];
      if (focusMode === "my" && user?.id) {
        items = items.filter((task) => task.assignee?.id === user.id || task.createdBy?.id === user.id);
      }
      if (focusMode === "followups") {
        items = items.filter((task) => FOLLOW_UP_TYPES.has(task.type));
      }
      if (typeFilter) items = items.filter((t) => t.type === typeFilter);

      setTasks(items);
      setTotal(items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, focusMode, isAdmin, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTasks]);

  /** Loads top bar-equivalent donor notifications to integrate assignment and follow-up context. */
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const data = await apiFetch<{ items?: NotificationItem[] }>("/api/notifications?module=donor");
      const relevant = (data.items ?? []).filter((item) => item.type === "task" || item.type === "follow_up").slice(0, 6);
      setNotifications(relevant);
    } catch (requestError) {
      setNotificationsError(normalizeNotificationsError(requestError));
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadNotifications]);

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
  const assignedToMe = user?.id
    ? tasks.filter((task) => task.assignee?.id === user.id && task.status !== "COMPLETED").length
    : 0;
  const followUpCount = tasks.filter((task) => FOLLOW_UP_TYPES.has(task.type) && task.status !== "COMPLETED").length;

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

      {/* Workspace focus controls */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Workspace Focus</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFocusMode("my")}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${focusMode === "my" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            My Queue ({assignedToMe})
          </button>
          <button
            onClick={() => setFocusMode(isAdmin ? "team" : "my")}
            disabled={!isAdmin}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${focusMode === "team" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"} disabled:opacity-60`}
            title={isAdmin ? "View all team assignments" : "Team view requires admin role"}
          >
            Team Assignments
          </button>
          <button
            onClick={() => setFocusMode("followups")}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${focusMode === "followups" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            Follow-Ups ({followUpCount})
          </button>
          {highlightTaskId && (
            <span className="px-3 py-1.5 text-sm rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Notification context active
            </span>
          )}
        </div>
      </div>

      {/* Notification-integrated task feed */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Task Notifications</h2>
            <p className="text-xs text-gray-500">Assignments and due items linked directly into this workspace.</p>
          </div>
          <button onClick={loadNotifications} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
        </div>

        {notificationsError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-2">
            {notificationsError}
          </div>
        )}

        {notificationsLoading ? (
          <p className="text-sm text-gray-400">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-gray-500">No pending task notifications.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-green-300 hover:bg-green-50/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.message}</p>
                </div>
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-500" : "bg-green-500"}`} />
              </Link>
            ))}
          </div>
        )}
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

      <TaskTable
        tasks={tasks}
        loading={loading && !error}
        highlightTaskId={highlightTaskId}
        onComplete={handleComplete}
        onDelete={handleDelete}
      />

      {showModal && (
        <NewTaskModal
          defaultAssigneeId={user?.id}
          defaultType="FOLLOW_UP"
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadTasks(); }}
        />
      )}
    </div>
  );
}
