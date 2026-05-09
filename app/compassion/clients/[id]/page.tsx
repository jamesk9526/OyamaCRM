// Compassion CRM — Individual client profile page.
// Route: /compassion/clients/[id]
// Fetches full client record (with cases, appointments, services, activities)
// and displays it in a tabbed layout with inline editing.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import ClientWorkspacePlaceholder from "@/app/components/compassion/client-workspace/ClientWorkspacePlaceholder";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffRef {
  id: string;
  firstName: string;
  lastName: string;
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
          assignedStaffId: form.assignedStaffId || undefined,
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
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
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
  return (
    <div className="space-y-3">
      {appointments.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{pretty(a.appointmentType)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(a.startTime)}</p>
              {a.location && <p className="text-xs text-gray-400 mt-0.5">📍 {a.location}</p>}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${apptStatusBadge(a.status)}`}>
              {pretty(a.status)}
            </span>
          </div>
          {a.notes && <p className="text-xs text-gray-600 mt-2 border-t border-gray-50 pt-2">{a.notes}</p>}
          {a.assignedStaff && (
            <p className="text-xs text-gray-400 mt-1">
              Staff: {a.assignedStaff.firstName} {a.assignedStaff.lastName}
            </p>
          )}
        </div>
      ))}
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
 * PlannedClientTab displays a standard in-development warning for tabs not fully implemented yet.
 */
function PlannedClientTab({ title, description }: { title: string; description: string }) {
  return (
    <ClientWorkspacePlaceholder
      title={title}
      description={description}
      criteria={[
        "Client-scoped data retrieval is implemented and filtered by clientId.",
        "At least one create/update happy-path test exists.",
        "Audit events for view/create/update actions are written.",
      ]}
    />
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
    apiFetch<{ items?: StaffRef[] } | StaffRef[]>("/api/users?limit=100")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d as { items?: StaffRef[] }).items ?? [];
        setStaffList(list);
      })
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

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
    { id: "cases", label: "Cases", count: client.cases.length },
    { id: "activity", label: "Activity", count: client.activities.length },
    { id: "notes", label: "Notes" },
    { id: "appointments", label: "Appointments", count: client.appointments.length },
    { id: "followUps", label: "Follow Ups" },
    { id: "resources", label: "Resources", count: client.services.length },
    { id: "documents", label: "Documents" },
    { id: "medical", label: "Medical" },
    { id: "assessments", label: "Assessments" },
    { id: "pregnancyTests", label: "Pregnancy Tests" },
    { id: "sonograms", label: "Sonograms" },
    { id: "referrals", label: "Referrals" },
    { id: "classes", label: "Classes" },
    { id: "boutique", label: "Boutique" },
    { id: "communication", label: "Communication" },
    { id: "portal", label: "Portal" },
    { id: "auditLog", label: "Audit Log", count: client.activities.length },
  ];

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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">Client-scoped workspace</p>
        <p className="text-sm text-blue-700 mt-1">
          This profile is the source of truth for client service history. Top-level navigation stays focused while detailed care records are managed here by client.
        </p>
      </div>

      {/* Tab content */}
      {tab === "overview"      && <OverviewTab client={client} />}
      {tab === "details"       && <DetailsTab client={client} />}
      {tab === "cases"         && <CasesTab cases={client.cases} />}
      {tab === "activity"      && <ActivityTab activities={client.activities} />}
      {tab === "notes"         && <PlannedClientTab title="Notes" description="Structured and freeform client notes will be managed here with author attribution and history." />}
      {tab === "appointments"  && <AppointmentsTab appointments={client.appointments} />}
      {tab === "followUps"     && <PlannedClientTab title="Follow Ups" description="Client-linked follow-up records and outcomes will be managed here and synced with the top-level follow-up queue." />}
      {tab === "resources"     && <ResourcesTab services={client.services} />}
      {tab === "documents"     && <PlannedClientTab title="Documents" description="Client documents and forms will be stored here with secure visibility controls." />}
      {tab === "medical"       && <PlannedClientTab title="Medical" description="Sensitive medical information views will be client-scoped and permission-aware." />}
      {tab === "assessments"   && <PlannedClientTab title="Assessments" description="Assessment history, stage transitions, and case-linked progress will appear in this tab." />}
      {tab === "pregnancyTests" && <PlannedClientTab title="Pregnancy Tests" description="Pregnancy test records, outcomes, and follow-up links will be managed per client." />}
      {tab === "sonograms"     && <PlannedClientTab title="Sonograms" description="Sonogram scheduling and results tracking will be client-scoped in this tab." />}
      {tab === "referrals"     && <PlannedClientTab title="Referrals" description="Referral source and destination tracking with outcomes will be available here." />}
      {tab === "classes"       && <PlannedClientTab title="Classes" description="Class attendance, completion, and education history will be managed here." />}
      {tab === "boutique"      && <PlannedClientTab title="Boutique" description="Material assistance and boutique item usage with points tracking will appear here." />}
      {tab === "communication" && <PlannedClientTab title="Communication" description="Client email, SMS, calls, and letters with consent-aware logs will be shown here." />}
      {tab === "portal"        && <PlannedClientTab title="Portal" description="Client portal activity, form submissions, and engagement events will be tracked here." />}
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
