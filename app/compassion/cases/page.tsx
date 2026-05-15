// Compassion CRM — Cases page. Full list with search, filter, and create modal.
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

/** Case as returned from GET /api/compassion/cases */
interface CompassionCase {
  id: string;
  caseNumber: string;
  caseStatus: string;
  caseType: string;
  priority: string;
  openedAt: string;
  summary?: string;
  client?: { id: string; firstName: string; lastName: string };
  assignedStaff?: { id: string; firstName: string; lastName: string };
  _count?: { appointments: number; followUps: number };
}

/** Client for the case-create dropdown */
interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

/** Staff user for assignee dropdown */
interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName?: string;
}

/** Maps case status to badge style */
function statusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN:        "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-violet-100 text-violet-700",
    PENDING:     "bg-amber-100 text-amber-700",
    CLOSED:      "bg-gray-100 text-gray-500",
    ARCHIVED:    "bg-gray-100 text-gray-400",
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

/** Human-readable case type label */
function typeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── New Case Modal ───────────────────────────────────────────────────────────

/**
 * NewCaseModal: form to create a new Compassion CRM case.
 * Posts to POST /api/compassion/cases with clientId, caseType, priority, summary.
 */
function NewCaseModal({ onClose, onCreated, clientList, staffList }: {
  onClose: () => void;
  onCreated: () => void;
  clientList: ClientOption[];
  staffList: StaffUser[];
}) {
  const [form, setForm] = useState({
    clientId: "", caseType: "OTHER", priority: "MEDIUM", summary: "", assignedStaffId: "",
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
      await apiFetch("/api/compassion/cases", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          assignedCompassionStaffId: form.assignedStaffId || undefined,
          summary: form.summary || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title="New Case"
      subtitle="Open a Compassion case and assign the right staff ownership and priority."
      checklist={["1. Choose client", "2. Define case type and priority", "3. Save case"]}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Case</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
            <select required value={form.clientId} onChange={(e) => set("clientId", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select a client…</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Case Type</label>
              <select value={form.caseType} onChange={(e) => set("caseType", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {["PREGNANCY_SUPPORT","PARENTING","MATERIAL_ASSISTANCE","HOUSING","EDUCATION",
                  "EMPLOYMENT","COUNSELING","RESOURCE_REFERRAL","FOLLOW_UP","OTHER"].map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Summary</label>
            <textarea rows={3} value={form.summary} onChange={(e) => set("summary", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="Brief description of the case…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating…" : "Open Case"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

/**
 * CompassionCasesPage: full case list with search, status filter, and create modal.
 * Fetches from GET /api/compassion/cases. Clients list is loaded for the create form.
 * Access enforcement is handled by CompassionLayout and /api/compassion middleware.
 */
export default function CompassionCasesPage() {
  const [cases, setCases] = useState<CompassionCase[]>([]);
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  /** Load cases from API */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<CompassionCase[]>(`/api/compassion/cases?${params}`);
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Load client and staff lists for the create form
  useEffect(() => {
    apiFetch<ClientOption[]>("/api/compassion/clients?limit=200")
      .then((d) => setClientList(Array.isArray(d) ? d : []))
      .catch(() => setClientList([]));

    apiFetch<StaffUser[]>("/api/compassion/staff?active=true&limit=200")
      .then((d) => setStaffList(Array.isArray(d) ? d : []))
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCases = cases.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const clientName = `${item.client?.firstName ?? ""} ${item.client?.lastName ?? ""}`.trim().toLowerCase();
    return item.caseNumber.toLowerCase().includes(q) || clientName.includes(q) || typeLabel(item.caseType).toLowerCase().includes(q);
  });

  const openCount = filteredCases.filter((item) => item.caseStatus === "OPEN").length;
  const inProgressCount = filteredCases.filter((item) => item.caseStatus === "IN_PROGRESS").length;
  const urgentCount = filteredCases.filter((item) => item.priority === "URGENT").length;

  return (
    <div className="space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Compassion CRM", href: "/compassion/dashboard" },
          { label: "Cases" },
        ]}
        statusLabel={loading ? "Loading" : "Working"}
        metadata={`${filteredCases.length.toLocaleString()} case${filteredCases.length === 1 ? "" : "s"} · ${statusFilter || "all statuses"}`}
        accentTone="blue"
        primaryAction={<WorkspaceRibbonButton label="New Case" onClick={() => setShowModal(true)} variant="primary" accentTone="blue" />}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="New Case" onClick={() => setShowModal(true)} variant="primary" accentTone="blue" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Status">
          <WorkspaceRibbonButton label="All" onClick={() => setStatusFilter("")} active={!statusFilter} accentTone="blue" />
          <WorkspaceRibbonButton label="Open" onClick={() => setStatusFilter("OPEN")} active={statusFilter === "OPEN"} accentTone="blue" />
          <WorkspaceRibbonButton label="In Progress" onClick={() => setStatusFilter("IN_PROGRESS")} active={statusFilter === "IN_PROGRESS"} accentTone="blue" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Filters">
          <WorkspaceRibbonButton label="Clear" onClick={() => { setSearch(""); setStatusFilter(""); }} disabled={!search && !statusFilter} accentTone="blue" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Open Cases</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{inProgressCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Urgent Priority</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{urgentCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by case #, client, or type..."
          className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="CLOSED">Closed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400 animate-pulse">Loading cases…</div>
        ) : filteredCases.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No cases found.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Open the first case</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Case #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Opened</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Assigned Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{c.caseNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.client ? `${c.client.firstName} ${c.client.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{typeLabel(c.caseType)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(c.caseStatus)}`}>
                      {c.caseStatus === "IN_PROGRESS" ? "In Progress"
                        : c.caseStatus.charAt(0) + c.caseStatus.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge(c.priority)}`}>
                      {c.priority.charAt(0) + c.priority.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {new Date(c.openedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                    {c.assignedStaff
                      ? `${c.assignedStaff.firstName} ${c.assignedStaff.lastName}`
                      : <span className="text-gray-300">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filteredCases.length > 0 && (
        <p className="text-xs text-gray-400">{filteredCases.length} case{filteredCases.length !== 1 ? "s" : ""} shown</p>
      )}

      {showModal && (
        <NewCaseModal
          onClose={() => setShowModal(false)}
          onCreated={load}
          clientList={clientList}
          staffList={staffList}
        />
      )}
    </div>
  );
}
