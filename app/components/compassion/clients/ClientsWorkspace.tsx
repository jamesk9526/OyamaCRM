// Compassion CRM clients workspace — spreadsheet-style client list with intake and assignment tools.
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

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
  assignedStaff?: { id?: string; firstName: string; lastName: string; displayName?: string | null };
  _count?: { cases: number; appointments: number };
}

interface ClientsListResponse {
  items: CompassionClient[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Staff user for assignee dropdown */
interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName?: string;
}

type ClientPageSize = 25 | 50 | 100 | 250;
type TableDensity = "compact" | "comfortable";
type ClientSortKey = "name" | "status" | "phone" | "email" | "intakeDate" | "assignedStaff" | "cases" | "appointments";
type SortDirection = "asc" | "desc";

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

/** Returns the display name staff expect to scan in list and export views. */
function staffName(client: CompassionClient): string {
  if (!client.assignedStaff) return "Unassigned";
  const displayName = client.assignedStaff.displayName
    ?? `${client.assignedStaff.firstName} ${client.assignedStaff.lastName}`.trim();
  return displayName || "Unassigned";
}

/** Escapes one CSV field for spreadsheet exports. */
function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

/** Spreadsheet-like sortable column header for visible rows. */
function SortableHeader({ label, sortKey, activeKey, direction, onSort }: {
  label: string;
  sortKey: ClientSortKey;
  activeKey: ClientSortKey;
  direction: SortDirection;
  onSort: (key: ClientSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="text-left px-3 py-2 font-medium text-gray-600">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-blue-50 hover:text-blue-700"
        title={`Sort visible rows by ${label}`}
      >
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">{active ? (direction === "asc" ? "A-Z" : "Z-A") : "sort"}</span>
      </button>
    </th>
  );
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
          firstName: form.firstName,
          lastName: form.lastName,
          preferredName: form.preferredName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          intakeDate: form.intakeDate,
          referralSource: form.referralSource || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          assignedCompassionStaffId: form.assignedStaffId || undefined,
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
    <WorkspaceSetupModal
      title="Add New Client"
      subtitle="Create a Compassion client profile with intake and assignment details."
      checklist={["1. Enter identity details", "2. Capture intake and referral", "3. Save client record"]}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <div className="max-h-[85vh] overflow-y-auto">
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
                  <option key={s.id} value={s.id}>{s.fullName ?? s.displayName ?? `${s.firstName} ${s.lastName}`}</option>
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
    </WorkspaceSetupModal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

/**
 * CompassionClientsPage: full client list with search, status filter, and create modal.
 * Fetches from GET /api/compassion/clients and POSTs to create new clients.
 * Access enforcement is handled by CompassionLayout and /api/compassion middleware.
 */
export default function ClientsWorkspace() {
  const [clients, setClients] = useState<CompassionClient[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ClientPageSize>(50);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<"" | "true" | "false">("");
  const [staffIdFilter, setStaffIdFilter] = useState("");
  const [missingContact, setMissingContact] = useState(false);
  const [intakeWindow, setIntakeWindow] = useState<"" | "30" | "90">("");
  const [density, setDensity] = useState<TableDensity>("compact");
  const [sortKey, setSortKey] = useState<ClientSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  /** Load clients from API */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (assignedFilter) params.set("assigned", assignedFilter);
      if (staffIdFilter) params.set("staffId", staffIdFilter);
      if (missingContact) params.set("missingContact", "true");
      if (intakeWindow) params.set("intakeWithinDays", intakeWindow);
      params.set("includeMeta", "1");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await apiFetch<CompassionClient[] | ClientsListResponse>(`/api/compassion/clients?${params}`);

      if (Array.isArray(data)) {
        setClients(data);
        setTotalCount(data.length);
        setTotalPages(1);
        return;
      }

      setClients(Array.isArray(data.items) ? data.items : []);
      setTotalCount(data.totalCount ?? 0);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, assignedFilter, staffIdFilter, missingContact, intakeWindow, page, pageSize]);

  // Load Compassion staff list for assignee dropdown.
  useEffect(() => {
    apiFetch<StaffUser[]>("/api/compassion/staff?active=true&limit=200")
      .then((d) => {
        setStaffList(Array.isArray(d) ? d : []);
      })
      .catch(() => setStaffList([]));
  }, []);

  // Reload when filters change (debounced for search; immediate for select/checkbox toggles)
  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Reset to first page whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, assignedFilter, staffIdFilter, missingContact, intakeWindow, pageSize]);

