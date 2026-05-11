// Compassion CRM — Follow-ups page. Full list with filters, overdue warning, and create/complete modal.
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Follow-up as returned from GET /api/compassion/follow-ups */
interface CompassionFollowUp {
  id: string;
  status: string;
  priority: string;
  dueDate: string;
  completedAt?: string;
  notes?: string;
  client?: { id: string; firstName: string; lastName: string };
  assignedStaff?: { id: string; firstName: string; lastName: string };
}

interface ClientOption { id: string; firstName: string; lastName: string }
interface StaffUser    { id: string; firstName: string; lastName: string; displayName?: string | null; fullName?: string }

/** Maps follow-up status to badge style */
function statusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING:    "bg-blue-100 text-blue-700",
    COMPLETED:  "bg-emerald-100 text-emerald-700",
    OVERDUE:    "bg-red-100 text-red-700",
    CANCELLED:  "bg-gray-100 text-gray-400",
  };
  return styles[status] ?? "bg-gray-100 text-gray-500";
}

/** Maps priority to badge style */
function priorityBadge(priority: string) {
  const styles: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700",
    HIGH:   "bg-orange-100 text-orange-700",
    MEDIUM: "bg-yellow-50 text-yellow-700",
    LOW:    "bg-gray-100 text-gray-500",
  };
  return styles[priority] ?? "bg-gray-100 text-gray-500";
}

/** Returns true if the follow-up is past its due date and not completed */
function isOverdue(fu: CompassionFollowUp) {
  return fu.status === "PENDING" && new Date(fu.dueDate) < new Date();
}

// ─── Add Follow-up Modal ──────────────────────────────────────────────────────

/**
 * AddFollowUpModal: form to create a new follow-up action.
 * Posts to POST /api/compassion/follow-ups.
 */
function AddFollowUpModal({ onClose, onCreated, clientList, staffList }: {
  onClose: () => void;
  onCreated: () => void;
  clientList: ClientOption[];
  staffList: StaffUser[];
}) {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [form, setForm] = useState({
    clientId: "", assignedStaffId: "", priority: "MEDIUM", title: "",
    dueDate: nextWeek.toISOString().slice(0, 10), notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) { setError("Please select a client"); return; }
    if (!form.title.trim()) { setError("Please enter a title"); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/compassion/follow-ups", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId,
          title: form.title.trim(),
          assignedCompassionStaffId: form.assignedStaffId || undefined,
          priority: form.priority,
          dueDate: new Date(form.dueDate).toISOString(),
          notes: form.notes || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add Follow-up</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
            <select required value={form.clientId} onChange={(e) => set("clientId", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select client…</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Check in on housing status"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Staff</label>
            <select value={form.assignedStaffId} onChange={(e) => set("assignedStaffId", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName ?? s.displayName ?? `${s.firstName} ${s.lastName}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Add Follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

/**
 * CompassionFollowUpsPage: follow-up list with overdue highlight, status/priority filters,
 * inline "Mark Complete" button, and Add Follow-up modal.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionFollowUpsPage() {
  const [followUps, setFollowUps] = useState<CompassionFollowUp[]>([]);
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const data = await apiFetch<CompassionFollowUp[]>(`/api/compassion/follow-ups?${params}`);
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    apiFetch<ClientOption[]>("/api/compassion/clients?limit=200")
      .then((d) => setClientList(Array.isArray(d) ? d : []))
      .catch(() => setClientList([]));
    apiFetch<StaffUser[]>("/api/compassion/staff?active=true&limit=200")
      .then((d) => setStaffList(Array.isArray(d) ? d : []))
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Mark a follow-up as completed via PATCH */
  async function markComplete(id: string) {
    setCompleting(id);
    try {
      await apiFetch(`/api/compassion/follow-ups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      load();
    } catch {
      // silently ignore; list will not change
    } finally {
      setCompleting(null);
    }
  }

  const overdueCount = followUps.filter(isOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 text-xl">🔔</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Follow-ups</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track and complete client follow-up actions.</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Follow-up
        </button>
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <span>⚠️</span>
          <span><strong>{overdueCount}</strong> overdue follow-up{overdueCount !== 1 ? "s" : ""} require attention.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400 animate-pulse">Loading follow-ups…</div>
        ) : followUps.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No follow-ups found.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Add a follow-up</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Assigned Staff</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {followUps.map((fu) => {
                const overdue = isOverdue(fu);
                return (
                  <tr key={fu.id} className={`hover:bg-gray-50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {fu.client ? `${fu.client.firstName} ${fu.client.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(fu.status)}`}>
                        {fu.status.charAt(0) + fu.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge(fu.priority)}`}>
                        {fu.priority.charAt(0) + fu.priority.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={overdue ? "text-red-600 font-medium" : "text-gray-700"}>
                        {new Date(fu.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {overdue && <span className="ml-1 text-xs text-red-500">Overdue</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {fu.assignedStaff
                        ? `${fu.assignedStaff.firstName} ${fu.assignedStaff.lastName}`
                        : <span className="text-gray-300">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell max-w-xs truncate">
                      {fu.notes ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fu.status === "PENDING" && (
                        <button
                          onClick={() => markComplete(fu.id)}
                          disabled={completing === fu.id}
                          className="text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded-md px-2 py-1 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                        >
                          {completing === fu.id ? "…" : "Mark Complete"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && followUps.length > 0 && (
        <p className="text-xs text-gray-400">{followUps.length} follow-up{followUps.length !== 1 ? "s" : ""} shown</p>
      )}

      {showModal && (
        <AddFollowUpModal
          onClose={() => setShowModal(false)}
          onCreated={load}
          clientList={clientList}
          staffList={staffList}
        />
      )}
    </div>
  );
}
