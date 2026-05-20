"use client";

import { useState, useEffect } from "react";
import ConstituentTable from "@/app/components/constituents/ConstituentTable";
import {
  ConstituentRow,
  CONSTITUENT_TYPES,
  DONOR_STATUSES,
  typeLabel,
} from "@/app/components/constituents/constituent-utils";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import FirstRunCard from "@/app/components/ui/FirstRunCard";
import CRMDataTable from "@/app/components/ui/crm/CRMDataTable";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";
import { apiFetch } from "@/app/lib/auth-client";

type ConstituentsPageResponse = {
  items: ConstituentRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: {
    total: number;
    active: number;
    lapsed: number;
    prospects: number;
  };
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

export default function ConstituentsPage() {
  const [constituents, setConstituents] = useState<ConstituentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<ConstituentsPageResponse["summary"]>(undefined);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const data = await apiFetch<ConstituentsPageResponse | ConstituentRow[]>(`/api/constituents?${params}`);

        if (Array.isArray(data)) {
          setConstituents(data);
          setTotal(data.length);
          setTotalPages(data.length > 0 ? 1 : 0);
          setSummary({
            total: data.length,
            active: data.filter((c) => c.donorStatus === "ACTIVE" || c.donorStatus === "MAJOR_DONOR").length,
            lapsed: data.filter((c) => c.donorStatus === "LAPSED").length,
            prospects: data.filter((c) => c.type === "PROSPECT").length,
          });
          return;
        }

        setConstituents(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
        setSummary(data.summary);

        if ((data.totalPages ?? 0) > 0 && page > (data.totalPages ?? 0)) {
          setPage(data.totalPages);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, typeFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, pageSize]);

  const stats = {
    total: summary?.total ?? total,
    active: summary?.active ?? constituents.filter((c) => c.donorStatus === "ACTIVE" || c.donorStatus === "MAJOR_DONOR").length,
    lapsed: summary?.lapsed ?? constituents.filter((c) => c.donorStatus === "LAPSED").length,
    prospects: summary?.prospects ?? constituents.filter((c) => c.type === "PROSPECT").length,
  };

  async function handleDelete(id: string) {
    if (!confirm("Delete this constituent? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/constituents/${id}`, { method: "DELETE" });
      setConstituents((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch {
      alert("Failed to delete constituent. Please try again.");
    }
  }

  const hasFilters = Boolean(search || typeFilter || statusFilter);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <EnterprisePageShell
      ribbon={(
        <div className="space-y-3">
          <WorkspaceBreadcrumbBar
            items={[
              { label: "Donor CRM", href: "/" },
              { label: "Constituents" },
            ]}
            statusLabel={loading ? "Loading" : "Working"}
            metadata={`${loading ? "Loading records" : `${stats.total.toLocaleString()} total · ${stats.active.toLocaleString()} active donors · ${stats.prospects.toLocaleString()} prospects`}`}
            primaryAction={<WorkspaceRibbonButton label="Add Constituent" href="/constituents/new" variant="primary" />}
          />
        </div>
      )}
    >
      <div className="space-y-5">
      <FirstRunCard
        storageKey="howto:constituents"
        title="Getting started with Constituents"
        steps={["Search or filter the list to find a person", "Click a name to open their full profile", "Use Add Constituent to create a new record", "Record a gift directly from the profile page"]}
      />
      <CRMActionBar>
        <WorkspaceRibbonButton label="Add Constituent" href="/constituents/new" variant="primary" />
        <WorkspaceRibbonButton
          label="All Constituents"
          onClick={() => {
            setTypeFilter("");
            setStatusFilter("");
            setPage(1);
          }}
          variant={!typeFilter && !statusFilter ? "primary" : "secondary"}
        />
        <WorkspaceRibbonButton
          label="Active Donors"
          onClick={() => {
            setTypeFilter("");
            setStatusFilter("ACTIVE");
            setPage(1);
          }}
          variant={statusFilter === "ACTIVE" ? "primary" : "secondary"}
        />
        <WorkspaceRibbonButton
          label="Prospects"
          onClick={() => {
            setTypeFilter("PROSPECT");
            setStatusFilter("");
            setPage(1);
          }}
          variant={typeFilter === "PROSPECT" ? "primary" : "secondary"}
        />
        <WorkspaceRibbonButton label="Clear Filters" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }} disabled={!search && !typeFilter && !statusFilter} />
      </CRMActionBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CRMMetricCard label="Total Constituents" value={loading ? "—" : stats.total.toLocaleString()} tone="green" icon={<PeopleIcon />} helper="All constituent records" />
        <CRMMetricCard label="Active Donors" value={loading ? "—" : stats.active.toLocaleString()} tone="blue" icon={<PersonIcon />} helper="Currently engaged donors" />
        <CRMMetricCard label="Lapsed" value={loading ? "—" : stats.lapsed.toLocaleString()} tone="orange" icon={<ClockIcon />} helper="Needs reactivation" />
        <CRMMetricCard label="Prospects" value={loading ? "—" : stats.prospects.toLocaleString()} tone="purple" icon={<FlagIcon />} helper="Potential supporters" />
      </div>

      <CRMFilterBar>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_170px_auto] lg:items-center">
        <input
          type="search"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Types</option>
          {CONSTITUENT_TYPES.map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Statuses</option>
          {DONOR_STATUSES.map((s) => (
            <option key={s} value={s}>{s === "MAJOR_DONOR" ? "Major Donor" : s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number.parseInt(e.target.value, 10) || 100);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
        </div>
      </CRMFilterBar>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      <CRMDataTable>
        <ConstituentTable constituents={constituents} loading={loading && !error} onDelete={handleDelete} />
      </CRMDataTable>

      {!loading && !error && total > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-gray-900">{rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()}</span> of <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>
            {hasFilters ? <CRMStatusBadge tone="green" className="ml-2">Filtered</CRMStatusBadge> : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page.toLocaleString()} of {Math.max(totalPages, 1).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading || (totalPages > 0 && page >= totalPages)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>
    </EnterprisePageShell>
  );
}

function PeopleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 5 2 5H5" />
    </svg>
  );
}
