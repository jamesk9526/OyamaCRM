// ClientFollowUpsTab provides client-scoped follow-up task management in profile tabs.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type FollowUpStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type FollowUpPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface FollowUpItem {
  id: string;
  title: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  dueDate: string;
  completedAt?: string | null;
  notes?: string | null;
  assignedStaff?: { id: string; firstName: string; lastName: string } | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName?: string;
}

/** Formats ISO date string for compact UI rendering. */
function fmtDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/** Returns true when a follow-up is overdue. */
function isOverdue(item: FollowUpItem): boolean {
  if (item.status === "COMPLETED" || item.status === "CANCELLED") return false;
  return new Date(item.dueDate).getTime() < Date.now();
}

/** Returns semantic styles for follow-up statuses. */
function statusTone(status: FollowUpStatus): string {
  const tones: Record<FollowUpStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-600",
  };
  return tones[status];
}

/** Returns semantic styles for follow-up priorities. */
function priorityTone(priority: FollowUpPriority): string {
  const tones: Record<FollowUpPriority, string> = {
    LOW: "bg-slate-100 text-slate-600",
    MEDIUM: "bg-cyan-100 text-cyan-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-rose-100 text-rose-700",
  };
  return tones[priority];
}

/**
 * ClientFollowUpsTab renders a focused follow-up queue for one client.
 * It supports create, complete, reopen, and status changes in place.
 */
export default function ClientFollowUpsTab({
  clientId,
  developmentNotice,
}: {
  clientId: string;
  developmentNotice?: string;
}) {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | FollowUpStatus>("ALL");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    dueDate: "",
    priority: "MEDIUM" as FollowUpPriority,
    assignedStaffId: "",
    notes: "",
  });
  const [form, setForm] = useState({
    title: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    priority: "MEDIUM" as FollowUpPriority,
    assignedStaffId: "",
    notes: "",
  });

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        item.title,
        item.notes ?? "",
        item.assignedStaff ? `${item.assignedStaff.firstName} ${item.assignedStaff.lastName}` : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, statusFilter, query]);

  const counts = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.status === "PENDING").length;
    const inProgress = items.filter((item) => item.status === "IN_PROGRESS").length;
    const completed = items.filter((item) => item.status === "COMPLETED").length;
    const overdue = items.filter((item) => isOverdue(item)).length;
    return { total, pending, inProgress, completed, overdue };
  }, [items]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clientId,
        limit: "150",
      });
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const data = await apiFetch<FollowUpItem[]>(`/api/compassion/follow-ups?${params.toString()}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [clientId, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    apiFetch<StaffMember[]>("/api/compassion/staff?active=true&limit=200")
      .then((data) => {
        setStaff(Array.isArray(data) ? data : []);
      })
      .catch(() => setStaff([]));
  }, []);

  async function createFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      await apiFetch("/api/compassion/follow-ups", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          title: form.title.trim(),
          dueDate: new Date(form.dueDate).toISOString(),
          priority: form.priority,
          assignedCompassionStaffId: form.assignedStaffId || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm({
        title: "",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        priority: "MEDIUM",
        assignedStaffId: "",
        notes: "",
      });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create follow-up");
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(id: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow-up status");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: FollowUpItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      dueDate: item.dueDate.slice(0, 10),
      priority: item.priority,
      assignedStaffId: item.assignedStaff?.id ?? "",
      notes: item.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm.title.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/follow-ups/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title.trim(),
          dueDate: new Date(editForm.dueDate).toISOString(),
          priority: editForm.priority,
          assignedCompassionStaffId: editForm.assignedStaffId || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      setEditingId(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save follow-up changes");
    } finally {
      setSaving(false);
    }
  }

  async function removeFollowUp(id: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/follow-ups/${id}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        setEditingId(null);
      }
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">Client Follow-up Queue</p>
        <p className="text-sm text-blue-700 mt-1">Track pending and completed follow-up actions for this client without leaving the profile workspace.</p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
          <p className="text-lg font-semibold text-gray-900">{counts.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Pending</p>
          <p className="text-lg font-semibold text-amber-700">{counts.pending}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">In Progress</p>
          <p className="text-lg font-semibold text-blue-700">{counts.inProgress}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Completed</p>
          <p className="text-lg font-semibold text-emerald-700">{counts.completed}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Overdue</p>
          <p className="text-lg font-semibold text-rose-700">{counts.overdue}</p>
        </div>
      </section>

      {developmentNotice ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
          <p className="text-sm text-amber-800 mt-1">{developmentNotice}</p>
        </section>
      ) : null}

      <form onSubmit={createFollowUp} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Add Follow-up</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Follow-up title"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
            required
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as FollowUpPriority }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <select
            value={form.assignedStaffId}
            onChange={(event) => setForm((current) => ({ ...current, assignedStaffId: event.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">Assign later</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName ?? member.displayName ?? `${member.firstName} ${member.lastName}`}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Optional notes"
          className="w-full min-h-[80px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Follow-up"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search follow-ups"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[220px]"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <p className="text-xs text-gray-500">Showing {filteredItems.length}</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading follow-ups...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">No follow-ups found for this filter.</div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <article key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={editForm.priority}
                      onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as FollowUpPriority }))}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <select
                      value={editForm.assignedStaffId}
                      onChange={(event) => setEditForm((current) => ({ ...current, assignedStaffId: event.target.value }))}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Assign later</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName ?? member.displayName ?? `${member.firstName} ${member.lastName}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                    className="w-full min-h-[80px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Notes"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditForm({ title: "", dueDate: "", priority: "MEDIUM", assignedStaffId: "", notes: "" });
                      }}
                      className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEdit()}
                      className="rounded border border-blue-200 px-2.5 py-1 text-xs text-blue-700 disabled:opacity-40"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void removeFollowUp(item.id)}
                      className="rounded border border-rose-200 px-2.5 py-1 text-xs text-rose-700 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Due {fmtDate(item.dueDate)}
                        {item.assignedStaff ? ` · ${item.assignedStaff.firstName} ${item.assignedStaff.lastName}` : ""}
                        {isOverdue(item) ? " · Overdue" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(item.status)}`}>{item.status.replace("_", " ")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${priorityTone(item.priority)}`}>{item.priority}</span>
                    </div>
                  </div>

                  {item.notes ? <p className="text-sm text-gray-700">{item.notes}</p> : null}

                  <div className="flex flex-wrap gap-2">
                    {item.status !== "COMPLETED" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void patchStatus(item.id, "COMPLETED")}
                        className="rounded border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 disabled:opacity-40"
                      >
                        Mark Complete
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void patchStatus(item.id, "PENDING")}
                        className="rounded border border-amber-200 px-2.5 py-1 text-xs text-amber-700 disabled:opacity-40"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving || item.status === "IN_PROGRESS"}
                      onClick={() => void patchStatus(item.id, "IN_PROGRESS")}
                      className="rounded border border-blue-200 px-2.5 py-1 text-xs text-blue-700 disabled:opacity-40"
                    >
                      Set In Progress
                    </button>
                    <button
                      type="button"
                      disabled={saving || item.status === "CANCELLED"}
                      onClick={() => void patchStatus(item.id, "CANCELLED")}
                      className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-700 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startEditing(item)}
                      className="rounded border border-indigo-200 px-2.5 py-1 text-xs text-indigo-700 disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void removeFollowUp(item.id)}
                      className="rounded border border-rose-200 px-2.5 py-1 text-xs text-rose-700 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
