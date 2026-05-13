/**
 * GrantCaseItemPanel renders a grant-scoped case-file list and add form for reminders, tasks, resources, or requirements.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { GrantCaseItem, GrantCaseItemKind, GrantReminderStatus, GrantRequirementStatus, GrantResourceStatus, GrantTaskStatus } from "./types";

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type CaseItemStatus = GrantTaskStatus | GrantReminderStatus | GrantRequirementStatus | GrantResourceStatus;

interface GrantCaseItemPanelProps {
  grantId: string;
  kind: GrantCaseItemKind;
  heading: string;
  emptyMessage: string;
}

const STATUS_OPTIONS_BY_KIND: Record<GrantCaseItemKind, CaseItemStatus[]> = {
  TASK: [
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_ON_SOMEONE",
    "READY_FOR_REVIEW",
    "COMPLETED",
    "BLOCKED",
    "CANCELED",
  ],
  REMINDER: ["PENDING", "COMPLETED", "CANCELED"],
  REQUIREMENT: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"],
  RESOURCE: ["ACTIVE", "NEEDS_REVIEW", "ARCHIVED"],
};

const DEFAULT_STATUS_BY_KIND: Record<GrantCaseItemKind, CaseItemStatus> = {
  TASK: "NOT_STARTED",
  REMINDER: "PENDING",
  REQUIREMENT: "NOT_STARTED",
  RESOURCE: "ACTIVE",
};

const TASK_TYPE_OPTIONS = [
  "Research",
  "Writing",
  "Document Collection",
  "Budget",
  "Review",
  "Submission",
  "Follow-Up",
  "Reporting",
  "Renewal",
  "Other",
];

const REMINDER_TYPE_OPTIONS = [
  "Research Due",
  "LOI Due",
  "Draft Due",
  "Internal Review Due",
  "Final Application Due",
  "Submission Due",
  "Decision Expected",
  "Report Due",
  "Renewal Reminder",
  "Custom Reminder",
];

const RESOURCE_TYPE_OPTIONS = [
  "Portal",
  "Guidelines",
  "PDF",
  "Budget",
  "Drive Folder",
  "Document",
  "Email",
  "Research",
  "Report",
  "Other",
];

/** Converts a stored ISO date string to YYYY-MM-DD for date inputs. */
function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Formats status enum-like values for readable labels in UI. */
function formatStatusLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

