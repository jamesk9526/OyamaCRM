"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { formatCurrency, formatDonationDate } from "@/app/components/donations/donation-utils";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  taskDueDate,
  taskLabel,
  taskLocalDate,
  type Task,
  type TaskUser,
} from "./task-types";

interface Template {
  id: string;
  name: string;
  title: string;
  type: string;
  priority: string;
  description: string;
  dueInDays: number;
}
interface Person {
  id: string;
  firstName: string;
  lastName: string;
}
interface Props {
  onClose: () => void;
  onCreated: (task?: Task) => void;
  defaultAssigneeId?: string;
  defaultType?: string;
  task?: Task;
  donation?: { id: string; amount: string; date: string; constituent: Person };
}
export default function NewTaskModal({
  onClose,
  onCreated,
  defaultAssigneeId,
  defaultType = "FOLLOW_UP",
  task,
  donation,
}: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title ?? (donation ? `Follow up on ${formatCurrency(donation.amount)} gift` : ""));
  const [requestId] = useState(() => crypto.randomUUID());
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState(task?.type ?? defaultType);
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(task?.status ?? "PENDING");
  const [due, setDue] = useState(taskLocalDate(task?.dueDate));
  const [reminder, setReminder] = useState(() => {
    if (!task?.reminderAt) return "";
    const date = new Date(task.reminderAt);
    return `${taskLocalDate(task.reminderAt)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  });
  const [assignee, setAssignee] = useState(
    task ? task.assigneeId ?? task.assignee?.id ?? "" : defaultAssigneeId ?? user?.id ?? "",
  );
  const [constituent, setConstituent] = useState(
    donation?.constituent.id ?? task?.constituentId ?? task?.constituent?.id ?? "",
  );
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      apiFetch<{ items: TaskUser[] }>("/api/tasks/assignees"),
      apiFetch<Template[]>("/api/tasks/templates"),
    ]).then(([staff, presets]) => {
      if (!active) return;
      if (staff.status === "fulfilled") setUsers(staff.value.items ?? []);
      else
        setLookupError(
          "Staff choices could not be loaded. Your current assignment is preserved.",
        );
      if (presets.status === "fulfilled") setTemplates(presets.value);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (donation) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiFetch<Person[] | { items: Person[] }>(
        `/api/constituents?limit=25&search=${encodeURIComponent(search)}`,
        { signal: controller.signal },
      ).then(
        (rows) => setPeople(Array.isArray(rows) ? rows : (rows.items ?? [])),
        (reason) => {
          if (reason.name !== "AbortError")
            setLookupError(
              "Constituent search is unavailable. Existing linked constituent is preserved.",
            );
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, donation]);
  const staff = [...users];
  if (user && !staff.some((person) => person.id === user.id)) staff.push(user);
  if (
    task?.assignee &&
    !staff.some((person) => person.id === task.assignee!.id)
  )
    staff.push(task.assignee);
  const clients = [...people];
  if (
    task?.constituent &&
    !clients.some((person) => person.id === task.constituent!.id)
  )
    clients.push(task.constituent);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await apiFetch<Task>(
        task ? `/api/tasks/${encodeURIComponent(task.id)}` : donation ? `/api/donations/${encodeURIComponent(donation.id)}/follow-up` : "/api/tasks",
        {
          method: task ? "PATCH" : "POST",
          body: JSON.stringify({
            ...(donation ? { requestId } : {}),
            title,
            description: description || null,
            type,
            priority,
            status,
          dueDate: task && due === taskLocalDate(task.dueDate) ? task.dueDate ?? null : taskDueDate(due),
          reminderAt: reminder ? new Date(reminder).toISOString() : null,
            assigneeId: assignee || null,
            constituentId: constituent || null,
          }),
        },
      );
      onCreated(saved);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save this task.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <WorkspaceSetupModal
      title={task ? "Edit task" : donation ? "Set up donation follow-up" : "New Task"}
      subtitle="Clear ownership, a useful due date, and the context needed to follow through."
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      contentClassName="donor-daily-workspace"
    >
      <form onSubmit={save} className="space-y-4 p-5 sm:p-6">
        {donation && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><strong>{donation.constituent.firstName} {donation.constituent.lastName}</strong><p>{formatCurrency(donation.amount)} · {formatDonationDate(donation.date)}</p><p className="mt-2 text-xs">This task stays linked to this donor and this specific donation.</p></div>}
        {lookupError && (
          <p
            role="status"
            className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
          >
            {lookupError}
          </p>
        )}
        {!task && templates.length > 0 && (
          <label className="block text-xs font-semibold text-slate-600">
            Start with a template
            <select
              className={`${input} mt-1`}
              defaultValue=""
              onChange={(event) => {
                const selected = templates.find(
                  (row) => row.id === event.target.value,
                );
                if (!selected) return;
                setTitle(selected.title);
                setDescription(selected.description);
                setType(selected.type);
                setPriority(selected.priority);
                const date = new Date();
                date.setDate(date.getDate() + selected.dueInDays);
                setDue(taskLocalDate(date.toISOString()));
              }}
            >
              <option value="">Custom task</option>
              {templates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs font-semibold text-slate-600">
          Task title
          <input
            autoFocus
            required
            maxLength={500}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={`${input} mt-1`}
            placeholder="What needs to happen next?"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Type
            <select
              className={`${input} mt-1`}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {TASK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {taskLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Priority
            <select
              className={`${input} mt-1`}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {TASK_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {taskLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Assigned to
            <select
              className={`${input} mt-1`}
              value={assignee}
              aria-label="Assigned to"
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Due date
            <input
              type="date"
              aria-label="Due date"
              className={`${input} mt-1`}
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
            <span className="mt-1 block text-[11px] font-normal">
              Due at the end of your local day. Leave blank for no due date.
            </span>
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-600">In-app reminder<input aria-label="In-app reminder" type="datetime-local" className={`${input} mt-1`} value={reminder} onChange={(event) => setReminder(event.target.value)} /><span className="mt-1 block text-[11px] font-normal">Optional. Uses your local time and appears in Notifications.</span></label>
        {task && (
          <label className="block text-xs font-semibold text-slate-600">
            Status
            <select
              className={`${input} mt-1`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {taskLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!donation && task?.sourceType !== "donation-follow-up" && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <label className="block text-xs font-semibold text-slate-600">
            Find a constituent
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or phone"
              className={`${input} mt-1`}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Linked constituent
            <select
              value={constituent}
              onChange={(event) => setConstituent(event.target.value)}
              className={`${input} mt-1`}
            >
              <option value="">No linked constituent</option>
              {clients.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </label>
        </div>}
        {task?.sourceType === "donation-follow-up" && task.sourceId && <p className="text-sm text-emerald-800">This task is linked to a specific gift. <a className="underline" href={`/donations/${encodeURIComponent(task.sourceId)}`}>View donation</a></p>}
        <label className="block text-xs font-semibold text-slate-600">
          Details
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={20000}
            rows={3}
            className={`${input} mt-1`}
            placeholder="Notes, next steps, or conversation context"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            className="donor-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="donor-button donor-button-primary"
          >
            {busy ? "Saving�" : task ? "Save changes" : "Create Task"}
          </button>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
