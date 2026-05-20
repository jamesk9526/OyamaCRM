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
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import FirstRunCard from "@/app/components/ui/FirstRunCard";

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
  type: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
  status?: "unread" | "read" | "dismissed";
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

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
        queue: focusMode === "team" ? "team" : focusMode === "followups" ? "assigned-to-me" : "my-today",
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

  /** Load assignable users for bulk reassignment workflows. */
  useEffect(() => {
    let active = true;
    void apiFetch<{ items?: UserOption[] }>("/api/users")
      .then((data) => {
        if (!active) return;
        const userItems = data.items ?? [];
        setUsers(userItems);
        if (!bulkAssigneeId && user?.id) {
          setBulkAssigneeId(user.id);
        }
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      });

    return () => {
      active = false;
    };
  }, [user?.id, bulkAssigneeId]);

  /** Mark a task as COMPLETED via PATCH */
  async function handleComplete(id: string) {
    await apiFetch(`/api/tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    window.dispatchEvent(new CustomEvent("tasks:updated"));
    void loadTasks();
  }

  /** Delete a task */
  async function handleDelete(id: string) {
    await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
    window.dispatchEvent(new CustomEvent("tasks:updated"));
    void loadTasks();
  }

  /** Bulk-assign visible pending/in-progress tasks to one assignee. */
  async function handleBulkAssignVisible() {
    const reassignableTaskIds = tasks
      .filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS")
      .map((task) => task.id);

    if (!bulkAssigneeId || reassignableTaskIds.length === 0) return;

    setBulkAssigning(true);
    setBulkMessage(null);
    try {
      const response = await apiFetch<{ updatedCount: number; assignee?: { name?: string } }>("/api/tasks/bulk-assign", {
        method: "POST",
        body: JSON.stringify({
          assigneeId: bulkAssigneeId,
          taskIds: reassignableTaskIds,
        }),
      });
      const assigneeName = response.assignee?.name ?? "selected assignee";
      setBulkMessage(`Reassigned ${response.updatedCount} tasks to ${assigneeName}.`);
      window.dispatchEvent(new CustomEvent("tasks:updated"));
      await loadTasks();
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Bulk assignment failed.");
    } finally {
      setBulkAssigning(false);
    }
  }

  const pending = tasks.filter((t) => t.status === "PENDING").length;
  const overdue = tasks.filter((t) => t.status === "PENDING" && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const assignedToMe = user?.id
    ? tasks.filter((task) => task.assignee?.id === user.id && task.status !== "COMPLETED").length
    : 0;
  const followUpCount = tasks.filter((task) => FOLLOW_UP_TYPES.has(task.type) && task.status !== "COMPLETED").length;
  const focusLabel = focusMode === "team" ? "Team Queue" : focusMode === "followups" ? "Follow-Ups" : "My Work";
  const actionButtonClass = "inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
  const activeActionButtonClass = "border-emerald-200 bg-emerald-50 text-emerald-700";
  const primaryActionButtonClass = "inline-flex h-8 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
  const actionGroupClass = "flex flex-wrap items-center gap-2 border-r border-slate-100 pr-3 last:border-r-0 last:pr-0";
  const actionGroupLabelClass = "mr-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400";

  return (
    <div className="space-y-5">
      <FirstRunCard
        storageKey="howto:tasks"
        title="Getting started with Tasks"
        steps={["Switch between My Tasks, Team, and Follow-ups using the tabs above", "Click New Task to assign a follow-up to yourself or a team member", "Check off a task when complete — it logs to the donor timeline", "Overdue tasks are highlighted in red for quick triage"]}
      />
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Tasks", href: "/tasks" },
          { label: focusLabel },
        ]}
        metadata={`${total} total · ${assignedToMe} assigned to me · ${overdue} overdue`}
        primaryAction={(
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
          >
            New Task
          </button>
        )}
        overflowActions={
          highlightTaskId
            ? <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Notification context active</span>
            : undefined
        }
      />

      <CRMActionBar>
        <div className={actionGroupClass}>
          <span className={actionGroupLabelClass}>Queues</span>
          <button type="button" className={`${actionButtonClass} ${focusMode === "my" ? activeActionButtonClass : ""}`} onClick={() => setFocusMode("my")}>My Work ({assignedToMe})</button>
          <button type="button" className={`${actionButtonClass} ${focusMode === "team" ? activeActionButtonClass : ""}`} onClick={() => setFocusMode(isAdmin ? "team" : "my")} disabled={!isAdmin}>Team Queue</button>
          <button type="button" className={`${actionButtonClass} ${focusMode === "followups" ? activeActionButtonClass : ""}`} onClick={() => setFocusMode("followups")}>Follow-Ups ({followUpCount})</button>
          <button type="button" className={actionButtonClass} onClick={() => { setFocusMode("my"); setStatusFilter("COMPLETED"); }}>Completed</button>
        </div>
        <div className={actionGroupClass}>
          <span className={actionGroupLabelClass}>Create</span>
          <button type="button" className={primaryActionButtonClass} onClick={() => setShowModal(true)}>New Task</button>
        </div>
        <div className={actionGroupClass}>
          <span className={actionGroupLabelClass}>Assignment</span>
          <button type="button" className={actionButtonClass} onClick={() => setFocusMode("my")}>Assigned To Me</button>
          <button type="button" className={actionButtonClass} onClick={() => setFocusMode("my")}>Assigned By Me</button>
          <button type="button" className={actionButtonClass} onClick={handleBulkAssignVisible} disabled={bulkAssigning || !bulkAssigneeId}>Bulk Assign</button>
        </div>
        <div className={actionGroupClass}>
          <span className={actionGroupLabelClass}>View</span>
          <button type="button" className={actionButtonClass} onClick={() => { setStatusFilter(""); setTypeFilter(""); }}>Reset Filters</button>
          <button type="button" className={actionButtonClass} onClick={() => void loadTasks()}>Refresh Tasks</button>
          <button type="button" className={actionButtonClass} onClick={() => void loadNotifications()}>Refresh Notifications</button>
        </div>
      </CRMActionBar>

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

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Bulk Assignment</p>
            <select
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select assignee</option>
              {users.map((userItem) => (
                <option key={userItem.id} value={userItem.id}>{userItem.firstName} {userItem.lastName}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleBulkAssignVisible}
            disabled={bulkAssigning || !bulkAssigneeId || tasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS").length === 0}
            className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {bulkAssigning ? "Assigning..." : "Assign Visible Pending"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Reassigns all visible tasks that are still pending or in progress.
        </p>
        {bulkMessage && <p className="mt-2 text-xs text-gray-700">{bulkMessage}</p>}
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
          onCreated={() => {
            setShowModal(false);
            window.dispatchEvent(new CustomEvent("tasks:updated"));
            void loadTasks();
          }}
        />
      )}
    </div>
  );
}
