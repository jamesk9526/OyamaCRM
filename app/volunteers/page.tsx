/**
 * Volunteers page.
 * Lists constituent records with type=VOLUNTEER from /api/constituents.
 * Features: search, total count, add volunteer link, empty state.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Constituent record (volunteer) as returned from the API */
interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  donorStatus: string;
  tags: Array<{ tagId: string; tag: { name: string; color: string } }>;
}

/** Tailwind classes for donor status badge */
function statusColor(s: string) {
  switch (s) {
    case "ACTIVE": return "bg-green-50 text-green-700";
    case "MAJOR_DONOR": return "bg-amber-50 text-amber-700";
    case "LAPSED": return "bg-red-50 text-red-600";
    case "NEW": return "bg-blue-50 text-blue-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

/** Skeleton row for loading state */
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/** Volunteers page — table of volunteer constituents */
export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ type: "VOLUNTEER", limit: "100" });
        if (search) params.set("search", search);
        const res = await fetch(`${API}/api/constituents?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setVolunteers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-5">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Volunteers" },
        ]}
        statusLabel={loading ? "Loading" : "Working"}
        metadata={loading ? "Loading volunteers" : `${volunteers.length.toLocaleString()} volunteer${volunteers.length !== 1 ? "s" : ""}`}
        primaryAction={<WorkspaceRibbonButton label="Add Volunteer" href="/constituents/new" variant="primary" />}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="Add Volunteer" href="/constituents/new" variant="primary" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="View">
          <WorkspaceRibbonButton label="All Volunteers" onClick={() => setSearch("")} variant={!search ? "primary" : "secondary"} />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Filter">
          <WorkspaceRibbonButton label="Clear Search" onClick={() => setSearch("")} disabled={!search} />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="search"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-sm text-gray-500 hover:text-gray-700 px-2">
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Name", "Email", "Phone", "Status", "Tags"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : volunteers.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                    {search
                      ? `No volunteers matching "${search}". Try a different name.`
                      : "No volunteers found. Add constituent records with type Volunteer to see them here."}
                  </td>
                </tr>
              )
              : volunteers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/constituents/${v.id}`} className="hover:text-green-600 transition-colors">
                        {v.firstName} {v.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.email ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{v.phone ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(v.donorStatus)}`}>
                        {v.donorStatus === "MAJOR_DONOR" ? "Major Donor" : v.donorStatus.charAt(0) + v.donorStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.tags.slice(0, 3).map((t) => (
                          <span key={t.tagId} className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: t.tag.color }}>{t.tag.name}</span>
                        ))}
                        {v.tags.length > 3 && <span className="text-xs text-gray-400">+{v.tags.length - 3}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
