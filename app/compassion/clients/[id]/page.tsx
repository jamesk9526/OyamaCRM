// Compassion CRM — Individual client profile page.
// Route: /compassion/clients/[id]
// Fetches full client record (with cases, appointments, services, activities)
// and displays it in a tabbed layout with inline editing.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import ClientActivityEntriesTab from "@/app/components/compassion/client-workspace/ClientActivityEntriesTab";
import ClientFollowUpsTab from "@/app/components/compassion/client-workspace/ClientFollowUpsTab";
import ClientServicesLogTab from "@/app/components/compassion/client-workspace/ClientServicesLogTab";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffRef {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName?: string;
}

interface CompassionCase {
  id: string;
  caseNumber: string;
  caseStatus: string;
  caseType: string;
  openedAt: string;
  closedAt?: string;
  priority: string;
  summary?: string;
  assignedStaff?: StaffRef;
}

interface CompassionAppointment {
  id: string;
  appointmentType: string;
  status: string;
  startTime: string;
  endTime?: string;
  location?: string;
  notes?: string;
  assignedStaff?: StaffRef;
}

interface CompassionService {
  id: string;
  serviceType: string;
  serviceDate: string;
  quantity?: number;
  notes?: string;
}

interface CompassionActivity {
  id: string;
  activityType: string;
  description: string;
  createdAt: string;
  performedBy?: { firstName: string; lastName: string };
}