/** Formats a date string for compact list rendering. */
function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** GrantCaseItemPanel displays one case-file category with create + status update workflows. */
export default function GrantCaseItemPanel({ grantId, kind, heading, emptyMessage }: GrantCaseItemPanelProps) {
  const [items, setItems] = useState<GrantCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CaseItemStatus>(DEFAULT_STATUS_BY_KIND[kind]);
  const [priority, setPriority] = useState("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [taskType, setTaskType] = useState("Research");
  const [reminderType, setReminderType] = useState("Custom Reminder");
  const [resourceType, setResourceType] = useState("Portal");
  const [url, setUrl] = useState("");
  const [pinned, setPinned] = useState(false);

  const isAssignmentEnabled = kind === "TASK" || kind === "REMINDER" || kind === "REQUIREMENT";

  /** Loads current items for this grant + case-item kind. */
  async function loadItems() {
    setLoading(true);
    try {
      const response = await apiFetch<GrantCaseItem[]>(`/api/grants/${grantId}/case-items?kind=${kind}`);
      setItems(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load case-file items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [grantId, kind]);

  useEffect(() => {
    if (!isAssignmentEnabled) {
      setUsers([]);
      return;
    }

    let active = true;
    void apiFetch<{ items?: UserOption[] }>("/api/users")
      .then((response) => {
        if (!active) return;
        setUsers(response.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      });

    return () => {
      active = false;
    };
  }, [isAssignmentEnabled]);

  useEffect(() => {
    setStatus(DEFAULT_STATUS_BY_KIND[kind]);
    setPriority("MEDIUM");
    setDueAt("");
    setRemindAt("");
    setAssignedToId("");
    setTaskType("Research");
    setReminderType("Custom Reminder");
    setResourceType("Portal");
    setUrl("");
    setPinned(false);
  }, [kind]);

  const statusOptions = useMemo(() => STATUS_OPTIONS_BY_KIND[kind], [kind]);

  /** Creates one new case-file item in the grant record. */
  async function handleAddItem(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (kind === "RESOURCE" && !url.trim()) {
      setError("Resource URL is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await apiFetch<GrantCaseItem>(`/api/grants/${grantId}/case-items`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueAt: dueAt || undefined,
          remindAt: remindAt || undefined,
          assignedToId: assignedToId || undefined,
          taskType: kind === "TASK" ? taskType : undefined,
          reminderType: kind === "REMINDER" ? reminderType : undefined,
          resourceType: kind === "RESOURCE" ? resourceType : undefined,
          url: kind === "RESOURCE" ? url.trim() : undefined,
          pinned: kind === "RESOURCE" ? pinned : undefined,
        }),
      });

      setItems((previous) => [created, ...previous]);
      setTitle("");
      setDescription("");
      setStatus(DEFAULT_STATUS_BY_KIND[kind]);
      setPriority("MEDIUM");
      setDueAt("");
      setRemindAt("");
      setAssignedToId("");
      setTaskType("Research");
      setReminderType("Custom Reminder");
      setResourceType("Portal");
      setUrl("");
      setPinned(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create case-file item.");
    } finally {
      setSaving(false);
    }
  }

  /** Updates only the status for one case-file item row. */
  async function handleStatusChange(itemId: string, nextStatus: string) {
    try {
      const updated = await apiFetch<GrantCaseItem>(`/api/grants/${grantId}/case-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      // Keep status untouched on failed save; the current row remains source-of-truth.
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {kind === "RESOURCE"
            ? "Store links and references for this grant case file. Do not store passwords or secrets."
            : "Track this work in the grant workspace so deadlines, ownership, and status stay visible."}
        </p>
      </div>

      <form onSubmit={handleAddItem} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "TASK" ? "Draft application narrative" : kind === "RESOURCE" ? "Application portal" : "Enter title"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CaseItemStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatusLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Notes, requirements, follow-up context, or internal writing guidance"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</span>
            <input
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reminder Date</span>
            <input
              type="date"
              value={remindAt}
              onChange={(event) => setRemindAt(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
        </div>

        {(kind === "TASK" || kind === "REMINDER") && (
          <div className="grid gap-3 md:grid-cols-2">
            {kind === "TASK" && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Task Type</span>
                <select
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {TASK_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            )}

            {kind === "REMINDER" && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reminder Type</span>
                <select
                  value={reminderType}
                  onChange={(event) => setReminderType(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {REMINDER_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned Writer</span>
              <select
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {kind === "RESOURCE" && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resource URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resource Type</span>
              <select
                value={resourceType}
                onChange={(event) => setResourceType(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {RESOURCE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 md:col-span-2">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Pin as important resource
            </label>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : `Add ${heading.slice(0, -1)}`}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Current {heading}</p>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-sm text-gray-400 text-center">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500 text-center">{emptyMessage}</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      {item.taskType && <span>Type: {item.taskType}</span>}
                      {item.reminderType && <span>Reminder: {item.reminderType}</span>}
                      {item.resourceType && <span>Resource: {item.resourceType}</span>}
                      {item.assignedToName && <span>Owner: {item.assignedToName}</span>}
                      {item.priority && <span>Priority: {formatStatusLabel(item.priority)}</span>}
                      <span>Due: {formatDate(item.dueAt)}</span>
                      <span>Remind: {formatDate(item.remindAt)}</span>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                        Open Resource
                      </a>
                    )}
                  </div>
                  <select
                    value={item.status ?? DEFAULT_STATUS_BY_KIND[kind]}
                    onChange={(event) => void handleStatusChange(item.id, event.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {statusOptions.map((option) => (
                      <option key={`${item.id}-${option}`} value={option}>{formatStatusLabel(option)}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
