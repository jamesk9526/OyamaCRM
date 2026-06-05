"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";

interface EnrollmentRecord {
  id: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  startedAt: string;
  updatedAt: string;
  nextStepDueAt?: string | null;
  path: { id: string; name: string; status: string; crmScope: string };
  currentStep?: { id: string; name: string; stepType: string; orderIndex: number } | null;
  ownerUser?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  constituent?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null;
}

interface PathOption {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  targetType: string;
  crmScope: string;
}

interface ConstituentSearchResult {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  donorStatus?: string | null;
}

type EnrollmentFilter = "all" | EnrollmentRecord["status"];

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeout);
  }, [value, ms]);
  return debounced;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusClass(status: EnrollmentRecord["status"]): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "PAUSED") return "bg-amber-100 text-amber-800";
  if (status === "COMPLETED") return "bg-blue-100 text-blue-800";
  if (status === "FAILED") return "bg-rose-100 text-rose-800";
  return "bg-slate-200 text-slate-700";
}

function formatPersonLabel(record: EnrollmentRecord): string {
  const name = getConstituentDisplayName(record.constituent ?? {});
  if (name !== "Unnamed Constituent" && name !== "Unnamed Organization") return name;
  return record.constituent?.email?.trim() || "Unassigned constituent";
}

function formatOwnerLabel(record: EnrollmentRecord): string {
  const first = record.ownerUser?.firstName?.trim() || "";
  const last = record.ownerUser?.lastName?.trim() || "";
  const name = `${first} ${last}`.trim();
  if (name) return name;
  return record.ownerUser?.email?.trim() || "-";
}

function formatConstituentLabel(row: ConstituentSearchResult): string {
  const name = getConstituentDisplayName(row);
  if (name !== "Unnamed Constituent" && name !== "Unnamed Organization") return name;
  return row.email?.trim() || row.id;
}