interface CompassionFollowUp {
  id: string;
  title: string;
  status: string;
  dueDate: string;
}

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  dateOfBirth?: string;
  intakeDate: string;
  referralSource?: string;
  privateNotes?: string;
  clientStatus: string;
  assignedStaff?: StaffRef;
  cases: CompassionCase[];
  appointments: CompassionAppointment[];
  services: CompassionService[];
  followUps: CompassionFollowUp[];
  activities: CompassionActivity[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format ISO date string as MM/DD/YYYY */
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** Format ISO datetime as MM/DD/YYYY h:mm AM/PM */
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/** Maps clientStatus to a badge class */
function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-700",
    INACTIVE: "bg-gray-100 text-gray-500",
    GRADUATED: "bg-emerald-100 text-emerald-700",
    ARCHIVED: "bg-gray-100 text-gray-400",
    PENDING: "bg-amber-100 text-amber-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

/** Maps a caseStatus to a badge class */
function caseStatusBadge(status: string) {
  const map: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    CLOSED: "bg-gray-100 text-gray-500",
    ON_HOLD: "bg-amber-100 text-amber-700",
    RESOLVED: "bg-emerald-100 text-emerald-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

/** Maps appointment status to badge class */
function apptStatusBadge(status: string) {
  const map: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-600",
    NO_SHOW: "bg-amber-100 text-amber-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

/** Prettify an ALL_CAPS enum value */
function pretty(val: string) {
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Edit Client Modal ────────────────────────────────────────────────────────

/**
 * EditClientModal: allows editing the full client record.
 * Calls PUT /api/compassion/clients/:id on submit.
 */
function EditClientModal({
  client,
  staffList,
  onClose,
  onSaved,
}: {
  client: ClientDetail;
  staffList: StaffRef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: client.firstName,
    lastName: client.lastName,
    preferredName: client.preferredName ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    addressLine1: client.addressLine1 ?? "",
    addressLine2: client.addressLine2 ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    zip: client.zip ?? "",
    dateOfBirth: client.dateOfBirth ? client.dateOfBirth.slice(0, 10) : "",
    intakeDate: client.intakeDate.slice(0, 10),
    referralSource: client.referralSource ?? "",
    assignedStaffId: client.assignedStaff?.id ?? "",
    clientStatus: client.clientStatus,
    privateNotes: client.privateNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/compassion/clients/${client.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          preferredName: form.preferredName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          addressLine1: form.addressLine1 || undefined,
          addressLine2: form.addressLine2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zip: form.zip || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          assignedCompassionStaffId: form.assignedStaffId || undefined,
          referralSource: form.referralSource || undefined,
          privateNotes: form.privateNotes || undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: string, type = "text", required = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        value={form[key as keyof typeof form]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            {field("First Name", "firstName", "text", true)}
            {field("Last Name", "lastName", "text", true)}
          </div>
          {field("Preferred Name", "preferredName")}

          <div className="grid grid-cols-2 gap-3">
            {field("Email", "email", "email")}
            {field("Phone", "phone", "tel")}
          </div>

          {field("Address Line 1", "addressLine1")}
          {field("Address Line 2", "addressLine2")}

          <div className="grid grid-cols-3 gap-3">
            {field("City", "city")}
            {field("State", "state")}
            {field("ZIP", "zip")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("Date of Birth", "dateOfBirth", "date")}
            {field("Intake Date", "intakeDate", "date")}
          </div>

          {field("Referral Source", "referralSource")}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.clientStatus}
                onChange={(e) => set("clientStatus", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {["ACTIVE", "INACTIVE", "PENDING", "GRADUATED", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>{pretty(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Staff</label>
              <select
                value={form.assignedStaffId}
                onChange={(e) => set("assignedStaffId", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName ?? s.displayName ?? `${s.firstName} ${s.lastName}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Private Notes <span className="text-gray-400 font-normal">(staff only)</span>
            </label>
            <textarea
              rows={4}
              value={form.privateNotes}
              onChange={(e) => set("privateNotes", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

/**
 * OverviewTab: displays contact info, address, key dates, referral source, and private notes.
 */
function OverviewTab({ client }: { client: ClientDetail }) {
  const address = [client.addressLine1, client.addressLine2, client.city, client.state, client.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Contact Information</h3>
        <InfoRow label="Email" value={client.email} />
        <InfoRow label="Phone" value={client.phone} />
        <InfoRow label="Address" value={address || undefined} />
      </section>

      {/* Details */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Client Details</h3>
        <InfoRow label="Date of Birth" value={fmtDate(client.dateOfBirth)} />
        <InfoRow label="Intake Date" value={fmtDate(client.intakeDate)} />
        <InfoRow label="Referral Source" value={client.referralSource} />
        <InfoRow label="Assigned Staff"
          value={client.assignedStaff
            ? `${client.assignedStaff.firstName} ${client.assignedStaff.lastName}`
            : undefined}
        />
      </section>

      {/* Private Notes */}
      {client.privateNotes && (
        <section className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">🔒 Private Notes (Staff Only)</h3>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{client.privateNotes}</p>
        </section>
      )}
    </div>
  );
}

/**
 * DetailsTab shows deeper demographic and lifecycle details for the active client.
 */
function DetailsTab({ client }: { client: ClientDetail }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Demographics</h3>
        <InfoRow label="Legal Name" value={`${client.firstName} ${client.lastName}`} />
        <InfoRow label="Preferred Name" value={client.preferredName} />
        <InfoRow label="Date of Birth" value={fmtDate(client.dateOfBirth)} />
        <InfoRow label="Gender" value="Not captured yet" />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Lifecycle</h3>
        <InfoRow label="Client Status" value={pretty(client.clientStatus)} />
        <InfoRow label="Intake Date" value={fmtDate(client.intakeDate)} />
        <InfoRow label="Referral Source" value={client.referralSource} />
        <InfoRow
          label="Assigned Staff"
          value={client.assignedStaff ? `${client.assignedStaff.firstName} ${client.assignedStaff.lastName}` : undefined}
        />
      </section>
    </div>
  );
}

/** Simple label/value row used in overview panels */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

/**
 * CasesTab: list of all cases for this client.
 */
function CasesTab({ cases }: { cases: CompassionCase[] }) {
  if (cases.length === 0) {
    return <EmptyState message="No cases on record for this client." />;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Case #</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Case Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Outcome</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Assessment Stage</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Spiritual Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {cases.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.caseNumber}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDate(c.openedAt)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${caseStatusBadge(c.caseStatus)}`}>
                  {pretty(c.caseStatus)}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{fmtDate(c.closedAt)}</td>
              <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{c.summary ?? "Pending"}</td>
              <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{pretty(c.caseType)}</td>
              <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">Not recorded</td>
              <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                {c.assignedStaff ? `${c.assignedStaff.firstName} ${c.assignedStaff.lastName}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * AppointmentsTab: recent appointments for this client.
 */
function AppointmentsTab({ appointments }: { appointments: CompassionAppointment[] }) {
  if (appointments.length === 0) {
    return <EmptyState message="No appointments scheduled for this client." />;
  }

  const now = new Date();
  const upcoming = appointments.filter((appointment) => new Date(appointment.startTime) >= now);
  const history = appointments.filter((appointment) => new Date(appointment.startTime) < now);

  const renderCard = (appointment: CompassionAppointment) => (
    <div key={appointment.id} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{pretty(appointment.appointmentType)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(appointment.startTime)}</p>
          {appointment.location && <p className="text-xs text-gray-400 mt-0.5">📍 {appointment.location}</p>}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${apptStatusBadge(appointment.status)}`}>
          {pretty(appointment.status)}
        </span>
      </div>
      {appointment.notes && <p className="text-xs text-gray-600 mt-2 border-t border-gray-50 pt-2">{appointment.notes}</p>}
      {appointment.assignedStaff && (
        <p className="text-xs text-gray-400 mt-1">
          Staff: {appointment.assignedStaff.firstName} {appointment.assignedStaff.lastName}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Upcoming Appointments</h3>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-400">
            No upcoming appointments.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appointment) => renderCard(appointment))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Appointment History</h3>
        {history.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-400">
            No historical appointments yet.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((appointment) => renderCard(appointment))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * ResourcesTab: resource and service records rendered for this client.
 */
function ResourcesTab({ services }: { services: CompassionService[] }) {
  if (services.length === 0) {
    return <EmptyState message="No resource or service records found for this client." />;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Service Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {services.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{pretty(s.serviceType)}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDate(s.serviceDate)}</td>
              <td className="px-4 py-3 text-gray-500">{s.quantity ?? "—"}</td>
              <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{s.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * AuditLogTab shows a chronological list of auditable activity entries tied to this client.
 */
function AuditLogTab({ activities }: { activities: CompassionActivity[] }) {
  if (activities.length === 0) {
    return <EmptyState message="No audit events recorded yet for this client." />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date / Time</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {activities.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{fmtDateTime(a.createdAt)}</td>
              <td className="px-4 py-3 text-gray-700 font-medium">{pretty(a.activityType)}</td>
              <td className="px-4 py-3 text-gray-600">{a.description}</td>
              <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                {a.performedBy ? `${a.performedBy.firstName} ${a.performedBy.lastName}` : "System"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ActivityTab: chronological activity timeline for this client.
 */
function ActivityTab({ activities }: { activities: CompassionActivity[] }) {
  if (activities.length === 0) {
    return <EmptyState message="No activity recorded for this client." />;
  }
  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3 items-start bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
            {a.activityType.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-700">{pretty(a.activityType)}</p>
            <p className="text-sm text-gray-700 mt-0.5">{a.description}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span>{fmtDateTime(a.createdAt)}</span>
              {a.performedBy && (
                <>
                  <span>·</span>
                  <span>{a.performedBy.firstName} {a.performedBy.lastName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic empty-state placeholder */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab =
  | "overview"
  | "details"
  | "cases"
  | "activity"
  | "notes"
  | "appointments"
  | "followUps"
  | "resources"
  | "documents"
  | "medical"
  | "assessments"
  | "pregnancyTests"
  | "sonograms"
  | "referrals"
  | "classes"
  | "boutique"
  | "communication"
  | "portal"
  | "auditLog";

/**
 * ClientProfilePage: full client profile for a Compassion CRM client.
 * Fetches GET /api/compassion/clients/:id and displays a tabbed interface.
 * TODO: enforce Compassion workspace permission
 */
export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [staffList, setStaffList] = useState<StaffRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showEdit, setShowEdit] = useState(false);

  /** Load the full client record */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ClientDetail>(`/api/compassion/clients/${id}`);
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load staff list once for edit modal
  useEffect(() => {
    apiFetch<StaffRef[]>("/api/compassion/staff?active=true&limit=200")
      .then((d) => setStaffList(Array.isArray(d) ? d : []))
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ──
  if (error || !client) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700 font-medium mb-2">Could not load client</p>
        <p className="text-sm text-red-500 mb-4">{error ?? "Client not found."}</p>
        <button
          onClick={() => router.push("/compassion/clients")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Clients
        </button>
      </div>
    );
  }

  const noteCount = client.activities.filter((item) => item.activityType === "CLIENT_NOTE").length;
  const documentCount = client.activities.filter((item) => item.activityType === "CLIENT_DOCUMENT").length;
  const assessmentCount = client.activities.filter((item) => item.activityType === "CLIENT_ASSESSMENT").length;
  const communicationCount = client.activities.filter((item) => item.activityType === "CLIENT_COMMUNICATION").length;
  const portalEventCount = client.activities.filter((item) => item.activityType === "CLIENT_PORTAL_EVENT").length;
  const pregnancyTestCount = client.services.filter((item) => item.serviceType === "PREGNANCY_TEST").length;
  const sonogramCount = client.services.filter((item) => item.serviceType === "ULTRASOUND").length;
  const referralCount = client.services.filter((item) => ["HOUSING_REFERRAL", "EDUCATION_REFERRAL", "JOB_REFERRAL", "TRANSPORTATION_RESOURCE", "NUTRITION_SUPPORT"].includes(item.serviceType)).length;
  const classCount = client.services.filter((item) => item.serviceType === "PARENTING_CLASS").length;
  const boutiqueCount = client.services.filter((item) => ["DIAPERS", "CLOTHING", "FORMULA"].includes(item.serviceType)).length;
  const medicalCount = client.services.filter((item) => ["PREGNANCY_TEST", "ULTRASOUND", "COUNSELING", "OTHER"].includes(item.serviceType)).length;
  const activeCaseCount = client.cases.filter((item) => !["CLOSED", "ARCHIVED"].includes(item.caseStatus)).length;
  const openFollowUpCount = client.followUps.filter((item) => ["PENDING", "IN_PROGRESS"].includes(item.status)).length;
  const upcomingAppointmentCount = client.appointments.filter((item) => new Date(item.startTime).getTime() >= Date.now()).length;

  const tabMeta: Record<Tab, { label: string; count?: number }> = {
    overview: { label: "Overview" },
    details: { label: "Details" },
    cases: { label: "Cases", count: client.cases.length },
    activity: { label: "Activity", count: client.activities.length },
    notes: { label: "Notes", count: noteCount },
    appointments: { label: "Appointments", count: client.appointments.length },
    followUps: { label: "Follow Ups", count: client.followUps.length },
    resources: { label: "Resources", count: client.services.length },
    documents: { label: "Documents", count: documentCount },
    medical: { label: "Medical", count: medicalCount },
    assessments: { label: "Assessments", count: assessmentCount },
    pregnancyTests: { label: "Pregnancy Tests", count: pregnancyTestCount },
    sonograms: { label: "Sonograms", count: sonogramCount },
    referrals: { label: "Referrals", count: referralCount },
    classes: { label: "Classes", count: classCount },
    boutique: { label: "Boutique", count: boutiqueCount },
    communication: { label: "Communication", count: communicationCount },
    portal: { label: "Portal", count: portalEventCount },
    auditLog: { label: "Audit Log", count: client.activities.length },
  };

  const tabGroups: Array<{ label: string; tabs: Tab[] }> = [
    {
      label: "Client Profile",
      tabs: ["overview", "details", "cases", "activity", "appointments", "followUps", "auditLog"],
    },
    {
      label: "Care Documentation",
      tabs: ["notes", "assessments", "documents", "communication", "portal"],
    },
    {
      label: "Services And Programs",
      tabs: ["resources", "medical", "pregnancyTests", "sonograms", "referrals", "classes", "boutique"],
    },
  ];

  const tabNotices: Partial<Record<Tab, string>> = {
    documents: "Document record CRUD is active. Secure file upload/storage and signed retrieval links are still being finalized.",
    portal: "Portal event CRUD is active. Automated inbound portal event ingestion is still being finalized.",
  };

  const displayName = client.preferredName
    ? `${client.firstName} "${client.preferredName}" ${client.lastName}`
    : `${client.firstName} ${client.lastName}`;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/compassion/clients")}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        ← Clients
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold shrink-0">
              {client.firstName.charAt(0)}{client.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(client.clientStatus)}`}>
                  {pretty(client.clientStatus)}
                </span>
                {client.email && (
                  <span className="text-sm text-gray-500">{client.email}</span>
                )}
                {client.phone && (
                  <span className="text-sm text-gray-500">{client.phone}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Intake: {fmtDate(client.intakeDate)}
                {client.assignedStaff && (
                  <> · Assigned to: {client.assignedStaff.firstName} {client.assignedStaff.lastName}</>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            ✏️ Edit Client
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Open Cases</p>
          <p className="text-2xl font-semibold text-blue-700">{activeCaseCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Upcoming Appointments</p>
          <p className="text-2xl font-semibold text-indigo-700">{upcomingAppointmentCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Open Follow Ups</p>
          <p className="text-2xl font-semibold text-amber-700">{openFollowUpCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Service Entries</p>
          <p className="text-2xl font-semibold text-emerald-700">{client.services.length}</p>
        </div>
      </section>

      {/* Grouped tabs */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        {tabGroups.map((group) => (
          <section key={group.label} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.tabs.map((tabId) => {
                const tabInfo = tabMeta[tabId];
                return (
                  <button
                    key={tabId}
                    onClick={() => setTab(tabId)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tab === tabId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tabInfo.label}
                    {tabInfo.count !== undefined && tabInfo.count > 0 ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === tabId ? "bg-white/20 text-white" : "bg-white text-gray-600"}`}>
                        {tabInfo.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">Client-scoped workspace</p>
        <p className="text-sm text-blue-700 mt-1">
          This profile is the source of truth for this client. Profile, care documentation, and service-delivery records are organized into focused tab groups.
        </p>
      </div>

      {tabNotices[tab] ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
          <p className="text-sm text-amber-800 mt-1">{tabNotices[tab]}</p>
        </section>
      ) : null}

      {/* Tab content */}
      {tab === "overview"      && <OverviewTab client={client} />}
      {tab === "details"       && <DetailsTab client={client} />}
      {tab === "cases"         && <CasesTab cases={client.cases} />}
      {tab === "activity"      && <ActivityTab activities={client.activities} />}
      {tab === "notes"         && (
        <ClientActivityEntriesTab
          clientId={client.id}
          activityType="CLIENT_NOTE"
          title="Notes"
          intro="Create and manage private client notes with full client scoping and audit coverage."
          entryLabel="Note"
          emptyMessage="No notes have been added for this client yet."
          metadataFields={[
            {
              key: "visibility",
              label: "Visibility",
              type: "select",
              options: ["staff_only", "team"],
            },
          ]}
        />
      )}
      {tab === "appointments"  && <AppointmentsTab appointments={client.appointments} />}
      {tab === "followUps"     && <ClientFollowUpsTab clientId={client.id} />}
      {tab === "resources"     && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Resources"
          intro="Track services and resource assistance delivered to this client."
          allowedServiceTypes={[
            "PREGNANCY_TEST",
            "ULTRASOUND",
            "DIAPERS",
            "CLOTHING",
            "FORMULA",
            "PARENTING_CLASS",
            "HOUSING_REFERRAL",
            "EDUCATION_REFERRAL",
            "JOB_REFERRAL",
            "NUTRITION_SUPPORT",
            "COUNSELING",
            "TRANSPORTATION_RESOURCE",
            "OTHER",
          ]}
          emptyMessage="No resources or service entries have been logged for this client."
        />
      )}
      {tab === "documents"     && (
        <ClientActivityEntriesTab
          clientId={client.id}
          activityType="CLIENT_DOCUMENT"
          title="Documents"
          intro="Register client document records and secure links in the client workspace timeline."
          entryLabel="Document record"
          emptyMessage="No document records have been logged for this client."
          metadataFields={[
            { key: "documentName", label: "Document Name", placeholder: "Intake Packet" },
            { key: "documentType", label: "Document Type", placeholder: "Consent / Medical / Form" },
            { key: "documentUrl", label: "Document URL", type: "url", placeholder: "https://..." },
          ]}
        />
      )}
      {tab === "medical"       && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Medical"
          intro="Track medical-related client services and outcomes with a complete dated log."
          allowedServiceTypes={["PREGNANCY_TEST", "ULTRASOUND", "COUNSELING", "OTHER"]}
          defaultServiceType="PREGNANCY_TEST"
          emptyMessage="No medical service records have been logged for this client."
        />
      )}
      {tab === "assessments"   && (
        <ClientActivityEntriesTab
          clientId={client.id}
          activityType="CLIENT_ASSESSMENT"
          title="Assessments"
          intro="Record client assessments with stage, score, and recommendation details."
          entryLabel="Assessment summary"
          emptyMessage="No assessments have been recorded for this client."
          metadataFields={[
            { key: "assessmentStage", label: "Stage", placeholder: "Intake / Progress / Exit" },
            { key: "score", label: "Score", placeholder: "0-100" },
            { key: "recommendation", label: "Recommendation", placeholder: "Next best action" },
          ]}
        />
      )}
      {tab === "pregnancyTests" && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Pregnancy Tests"
          intro="Manage pregnancy test records, dates, and follow-up notes for this client."
          allowedServiceTypes={["PREGNANCY_TEST"]}
          defaultServiceType="PREGNANCY_TEST"
          emptyMessage="No pregnancy test records have been logged for this client."
        />
      )}
      {tab === "sonograms"     && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Sonograms"
          intro="Track sonogram-related services and outcomes in this client profile."
          allowedServiceTypes={["ULTRASOUND"]}
          defaultServiceType="ULTRASOUND"
          emptyMessage="No sonogram records have been logged for this client."
        />
      )}
      {tab === "referrals"     && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Referrals"
          intro="Log referral service outcomes and destination categories for this client."
          allowedServiceTypes={[
            "HOUSING_REFERRAL",
            "EDUCATION_REFERRAL",
            "JOB_REFERRAL",
            "TRANSPORTATION_RESOURCE",
            "NUTRITION_SUPPORT",
          ]}
          defaultServiceType="HOUSING_REFERRAL"
          emptyMessage="No referral records have been logged for this client."
        />
      )}
      {tab === "classes"       && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Classes"
          intro="Track class attendance and completion entries for this client."
          allowedServiceTypes={["PARENTING_CLASS"]}
          defaultServiceType="PARENTING_CLASS"
          emptyMessage="No class records have been logged for this client."
        />
      )}
      {tab === "boutique"      && (
        <ClientServicesLogTab
          clientId={client.id}
          title="Boutique"
          intro="Track boutique and material assistance inventory support provided to this client."
          allowedServiceTypes={["DIAPERS", "CLOTHING", "FORMULA"]}
          defaultServiceType="DIAPERS"
          emptyMessage="No boutique or material-assistance records have been logged for this client."
        />
      )}
      {tab === "communication" && (
        <ClientActivityEntriesTab
          clientId={client.id}
          activityType="CLIENT_COMMUNICATION"
          title="Communication"
          intro="Log email, SMS, phone, and in-person communication notes for this client."
          entryLabel="Communication log"
          emptyMessage="No communication logs have been recorded for this client."
          metadataFields={[
            {
              key: "channel",
              label: "Channel",
              type: "select",
              options: ["email", "sms", "phone", "in_person", "mail"],
            },
            {
              key: "direction",
              label: "Direction",
              type: "select",
              options: ["outbound", "inbound"],
            },
            { key: "result", label: "Result", placeholder: "Reached / Voicemail / No response" },
          ]}
        />
      )}
      {tab === "portal"        && (
        <ClientActivityEntriesTab
          clientId={client.id}
          activityType="CLIENT_PORTAL_EVENT"
          title="Portal"
          intro="Track client portal interactions, submissions, and engagement events."
          entryLabel="Portal event"
          emptyMessage="No portal events have been recorded for this client."
          metadataFields={[
            { key: "eventType", label: "Event Type", placeholder: "Form submitted / Message sent" },
            { key: "source", label: "Source", placeholder: "Portal / Embedded form" },
            { key: "referenceUrl", label: "Reference URL", type: "url", placeholder: "https://..." },
          ]}
        />
      )}
      {tab === "auditLog"      && <AuditLogTab activities={client.activities} />}

      {/* Edit Modal */}
      {showEdit && (
        <EditClientModal
          client={client}
          staffList={staffList}
          onClose={() => setShowEdit(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
