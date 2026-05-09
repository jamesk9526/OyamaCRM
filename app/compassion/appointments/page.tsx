// Compassion CRM — Appointments page. Full list with filters and schedule modal.
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Appointment as returned from GET /api/compassion/appointments */
interface CompassionAppointment {
  id: string;
  appointmentType: string;
  status: string;
  startTime: string;
  durationMinutes?: number;
  location?: string;
  notes?: string;
  client?: { id: string; firstName: string; lastName: string };
  case?: { id: string; caseNumber: string };
  staff?: { id: string; firstName: string; lastName: string };
}

interface ClientOption { id: string; firstName: string; lastName: string }
interface StaffUser    { id: string; firstName: string; lastName: string }

/** Maps appointment status to badge style */
function statusBadge(status: string) {
  const styles: Record<string, string> = {
    SCHEDULED:  "bg-blue-100 text-blue-700",
    COMPLETED:  "bg-emerald-100 text-emerald-700",
    CANCELLED:  "bg-red-100 text-red-600",
    NO_SHOW:    "bg-orange-100 text-orange-700",
    RESCHEDULED:"bg-amber-100 text-amber-700",
  };
  return styles[status] ?? "bg-gray-100 text-gray-500";
}

/** Human-readable appointment type */
function typeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format ISO datetime as readable string */
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ─── Schedule Appointment Modal ───────────────────────────────────────────────

/**
 * ScheduleAppointmentModal: form to schedule a new appointment.
 * Posts to POST /api/compassion/appointments.
 */
function ScheduleAppointmentModal({ onClose, onCreated, clientList, staffList }: {
  onClose: () => void;
  onCreated: () => void;
  clientList: ClientOption[];
  staffList: StaffUser[];
}) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const defaultDt = now.toISOString().slice(0, 16);

  const [form, setForm] = useState({
    clientId: "", staffId: "", appointmentType: "INTAKE",
    startTime: defaultDt, durationMinutes: "60", location: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) { setError("Please select a client"); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/compassion/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId,
          staffId: form.staffId || undefined,
          appointmentType: form.appointmentType,
          startTime: new Date(form.startTime).toISOString(),
          durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
          location: form.location || undefined,
          notes: form.notes || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule appointment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Schedule Appointment</h2>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Appointment Type</label>
            <select value={form.appointmentType} onChange={(e) => set("appointmentType", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {["INTAKE","PREGNANCY_TEST","ULTRASOUND","PARENTING_CLASS",
                "MATERIAL_ASSISTANCE","RESOURCE_REFERRAL","FOLLOW_UP","MENTORING",
                "CASE_REVIEW","HOME_VISIT","OTHER"].map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time</label>
              <input type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duration (min)</label>
              <input type="number" min="5" step="5" value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Staff</label>
              <select value={form.staffId} onChange={(e) => set("staffId", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <input value={form.location} onChange={(e) => set("location", e.target.value)}
                placeholder="Office, Zoom, etc."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

/**
 * CompassionAppointmentsPage: list of appointments with status filter and schedule modal.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionAppointmentsPage() {
  const [appointments, setAppointments] = useState<CompassionAppointment[]>([]);
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<CompassionAppointment[]>(`/api/compassion/appointments?${params}`);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    apiFetch<ClientOption[]>("/api/compassion/clients?limit=200")
      .then((d) => setClientList(Array.isArray(d) ? d : []))
      .catch(() => setClientList([]));
    apiFetch<{ items?: StaffUser[] } | StaffUser[]>("/api/users?limit=100")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d as { items?: StaffUser[] }).items ?? [];
        setStaffList(list);
      })
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-xl">📅</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
            <p className="text-sm text-gray-500 mt-0.5">Schedule and manage client appointments.</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Schedule Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No-Show</option>
          <option value="RESCHEDULED">Rescheduled</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400 animate-pulse">Loading appointments…</div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No appointments found.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Schedule the first appointment</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date & Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Staff</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.client ? `${a.client.firstName} ${a.client.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{typeLabel(a.appointmentType)}</td>
                  <td className="px-4 py-3 text-gray-700">{fmtDateTime(a.startTime)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(a.status)}`}>
                      {a.status === "NO_SHOW" ? "No-Show"
                        : a.status.charAt(0) + a.status.slice(1).toLowerCase().replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                    {a.location ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && appointments.length > 0 && (
        <p className="text-xs text-gray-400">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""} shown</p>
      )}

      {showModal && (
        <ScheduleAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={load}
          clientList={clientList}
          staffList={staffList}
        />
      )}
    </div>
  );
}