export default function StewardPathsEnrollmentsPage() {
  const searchParams = useSearchParams();
  const scopedPathId = searchParams.get("pathId")?.trim() || null;

  const [rows, setRows] = useState<EnrollmentRecord[]>([]);
  const [paths, setPaths] = useState<PathOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EnrollmentFilter>("all");
  const [enrollPathId, setEnrollPathId] = useState(scopedPathId ?? "");
  const [enrollQuery, setEnrollQuery] = useState("");
  const [selectedConstituent, setSelectedConstituent] = useState<ConstituentSearchResult | null>(null);
  const [constituentOptions, setConstituentOptions] = useState<ConstituentSearchResult[]>([]);
  const [constituentLoading, setConstituentLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const debouncedEnrollQuery = useDebounce(enrollQuery, 220);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [enrollmentData, pathData] = await Promise.all([
        apiFetch<EnrollmentRecord[]>("/api/steward-paths/enrollments?limit=250"),
        apiFetch<PathOption[]>("/api/steward-paths/templates?limit=300").catch(() => []),
      ]);
      setRows(Array.isArray(enrollmentData) ? enrollmentData : []);
      const normalizedPaths = (Array.isArray(pathData) ? pathData : []).filter((path) => path.status !== "ARCHIVED");
      setPaths(normalizedPaths);

      if (scopedPathId) {
        setEnrollPathId(scopedPathId);
      } else {
        setEnrollPathId((current) => {
          if (current && normalizedPaths.some((path) => path.id === current)) return current;
          return normalizedPaths[0]?.id ?? "";
        });
      }
    } catch (loadError) {
      setRows([]);
      setPaths([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load enrollments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!debouncedEnrollQuery.trim()) {
      setConstituentOptions([]);
      setConstituentLoading(false);
      return;
    }

    if (selectedConstituent && formatConstituentLabel(selectedConstituent) === debouncedEnrollQuery.trim()) {
      return;
    }

    let cancelled = false;
    setConstituentLoading(true);
    void apiFetch<ConstituentSearchResult[]>(`/api/constituents?search=${encodeURIComponent(debouncedEnrollQuery.trim())}&limit=8`)
      .then((data) => {
        if (cancelled) return;
        setConstituentOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setConstituentOptions([]);
      })
      .finally(() => {
        if (!cancelled) setConstituentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedEnrollQuery, selectedConstituent]);

  const scopedRows = useMemo(
    () => (scopedPathId ? rows.filter((row) => row.path.id === scopedPathId) : rows),
    [rows, scopedPathId],
  );

  const scopedPathName = useMemo(
    () => (scopedPathId ? scopedRows[0]?.path.name ?? null : null),
    [scopedPathId, scopedRows],
  );

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === enrollPathId) ?? null,
    [enrollPathId, paths],
  );

  const canEnroll = Boolean(selectedPath && selectedConstituent && !enrolling);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scopedRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return row.path.name.toLowerCase().includes(needle)
        || formatPersonLabel(row).toLowerCase().includes(needle)
        || (row.currentStep?.name ?? "").toLowerCase().includes(needle);
    });
  }, [scopedRows, search, statusFilter]);

  async function patchStatus(row: EnrollmentRecord, status: EnrollmentRecord["status"]): Promise<void> {
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/enrollments/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Enrollment updated to ${status}.`);
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update enrollment status.");
    } finally {
      setBusyId(null);
    }
  }

  async function completeManualStep(row: EnrollmentRecord): Promise<void> {
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/enrollments/${row.id}/complete-current-step`, {
        method: "POST",
        body: JSON.stringify({ note: "Completed from Enrollments workspace." }),
      });
      setNotice("Manual step completed.");
      await load();
    } catch (stepError) {
      setError(stepError instanceof Error ? stepError.message : "Failed to complete current step.");
    } finally {
      setBusyId(null);
    }
  }

  function chooseConstituent(row: ConstituentSearchResult): void {
    setSelectedConstituent(row);
    setEnrollQuery(formatConstituentLabel(row));
    setConstituentOptions([]);
  }

  async function enrollConstituent(): Promise<void> {
    if (!selectedPath || !selectedConstituent) {
      setError("Select both a path and a constituent before enrolling.");
      return;
    }

    setEnrolling(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${selectedPath.id}/enrollments`, {
        method: "POST",
        body: JSON.stringify({
          targetId: selectedConstituent.id,
          targetType: selectedPath.targetType || "CONSTITUENT",
          constituentId: selectedConstituent.id,
        }),
      });

      setNotice(`Enrolled ${formatConstituentLabel(selectedConstituent)} into ${selectedPath.name}.`);
      setSelectedConstituent(null);
      setEnrollQuery("");
      setConstituentOptions([]);
      await load();
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Failed to enroll constituent into path.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1480px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Enrollments</h1>
          <p className="mt-1 text-sm text-slate-600">Monitor active path enrollments, pause or resume workflows, and complete manual-action steps.</p>
          {scopedPathId ? (
            <p className="mt-1 text-xs text-emerald-700">
              Scoped to path: {scopedPathName ?? scopedPathId}
              {" "}
              <Link href="/steward-paths/enrollments" className="font-semibold hover:text-emerald-800">View all enrollments</Link>
            </p>
          ) : null}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Add Person To Path</h2>
              <p className="mt-0.5 text-xs text-slate-600">Enroll a constituent into an eligible Steward Path from this workspace.</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(230px,300px)_minmax(280px,1fr)_160px]">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path</span>
              <select
                value={enrollPathId}
                onChange={(event) => setEnrollPathId(event.target.value)}
                disabled={Boolean(scopedPathId)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {paths.length === 0 ? <option value="">No available paths</option> : null}
                {paths.map((path) => (
                  <option key={path.id} value={path.id}>
                    {path.name} ({path.status})
                  </option>
                ))}
              </select>
            </label>

            <label className="relative space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Constituent</span>
              <input
                type="text"
                value={enrollQuery}
                onChange={(event) => {
                  setEnrollQuery(event.target.value);
                  if (selectedConstituent) setSelectedConstituent(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && constituentOptions[0]) {
                    event.preventDefault();
                    chooseConstituent(constituentOptions[0]);
                  }
                }}
                placeholder="Search constituent by name or email"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />

              {constituentLoading ? (
                <span className="pointer-events-none absolute right-3 top-[36px] inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              ) : null}

              {selectedConstituent ? (
                <p className="text-[11px] text-emerald-700">Selected: {formatConstituentLabel(selectedConstituent)}</p>
              ) : null}

              {constituentOptions.length > 0 && !selectedConstituent ? (
                <div className="absolute left-0 right-0 top-[72px] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {constituentOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseConstituent(option);
                      }}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{formatConstituentLabel(option)}</span>
                      <span className="text-slate-500">{option.email || option.id}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="flex items-end">
              <button
                type="button"
                disabled={!canEnroll}
                onClick={() => void enrollConstituent()}
                className="h-10 w-full rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enrolling ? "Enrolling..." : "Enroll"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1.3fr)_180px_140px]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by constituent, path, or step"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as EnrollmentFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="all">Status: All</option>
              <option value="ACTIVE">Status: Active</option>
              <option value="PAUSED">Status: Paused</option>
              <option value="COMPLETED">Status: Completed</option>
              <option value="FAILED">Status: Failed</option>
              <option value="CANCELLED">Status: Cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading enrollments...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-[220px_190px_120px_180px_150px_260px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Constituent</span>
                  <span>Path</span>
                  <span>Status</span>
                  <span>Current Step</span>
                  <span>Next Due</span>
                  <span>Actions</span>
                </div>

                {visibleRows.map((row) => (
                  <article key={row.id} className="grid grid-cols-[220px_190px_120px_180px_150px_260px] gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                    <div>
                      <p className="font-semibold text-slate-900">{formatPersonLabel(row)}</p>
                      <p className="text-xs text-slate-600">Owner: {formatOwnerLabel(row)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{row.path.name}</p>
                      <p className="text-xs text-slate-600">{row.path.crmScope}</p>
                    </div>
                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                    </div>
                    <div className="text-xs text-slate-700">{row.currentStep?.name ?? "No active step"}</div>
                    <div className="text-xs text-slate-600">{formatDate(row.nextStepDueAt ?? row.updatedAt)}</div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/steward-paths/${encodeURIComponent(row.path.id)}/activity`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Timeline
                      </Link>
                      {row.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchStatus(row, "PAUSED")}
                          className="rounded-md border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Pause
                        </button>
                      ) : null}
                      {row.status === "PAUSED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchStatus(row, "ACTIVE")}
                          className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Resume
                        </button>
                      ) : null}
                      {row.status === "ACTIVE" || row.status === "PAUSED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchStatus(row, "CANCELLED")}
                          className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {row.status === "ACTIVE" && row.currentStep?.stepType === "MANUAL_ACTION" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void completeManualStep(row)}
                          className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Complete Step
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}

                {visibleRows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">
                    {scopedPathId
                      ? "No enrollments matched this path scope and filter set."
                      : "No enrollments matched your filters."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
