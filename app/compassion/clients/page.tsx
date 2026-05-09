// Compassion CRM — Clients page. Full list with search, filter, and create modal.
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Client as returned from GET /api/compassion/clients */
interface CompassionClient {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  clientStatus: string;
  intakeDate: string;
  assignedStaff?: { firstName: string; lastName: string };
  _count?: { cases: number; appointments: number };
}

/** Staff user for assignee dropdown */
interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
}

/** Maps a clientStatus value to a badge style */
function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE:   "bg-blue-100 text-blue-700",
    INACTIVE: "bg-gray-100 text-gray-500",
    GRADUATED:"bg-emerald-100 text-emerald-700",
    ARCHIVED: "bg-gray-100 text-gray-400",
    PENDING:  "bg-amber-100 text-amber-700",
  };
  return styles[status] ?? "bg-gray-100 text-gray-500";
}

/** Formats a date string as MM/DD/YYYY */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────

/**
 * AddClientModal: form to create a new Compassion CRM client.
 * Posts to POST /api/compassion/clients. Calls onCreated on success.
 */
function AddClientModal({ onClose, onCreated, staffList }: {
  onClose: () => void;
  onCreated: () => void;
  staffList: StaffUser[];
}) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", preferredName: "", email: "", phone: "",
    dateOfBirth: "", referralSource: "", assignedStaffId: "", privateNotes: "",
    intakeDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/compassion/clients", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          preferredName: form.preferredName || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          assignedStaffId: form.assignedStaffId || undefined,
          privateNotes: form.privateNotes || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add New Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
              <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
              <input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Preferred name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Name</label>
            <input value={form.preferredName} onChange={(e) => set("preferredName", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Intake Date</label>
              <input type="date" value={form.intakeDate} onChange={(e) => set("intakeDate", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Referral & Staff */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referral Source</label>
              <input value={form.referralSource} onChange={(e) => set("referralSource", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Staff</label>
              <select value={form.assignedStaffId} onChange={(e) => set("assignedStaffId", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes — private */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Private Notes <span className="text-gray-400 font-normal">(staff only)</span>
            </label>
            <textarea rows={3} value={form.privateNotes} onChange={(e) => set("privateNotes", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating…" : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

/**
 * CompassionClientsPage: full client list with search, status filter, and create modal.
 * Fetches from GET /api/compassion/clients and POSTs to create new clients.
 * TODO: Enforce Compassion workspace permission
 */
export default function CompassionClientsPage() {
  const [clients, setClients] = useState<CompassionClient[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<"" | "true" | "false">("");
  const [missingContact, setMissingContact] = useState(false);
  const [intakeWindow, setIntakeWindow] = useState<"" | "30" | "90">("");
  const [showModal, setShowModal] = useState(false);

  /** Load clients from API */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (assignedFilter) params.set("assigned", assignedFilter);
      if (missingContact) params.set("missingContact", "true");
      if (intakeWindow) params.set("intakeWithinDays", intakeWindow);
      const data = await apiFetch<CompassionClient[]>(`/api/compassion/clients?${params}`);
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, assignedFilter, missingContact, intakeWindow]);

  // Load staff list for assignee dropdown (reuse /api/users)
  useEffect(() => {
    apiFetch<{ items?: StaffUser[] } | StaffUser[]>("/api/users?limit=100")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d as { items?: StaffUser[] }).items ?? [];
        setStaffList(list);
      })
      .catch(() => setStaffList([]));
  }, []);

  // Reload when filters change (debounced for search; immediate for select/checkbox toggles)
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl">👤</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage client records, profiles, and histories.</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, preferred name, email, phone, referral source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="GRADUATED">Graduated</option>
          <option value="ARCHIVED">Archived</option>
          <option value="PENDING">Pending</option>
        </select>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value as "" | "true" | "false")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          title="Filter by staff assignment"
        >
          <option value="">Any Assignment</option>
          <option value="true">Assigned</option>
          <option value="false">Unassigned</option>
        </select>
        <select
          value={intakeWindow}
          onChange={(e) => setIntakeWindow(e.target.value as "" | "30" | "90")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          title="Filter by recent intake"
        >
          <option value="">Any Intake Date</option>
          <option value="30">Intake last 30 days</option>
          <option value="90">Intake last 90 days</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={missingContact}
            onChange={(e) => setMissingContact(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
          />
          Missing contact info
        </label>
        {(search || statusFilter || assignedFilter || missingContact || intakeWindow) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setAssignedFilter("");
              setMissingContact(false);
              setIntakeWindow("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400 animate-pulse">Loading clients…</div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No clients found.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Add your first client</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Intake Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Assigned Staff</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`/compassion/clients/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {client.firstName} {client.lastName}
                    </a>
                    {client.preferredName && (
                      <span className="text-xs text-gray-400 ml-1">({client.preferredName})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(client.clientStatus)}`}>
                      {client.clientStatus.charAt(0) + client.clientStatus.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {client.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {client.email ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {fmtDate(client.intakeDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                    {client.assignedStaff
                      ? `${client.assignedStaff.firstName} ${client.assignedStaff.lastName}`
                      : <span className="text-gray-300">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {client._count?.cases ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Total count */}
      {!loading && clients.length > 0 && (
        <p className="text-xs text-gray-400">{clients.length} client{clients.length !== 1 ? "s" : ""} shown</p>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onCreated={load}
          staffList={staffList}
        />
      )}
    </div>
  );
}
