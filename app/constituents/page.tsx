"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import ConstituentTable from "@/app/components/constituents/ConstituentTable";
import {
  ConstituentRow,
  CONSTITUENT_TYPES,
  DONOR_STATUSES,
  typeLabel,
} from "@/app/components/constituents/constituent-utils";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => constituents.some((row) => row.id === id)));
  }, [constituents]);

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
  const filteredCountLabel = `${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`;

  return (
    <EnterprisePageShell
      ribbon={(
        <CRMActionBar
          context={{
            selectionCount: selectedIds.length,
            flags: {
              hasFilters,
            },
          }}
          commandHandlers={{
            "view-all-constituents": () => {
              setTypeFilter("");
              setStatusFilter("");
              setPage(1);
            },
            "view-active-donors": () => {
              setTypeFilter("");
              setStatusFilter("ACTIVE");
              setPage(1);
            },
            "view-prospects": () => {
              setTypeFilter("PROSPECT");
              setStatusFilter("");
              setPage(1);
            },
            "clear-filters": () => {
              setSearch("");
              setTypeFilter("");
              setStatusFilter("");
              setPage(1);
            },
            "advanced-filter": () => {
              const filterInput = document.querySelector<HTMLInputElement>('input[type="search"]');
              filterInput?.focus();
            },
          }}
        />
      )}
    >
      <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f7fbf8_0%,#ffffff_58%,#eef6f2_100%)] shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] lg:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Constituent Directory
              </span>
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Compact table view"}
              </span>
            </div>
            <div>
              <h1 className="text-[30px] font-semibold tracking-tight text-slate-950 sm:text-[34px]">Constituents</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                One organized donor directory for portfolio review, segmentation, and fast record cleanup.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/constituents/new" className="inline-flex h-9 items-center rounded-lg bg-emerald-700 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
                Add Constituent
              </Link>
              <Link href="/data-tools/import" className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Import Donors
              </Link>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <CompactConstituentTile label="Records In View" value={loading ? "—" : stats.total.toLocaleString()} detail={hasFilters ? "Filtered directory scope" : "Current directory scope"} />
            <CompactConstituentTile label="Active Donors" value={loading ? "—" : stats.active.toLocaleString()} detail="Currently engaged supporters" tone="green" />
            <CompactConstituentTile label="Prospects + Lapsed" value={loading ? "—" : `${stats.prospects + stats.lapsed}`} detail="Reactivation and cultivation focus" tone="blue" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <CRMMetricCard label="Total Constituents" value={loading ? "—" : stats.total.toLocaleString()} tone="green" icon={<PeopleIcon />} helper="All constituent records" />
        <CRMMetricCard label="Active Donors" value={loading ? "—" : stats.active.toLocaleString()} tone="blue" icon={<PersonIcon />} helper="Currently engaged donors" />
        <CRMMetricCard label="Lapsed" value={loading ? "—" : stats.lapsed.toLocaleString()} tone="orange" icon={<ClockIcon />} helper="Needs reactivation" />
        <CRMMetricCard label="Prospects" value={loading ? "—" : stats.prospects.toLocaleString()} tone="purple" icon={<FlagIcon />} helper="Potential supporters" />
      </div>

      <CRMFilterBar>
        <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Directory Filters</p>
            <p className="text-xs text-slate-500">Narrow the directory, then use the table for quick edits and donor review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
              Showing {filteredCountLabel}
            </span>
            {hasFilters ? (
              <button
                onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPage(1); }}
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_170px] lg:items-center">
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
        </div>
        </div>
      </CRMFilterBar>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Selected Constituent Scope</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">{selectedIds.length} constituent{selectedIds.length === 1 ? "" : "s"} selected</p>
            <p className="text-xs text-emerald-800">Use the donor ribbon commands for the selected records, or clear this scope before changing filters.</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Clear Selection
          </button>
        </div>
      ) : null}

      <CRMDataTable>
        <ConstituentTable
          constituents={constituents}
          loading={loading && !error}
          onDelete={handleDelete}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </CRMDataTable>

      {!loading && !error && total > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between">
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

function CompactConstituentTile({
  label,
  value,
  detail,
  tone = "emerald",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "emerald" | "green" | "blue";
}) {
  const toneClass = tone === "blue"
    ? "border-blue-200 bg-blue-50/80 text-blue-950"
    : tone === "green"
      ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
      : "border-emerald-200 bg-white/85 text-slate-950";

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
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
