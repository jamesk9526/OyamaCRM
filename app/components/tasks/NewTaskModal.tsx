/**
 * NewTaskModal component.
 * Modal form for creating stewardship tasks with assignment and constituent context.
 * Submits to POST /api/tasks.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

const TASK_TYPES = ["CALL", "EMAIL", "MAIL", "MEETING", "THANK_YOU", "FOLLOW_UP", "OTHER"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface ConstituentOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultAssigneeId?: string;
  defaultType?: string;
}

/** NewTaskModal: inline modal for creating a new task */
export default function NewTaskModal({ onClose, onCreated, defaultAssigneeId, defaultType = "FOLLOW_UP" }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(defaultType);
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "");
  const [constituentId, setConstituentId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [constituents, setConstituents] = useState<ConstituentOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Loads assignable users and constituents to support team assignment workflows. */
  useEffect(() => {
    let active = true;

    async function loadLookups() {
      setLoadingLookups(true);
      try {
        const [usersResult, constituentsResult] = await Promise.allSettled([
          apiFetch<{ items?: UserOption[] }>("/api/users"),
          apiFetch<ConstituentOption[]>("/api/constituents?limit=100"),
        ]);

        if (!active) return;

        if (usersResult.status === "fulfilled") {
          setUsers(usersResult.value.items ?? []);
        } else {
          setUsers([]);
        }

        if (constituentsResult.status === "fulfilled") {
          setConstituents(constituentsResult.value ?? []);
        } else {
          setConstituents([]);
        }
      } finally {
        if (active) setLoadingLookups(false);
      }
    }

    loadLookups();

    return () => {
      active = false;
    };
  }, []);

  /** Submit new task to the API */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          type,
          priority,
          ...(assigneeId && { assigneeId }),
          ...(constituentId && { constituentId }),
          ...(dueDate && { dueDate: new Date(dueDate).toISOString() }),
          ...(description && { description }),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Follow up with donor..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {TASK_PRIORITIES.map((taskPriority) => (
                  <option key={taskPriority} value={taskPriority}>{taskPriority}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={loadingLookups}
              >
                <option value="">Assign to me</option>
                {assigneeId && users.length === 0 && (
                  <option value={assigneeId}>Current user</option>
                )}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Constituent</label>
            <select
              value={constituentId}
              onChange={(e) => setConstituentId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loadingLookups}
            >
              <option value="">No constituent linked</option>
              {constituents.map((constituent) => (
                <option key={constituent.id} value={constituent.id}>{constituent.firstName} {constituent.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
