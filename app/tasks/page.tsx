"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Plus, RefreshCw } from "lucide-react";
import TaskTable from "@/app/components/tasks/TaskTable";
import NewTaskModal from "@/app/components/tasks/NewTaskModal";
import {
  TASK_STATUSES,
  TASK_TYPES,
  taskLabel,
  taskOverdue,
  type Task,
  type TaskUser,
} from "@/app/components/tasks/task-types";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
export type { Task } from "@/app/components/tasks/task-types";
interface ListResponse {
  items: Task[];
  total: number;
  totalPages: number;
}
export default function TasksPage() {
  return (
    <Suspense fallback={<p role="status">Loading tasks...</p>}>
      <TasksWorkspace />
    </Suspense>
  );
}
function TasksWorkspace() {
  const { user } = useAuth();
  const params = useSearchParams();
  const teamAllowed = user?.role === "admin" || user?.role === "super_admin";
  const canEdit = user?.permissions
    ? user.permissions.includes("edit:tasks")
    : teamAllowed || user?.role === "manager" || user?.role === "staff";
  const [scope, setScope] = useState("personal"),
    [queue, setQueue] = useState("all"),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [search, setSearch] = useState("");
  const [page, setPage] = useState(1),
    [data, setData] = useState<ListResponse>({
      items: [],
      total: 0,
      totalPages: 1,
    });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null),
    [editing, setEditing] = useState<Task | null>(null),
    [showNew, setShowNew] = useState(false);
  const [target, setTarget] = useState<Task | null>(null),
    [targetError, setTargetError] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [assignee, setAssignee] = useState(""),
    [users, setUsers] = useState<TaskUser[]>([]);
  const requestId = useRef(0);
  const constituentId = params.get("constituentId");
  const queryTaskId = params.get("taskId"),
    queryKey = params.toString();
  useEffect(() => {
    const q = new URLSearchParams(queryKey);
    setScope(
      teamAllowed &&
        (q.get("focus") === "team" ||
          q.get("scope") === "all" ||
          q.get("queue") === "overdue")
        ? "all"
        : "personal",
    );
    setQueue(
      q.get("queue") === "overdue"
        ? "overdue"
        : q.get("focus") === "followups"
          ? "followups"
          : "all",
    );
    setStatus("");
    setType("");
    setPage(1);
    setShowNew(q.get("create") === "1" || q.get("new") === "1");
  }, [queryKey, teamAllowed]);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        scope: teamAllowed ? scope : "personal",
        queue,
        page: String(page),
        limit: "25",
      });
      if (constituentId) q.set("constituentId", constituentId);
      if (status) q.set("status", status);
      if (type) q.set("type", type);
      if (search.trim()) q.set("search", search.trim());
      const r = await apiFetch<ListResponse>(`/api/tasks?${q}`);
      if (id === requestId.current) {
        setData(r);
        setSelected([]);
      }
    } catch (reason) {
      if (id === requestId.current)
        setError(
          reason instanceof Error ? reason.message : "Unable to load tasks.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [scope, queue, status, type, search, page, teamAllowed, constituentId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [load, search]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("tasks:updated", refresh);
    return () => window.removeEventListener("tasks:updated", refresh);
  }, [load]);
  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    void apiFetch<{ items: TaskUser[] }>("/api/tasks/assignees").then(
      (r) => {
        if (active) setUsers(r.items);
      },
      () => {
        if (active) setUsers([]);
      },
    );
    return () => {
      active = false;
    };
  }, [canEdit]);
  useEffect(() => {
    setTarget(null);
    setTargetError("");
    if (!queryTaskId) return;
    let active = true;
    void apiFetch<Task>(`/api/tasks/${encodeURIComponent(queryTaskId)}`).then(
      (task) => {
        if (active) setTarget(task);
      },
      (reason) => {
        if (active)
          setTargetError(reason.message || "Linked task unavailable.");
      },
    );
    return () => {
      active = false;
    };
  }, [queryTaskId]);
  async function mutate(id: string, action: "complete" | "reopen" | "delete") {
    if (action === "delete" && !window.confirm("Delete this task permanently?"))
      return;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const saved = await apiFetch<Task>(
        `/api/tasks/${encodeURIComponent(id)}${action === "delete" ? "" : `/${action}`}`,
        {
          method: action === "delete" ? "DELETE" : "POST",
          body: action === "delete" ? undefined : "{}",
        },
      );
      setNotice(
        saved?.notificationWarning ||
          (action === "complete"
            ? "Task completed."
            : action === "reopen"
              ? "Task reopened."
              : "Task deleted."),
      );
      if (target?.id === id) setTarget(action === "delete" ? null : saved);
      window.dispatchEvent(new CustomEvent("tasks:updated"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Task could not be changed.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function assignSelected() {
    if (
      !selected.length ||
      !assignee ||
      !window.confirm(`Reassign ${selected.length} selected active task(s)?`)
    )
      return;
    setBusy("bulk");
    setError("");
    try {
      const r = await apiFetch<{
        updatedCount: number;
        notificationWarning?: string;
      }>("/api/tasks/bulk-assign", {
        method: "POST",
        body: JSON.stringify({ taskIds: selected, assigneeId: assignee }),
      });
      setNotice(r.notificationWarning || `${r.updatedCount} tasks reassigned.`);
      window.dispatchEvent(new CustomEvent("tasks:updated"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Reassignment failed.",
      );
    } finally {
      setBusy(null);
    }
  }
  const filter = (work: () => void) => {
    work();
    setPage(1);
  };
  const tableProps = {
    busyId: busy,
    canEdit,
    onEdit: setEditing,
    onComplete: (id: string) => void mutate(id, "complete"),
    onReopen: (id: string) => void mutate(id, "reopen"),
    onDelete: (id: string) => void mutate(id, "delete"),
  };
  return (
    <div className="donor-daily-workspace space-y-5 pb-8">
      <CRMPageHeader
        breadcrumb="Donor CRM / Tasks"
        title="Make the next step happen"
        description="Plan follow-ups, share ownership, and keep commitments moving."
        primaryAction={
          canEdit && (
            <button
              className="donor-button donor-button-primary"
              onClick={() => setShowNew(true)}
            >
              <Plus size={16} />
              New Task
            </button>
          )
        }
        secondaryActions={
          <>
            <Link className="donor-button" href="/notifications">
              <Bell size={16} />
              Notifications
            </Link>
            <button
              className="donor-button"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" aria-label="Task scope">
          {[
            { label: "My work", value: "personal" },
            ...(teamAllowed ? [{ label: "Team queue", value: "all" }] : []),
          ].map((item) => (
            <button
              key={item.value}
              className={`donor-button ${scope === item.value ? "donor-button-primary" : ""}`}
              aria-pressed={scope === item.value}
              onClick={() => filter(() => setScope(item.value))}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Link
          className="text-xs font-semibold text-emerald-800 hover:underline"
          href="/settings/tasks"
        >
          Task workflow & templates
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Matching tasks",
            value: data.total,
            helper: "Across all matching pages",
          },
          {
            label: "Active on this page",
            value: data.items.filter((t) =>
              ["PENDING", "IN_PROGRESS"].includes(t.status),
            ).length,
            helper: "Pending and in progress",
          },
          {
            label: "Overdue on this page",
            value: data.items.filter(taskOverdue).length,
            helper: "Includes in-progress tasks",
          },
          {
            label: "Completed on this page",
            value: data.items.filter((t) => t.status === "COMPLETED").length,
            helper: "Completed work in this view",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "..." : error ? "-" : item.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>
      <section
        aria-label="Task filters"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input
          aria-label="Search tasks"
          type="search"
          value={search}
          onChange={(e) => filter(() => setSearch(e.target.value))}
          className="min-w-48 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search task or constituent"
        />
        <select
          aria-label="Task queue"
          className="rounded-lg border px-3 py-2 text-sm"
          value={queue}
          onChange={(e) => filter(() => setQueue(e.target.value))}
        >
          <option value="all">All dates</option>
          <option value="my-today">My due today & overdue</option>
          <option value="overdue">Overdue</option>
          <option value="followups">Follow-ups</option>
          <option value="assigned-by-me">Assigned by me</option>
          <option value="assigned-to-me">Assigned to me</option>
        </select>
        <select
          aria-label="Task status"
          className="rounded-lg border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => filter(() => setStatus(e.target.value))}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((item) => (
            <option key={item} value={item}>
              {taskLabel(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Task type"
          className="rounded-lg border px-3 py-2 text-sm"
          value={type}
          onChange={(e) => filter(() => setType(e.target.value))}
        >
          <option value="">All types</option>
          {TASK_TYPES.map((item) => (
            <option key={item} value={item}>
              {taskLabel(item)}
            </option>
          ))}
        </select>
        {(search || status || type || queue !== "all") && (
          <button
            className="donor-button"
            aria-label={
              queue === "overdue"
                ? "Clear overdue task filter"
                : "Clear task filters"
            }
            onClick={() =>
              filter(() => {
                setSearch("");
                setStatus("");
                setType("");
                setQueue("all");
              })
            }
          >
            Clear filters
          </button>
        )}
      </section>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <button
            className="ml-3 font-semibold underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      )}
      {targetError && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {targetError}
        </p>
      )}
      {target && (
        <section
          className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"
          aria-label="Linked task"
        >
          <div className="flex justify-between gap-3">
            <h2 className="text-sm font-semibold">Linked task</h2>
            <button
              className="text-xs text-slate-600"
              onClick={() => setTarget(null)}
            >
              Dismiss linked task
            </button>
          </div>
          <TaskTable
            tasks={[target]}
            highlightTaskId={target.id}
            {...tableProps}
          />
        </section>
      )}
      {canEdit && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
          <span className="text-sm font-semibold">
            {selected.length} selected
          </span>
          <select
            aria-label="Reassign selected tasks to"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select staff member</option>
            {users.map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
          <button
            className="donor-button"
            disabled={Boolean(busy) || !assignee}
            onClick={() => void assignSelected()}
          >
            Reassign selected
          </button>
          <button className="donor-button" onClick={() => setSelected([])}>
            Clear selection
          </button>
          <p className="w-full text-xs text-slate-500">
            Only active tasks can be reassigned. Reopen completed tasks first.
          </p>
        </div>
      )}
      {!error && (
        <TaskTable
          tasks={data.items}
          loading={loading}
          selectedIds={selected}
          onSelect={(id, checked) =>
            setSelected((current) =>
              checked
                ? [...current, id]
                : current.filter((value) => value !== id),
            )
          }
          {...tableProps}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>
          {data.total} matching tasks - Page {page} of {data.totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            className="donor-button"
            disabled={loading || page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </button>
          <button
            className="donor-button"
            disabled={loading || page >= data.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {(showNew || editing) && (
        <NewTaskModal
          task={editing ?? undefined}
          defaultAssigneeId={user?.id}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onCreated={(task) => {
            setShowNew(false);
            setEditing(null);
            if (task && target?.id === task.id) setTarget(task);
            setNotice(task?.notificationWarning || "Task saved.");
            window.dispatchEvent(new CustomEvent("tasks:updated"));
          }}
        />
      )}
    </div>
  );
}
