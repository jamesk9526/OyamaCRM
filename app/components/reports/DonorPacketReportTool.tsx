/** Per-donor report packet view for OShareview donor reporting. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface DonorListRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  donorStatus: string;
  totalLifetimeGiving: number | string;
  lastGiftDate?: string | null;
}

interface DonorPacket {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  type: string;
  donorStatus: string;
  notes?: string | null;
  totalLifetimeGiving: number | string;
  totalYtdGiving: number | string;
  giftCount: number;
  lastGiftDate?: string | null;
  lastGiftAmount?: number | string | null;
  firstGiftDate?: string | null;
  engagementScore: number;
  tags: Array<{ tagId: string; tag: { name: string; color: string } }>;
  donations: Array<{
    id: string;
    amount: number | string;
    date: string;
    paymentMethod: string;
    status: string;
    campaign?: { name?: string | null } | null;
    designation?: { name?: string | null } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user?: { firstName?: string | null; lastName?: string | null } | null;
  }>;
}

function fmtCurrency(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "0";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadgeClass(status: string): string {
  const normalized = (status || "").toUpperCase();
  if (normalized === "ACTIVE") return "bg-green-50 text-green-700 border-green-200";
  if (normalized === "NEW") return "bg-blue-50 text-blue-700 border-blue-200";
  if (normalized === "LAPSED") return "bg-amber-50 text-amber-700 border-amber-200";
  if (normalized === "MAJOR_DONOR") return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

/** Provides donor search + one-click packet rendering from existing constituent profile APIs. */
export default function DonorPacketReportTool() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DonorListRow[]>([]);
  const [starterRows, setStarterRows] = useState<DonorListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const [packet, setPacket] = useState<DonorPacket | null>(null);
  const [loadingPacket, setLoadingPacket] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<DonorListRow[]>("/api/constituents?limit=20");
        const safeRows = Array.isArray(rows) ? rows : [];
        setStarterRows(safeRows);
        setResults(safeRows);
      } catch {
        setStarterRows([]);
      }
    })();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(starterRows);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        setError(null);
        try {
          const rows = await apiFetch<DonorListRow[]>(`/api/constituents?search=${encodeURIComponent(trimmed)}&limit=20`);
          setResults(Array.isArray(rows) ? rows : []);
        } catch (fetchError) {
          setResults([]);
          setError(fetchError instanceof Error ? fetchError.message : "Failed to search donors.");
        } finally {
          setSearching(false);
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, starterRows]);

  useEffect(() => {
    if (!selectedId) {
      setPacket(null);
      return;
    }

    void (async () => {
      setLoadingPacket(true);
      setError(null);
      try {
        const data = await apiFetch<DonorPacket>(`/api/constituents/${selectedId}`);
        setPacket(data);
      } catch (fetchError) {
        setPacket(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load donor packet.");
      } finally {
        setLoadingPacket(false);
      }
    })();
  }, [selectedId]);

  const selectedSummary = useMemo(
    () => results.find((row) => row.id === selectedId) ?? null,
    [results, selectedId],
  );

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Per Donor Report Packet</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Search for a constituent and generate a single-view donor history packet.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_260px] lg:max-w-3xl">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search donor by name, email, or phone"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select donor packet</option>
              {results.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.firstName} {row.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {searching && <p className="mt-2 text-xs text-gray-500">Searching donors...</p>}
        {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
          <p className="mt-2 text-xs text-gray-500">No donor matches found.</p>
        )}
        {selectedSummary && (
          <p className="mt-2 text-xs text-gray-500">
            Selected: {selectedSummary.firstName} {selectedSummary.lastName}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {loadingPacket && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading donor packet...
        </div>
      )}

      {!loadingPacket && packet && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {packet.firstName} {packet.lastName}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Donor type: {packet.type.replace(/_/g, " ")} | Engagement score: {packet.engagementScore}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(packet.donorStatus)}`}>
                  {packet.donorStatus.replace(/_/g, " ")}
                </span>
                <Link
                  href={`/constituents/${packet.id}`}
                  className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  Open Full Profile
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Lifetime Giving</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">${fmtCurrency(packet.totalLifetimeGiving)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">YTD Giving</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">${fmtCurrency(packet.totalYtdGiving)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Gift Count</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{packet.giftCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Last Gift</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{fmtDate(packet.lastGiftDate)}</p>
                <p className="text-xs text-gray-500">${fmtCurrency(packet.lastGiftAmount)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-900">Constituent Info</h4>
              <div className="mt-3 space-y-1.5 text-sm text-gray-700">
                <p>Email: {packet.email || "-"}</p>
                <p>Phone: {packet.phone || packet.mobile || "-"}</p>
                <p>
                  Address: {packet.addressLine1 || "-"}
                  {packet.addressLine2 ? `, ${packet.addressLine2}` : ""}
                </p>
                <p>
                  Location: {[packet.city, packet.state, packet.zip].filter(Boolean).join(", ") || "-"}
                </p>
                <p>Country: {packet.country || "-"}</p>
                <p>First Gift: {fmtDate(packet.firstGiftDate)}</p>
              </div>

              {packet.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {packet.tags.map((tag) => (
                    <span
                      key={tag.tagId}
                      className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{ borderColor: tag.tag.color || "#d1d5db", color: tag.tag.color || "#374151" }}
                    >
                      {tag.tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-900">Recent Timeline</h4>
              {packet.activities.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No timeline activity yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {packet.activities.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-sm text-gray-800">{activity.description}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {fmtDate(activity.createdAt)} | {activity.type.replace(/_/g, " ")}
                        {activity.user ? ` | ${activity.user.firstName || ""} ${activity.user.lastName || ""}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-gray-900">Donation History</h4>
            {packet.donations.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No donations recorded.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Method</th>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Campaign</th>
                      <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Designation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packet.donations.slice(0, 20).map((donation) => (
                      <tr key={donation.id} className="border-b border-gray-100">
                        <td className="px-2.5 py-2 text-gray-700">{fmtDate(donation.date)}</td>
                        <td className="px-2.5 py-2 font-medium text-gray-900">${fmtCurrency(donation.amount)}</td>
                        <td className="px-2.5 py-2 text-gray-700">{donation.status.replace(/_/g, " ")}</td>
                        <td className="px-2.5 py-2 text-gray-700">{donation.paymentMethod.replace(/_/g, " ")}</td>
                        <td className="px-2.5 py-2 text-gray-700">{donation.campaign?.name || "-"}</td>
                        <td className="px-2.5 py-2 text-gray-700">{donation.designation?.name || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-gray-900">Open Tasks and Follow-ups</h4>
            {packet.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No tasks assigned.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {packet.tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {task.status} | Priority: {task.priority}
                      {task.dueDate ? ` | Due: ${fmtDate(task.dueDate)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