  // Keep the current page valid after deletions/import changes/filter narrowing.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activeCount = clients.filter((client) => client.clientStatus === "ACTIVE").length;
  const pendingCount = clients.filter((client) => client.clientStatus === "PENDING").length;
  const missingContactCount = clients.filter((client) => !client.email && !client.phone).length;
  const unassignedCount = clients.filter((client) => !client.assignedStaff).length;
  const rowStart = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const rowEnd = Math.min(totalCount, (page - 1) * pageSize + clients.length);
  const hasActiveFilters = Boolean(search || statusFilter || assignedFilter || staffIdFilter || missingContact || intakeWindow);

  const sortedClients = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...clients].sort((left, right) => {
      const leftValue = (() => {
        if (sortKey === "name") return `${left.lastName} ${left.firstName}`.toLowerCase();
        if (sortKey === "status") return left.clientStatus;
        if (sortKey === "phone") return left.phone ?? "";
        if (sortKey === "email") return left.email ?? "";
        if (sortKey === "intakeDate") return left.intakeDate;
        if (sortKey === "assignedStaff") return staffName(left).toLowerCase();
        if (sortKey === "cases") return left._count?.cases ?? 0;
        return left._count?.appointments ?? 0;
      })();
      const rightValue = (() => {
        if (sortKey === "name") return `${right.lastName} ${right.firstName}`.toLowerCase();
        if (sortKey === "status") return right.clientStatus;
        if (sortKey === "phone") return right.phone ?? "";
        if (sortKey === "email") return right.email ?? "";
        if (sortKey === "intakeDate") return right.intakeDate;
        if (sortKey === "assignedStaff") return staffName(right).toLowerCase();
        if (sortKey === "cases") return right._count?.cases ?? 0;
        return right._count?.appointments ?? 0;
      })();

      if (leftValue === rightValue) return 0;
      return leftValue > rightValue ? direction : -direction;
    });
  }, [clients, sortDirection, sortKey]);

  /** Updates local visible-row sorting without implying a full-database sort. */
  function toggleSort(nextKey: ClientSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setAssignedFilter("");
    setStaffIdFilter("");
    setMissingContact(false);
    setIntakeWindow("");
  }

  function visibleRowsCsv(): string {
    const header = ["Name", "Preferred Name", "Status", "Phone", "Email", "Intake Date", "Assigned Staff", "Cases", "Appointments"];
    const rows = sortedClients.map((client) => [
      `${client.firstName} ${client.lastName}`.trim(),
      client.preferredName ?? "",
      client.clientStatus,
      client.phone ?? "",
      client.email ?? "",
      fmtDate(client.intakeDate),
      staffName(client),
      client._count?.cases ?? 0,
      client._count?.appointments ?? 0,
    ]);
    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }

  function exportVisibleRows() {
    const blob = new Blob([visibleRowsCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `compassion-clients-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToolMessage(`Exported ${sortedClients.length} visible row${sortedClients.length === 1 ? "" : "s"}.`);
  }

  async function copyVisibleEmails() {
    const emails = sortedClients.map((client) => client.email).filter(Boolean).join("; ");
    if (!emails) {
      setToolMessage("No email addresses in the visible rows.");
      return;
    }
    await navigator.clipboard.writeText(emails);
    setToolMessage("Copied visible email addresses.");
  }

  return (
    <div className="space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Compassion CRM", href: "/compassion/dashboard" },
          { label: "Clients" },
        ]}
        statusLabel={loading ? "Loading" : "Working"}
        metadata={`${(loading ? clients.length : totalCount).toLocaleString()} client${(loading ? clients.length : totalCount) === 1 ? "" : "s"} · ${statusFilter || "all statuses"}`}
        accentTone="blue"
        primaryAction={<WorkspaceRibbonButton label="Add Client" onClick={() => setShowModal(true)} variant="primary" accentTone="blue" />}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="Add Client" onClick={() => setShowModal(true)} variant="primary" accentTone="blue" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Status">
          <WorkspaceRibbonButton label="All" onClick={() => setStatusFilter("")} active={!statusFilter} accentTone="blue" />
          <WorkspaceRibbonButton label="Active" onClick={() => setStatusFilter("ACTIVE")} active={statusFilter === "ACTIVE"} accentTone="blue" />
          <WorkspaceRibbonButton label="Pending" onClick={() => setStatusFilter("PENDING")} active={statusFilter === "PENDING"} accentTone="blue" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Filters">
          <WorkspaceRibbonButton label="Missing Contact" onClick={() => setMissingContact((value) => !value)} active={missingContact} accentTone="blue" />
          <WorkspaceRibbonButton
            label="Clear"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setAssignedFilter("");
              setStaffIdFilter("");
              setMissingContact(false);
              setIntakeWindow("");
            }}
            disabled={!hasActiveFilters}
            accentTone="blue"
          />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Tools">
          <WorkspaceRibbonButton label="Export Visible CSV" onClick={exportVisibleRows} disabled={clients.length === 0} accentTone="blue" />
          <WorkspaceRibbonButton label="Copy Emails" onClick={() => void copyVisibleEmails()} disabled={clients.length === 0} accentTone="blue" />
          <WorkspaceRibbonButton
            label={density === "compact" ? "Comfortable Rows" : "Compact Rows"}
            onClick={() => setDensity((current) => current === "compact" ? "comfortable" : "compact")}
            accentTone="blue"
          />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Visible Clients</p>
          <p className="text-2xl font-semibold text-blue-700">{clients.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Active In Page</p>
          <p className="text-2xl font-semibold text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Pending In Page</p>
          <p className="text-2xl font-semibold text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Missing Contact In Page</p>
          <p className="text-2xl font-semibold text-rose-700">{missingContactCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Unassigned In Page</p>
          <p className="text-2xl font-semibold text-slate-700">{unassignedCount}</p>
        </div>
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
          onChange={(e) => {
            setAssignedFilter(e.target.value as "" | "true" | "false");
            if (e.target.value) setStaffIdFilter("");
          }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          title="Filter by staff assignment"
        >
          <option value="">Any Assignment</option>
          <option value="true">Assigned</option>
          <option value="false">Unassigned</option>
        </select>
        <select
          value={staffIdFilter}
          onChange={(e) => {
            setStaffIdFilter(e.target.value);
            if (e.target.value) setAssignedFilter("");
          }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          title="Filter by specific assigned staff"
        >
          <option value="">Any Staff Member</option>
          {staffList.map((staff) => (
            <option key={staff.id} value={staff.id}>{staff.fullName ?? staff.displayName ?? `${staff.firstName} ${staff.lastName}`}</option>
          ))}
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
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
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
      {toolMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{toolMessage}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Client List</h2>
            <p className="text-xs text-gray-500">Visible-row sorting and tools apply to the current page.</p>
          </div>
          <p className="text-xs font-medium text-gray-500">
            Rows {rowStart.toLocaleString()}-{rowEnd.toLocaleString()} of {totalCount.toLocaleString()}
          </p>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400 animate-pulse">Loading clients…</div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No clients found.</p>
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Add your first client</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                  <SortableHeader label="Name" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Phone" sortKey="phone" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Intake Date" sortKey="intakeDate" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Assigned Staff" sortKey="assignedStaff" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Cases" sortKey="cases" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Appointments" sortKey="appointments" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedClients.map((client, index) => (
                  <tr key={client.id} className="hover:bg-blue-50/60 transition-colors">
                    <td className={`px-3 text-xs font-mono text-gray-400 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {((page - 1) * pageSize) + index + 1}
                    </td>
                    <td className={`px-3 ${density === "compact" ? "py-2" : "py-3"}`}>
                      <Link href={`/compassion/clients/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {client.firstName} {client.lastName}
                      </Link>
                      {client.preferredName && (
                        <span className="text-xs text-gray-400 ml-1">({client.preferredName})</span>
                      )}
                    </td>
                    <td className={`px-3 ${density === "compact" ? "py-2" : "py-3"}`}>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(client.clientStatus)}`}>
                        {client.clientStatus.charAt(0) + client.clientStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {client.phone ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {client.email ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {fmtDate(client.intakeDate)}
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {client.assignedStaff ? staffName(client) : <span className="text-gray-300">Unassigned</span>}
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {client._count?.cases ?? 0}
                    </td>
                    <td className={`px-3 text-gray-600 ${density === "compact" ? "py-2" : "py-3"}`}>
                      {client._count?.appointments ?? 0}
                    </td>
                    <td className={`px-3 ${density === "compact" ? "py-2" : "py-3"}`}>
                      <Link
                        href={`/compassion/clients/${client.id}`}
                        className="inline-flex items-center rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Open Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total count */}
      {!loading && clients.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-2 pb-6">
          <p className="text-center text-xs text-gray-400">
            Showing page {page} of {totalPages} · {clients.length} clients in this view · {totalCount.toLocaleString()} total matches
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <label className="text-xs text-gray-500">Rows</label>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) as ClientPageSize)}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
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
