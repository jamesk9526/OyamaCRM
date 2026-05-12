// Live people directory for OyamaHRM with real assignable and schedulable profile flags.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHrmPeople } from "@/app/lib/hrm/api";
import type { HrmPeopleResponse, HrmPersonRecord } from "@/app/lib/hrm/types";

/** Converts underscore-separated values into human-friendly labels. */
function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

/** HrmPeoplePage renders the HRM people directory from persisted backend records. */
export default function HrmPeoplePage() {
  const [response, setResponse] = useState<HrmPeopleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  /** Loads people rows from the API using server-side search/status/type filters. */
  const loadPeople = useCallback(async (params: { search: string; status: string; type: string }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHrmPeople({
        search: params.search,
        status: params.status === "all" ? undefined : params.status,
        type: params.type === "all" ? undefined : params.type,
      });
      setResponse(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load HRM people directory.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadPeople({ search, status: statusFilter, type: typeFilter });
    }, 250);

    return () => clearTimeout(handle);
  }, [loadPeople, search, statusFilter, typeFilter]);

  const items = response?.items ?? [];

  const locationOptions = useMemo(() => {
    return [...new Set(items.map((item) => item.locationName).filter((name): name is string => Boolean(name && name.trim())))].sort((a, b) =>
      a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    if (locationFilter === "all") return items;
    return items.filter((person) => person.locationName === locationFilter);
  }, [items, locationFilter]);

  const visibleTotals = useMemo(() => {
    return {
      total: visibleItems.length,
      active: visibleItems.filter((person) => person.status === "active").length,
      assignable: visibleItems.filter((person) => person.assignableToClients).length,
      schedulable: visibleItems.filter((person) => person.schedulable).length,
    };
  }, [visibleItems]);

  /** Builds one status badge style class for a person row. */
  function statusClass(person: HrmPersonRecord): string {
    if (person.status === "active") return "bg-teal-100 text-teal-700";
    if (person.status === "on_leave") return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">People Directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">People, Staff, And Board Management</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          Real-time directory driven by platform users and Compassion staff records, including assignable and scheduling flags used by downstream workflows.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Profiles</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : visibleTotals.total}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">{loading ? "..." : visibleTotals.active}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Assignable To Clients</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-700">{loading ? "..." : visibleTotals.assignable}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Schedulable</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">{loading ? "..." : visibleTotals.schedulable}</p>
        </article>
      </section>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search by name, email, title, location, or role"
            className="flex-1 min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All person types</option>
            <option value="staff">Staff</option>
            <option value="employee">Employee</option>
            <option value="volunteer">Volunteer</option>
            <option value="board_member">Board Member</option>
          </select>
          <select
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <option value="all">All locations</option>
            {locationOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <Link
            href="/compassion/settings/staff"
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
          >
            Manage Staff Profiles
          </Link>
        </div>
      </article>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">HRM People Records</h2>
          <p className="text-xs text-gray-500">Showing {visibleItems.length} of {response?.totals.total ?? 0}</p>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Loading people records...</p>
        ) : visibleItems.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No people records match these filters.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Person</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Role / Title</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Assignable</th>
                <th className="py-2 pr-3">Schedulable</th>
                <th className="py-2">Linked User</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((person) => (
                <tr key={person.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-900">{person.fullName}</p>
                    {person.email ? <p className="text-xs text-gray-500">{person.email}</p> : null}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{humanize(person.personType)}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    <p>{person.title || person.role || "Role not set"}</p>
                    {person.role ? <p className="text-xs text-gray-500">User role: {person.role}</p> : null}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{person.locationName || "Location not set"}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(person)}`}>
                      {humanize(person.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{person.assignableToClients ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 text-gray-600">{person.schedulable ? "Yes" : "No"}</td>
                  <td className="py-2 text-gray-600">{person.linkedUserEmail || "No linked user"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
