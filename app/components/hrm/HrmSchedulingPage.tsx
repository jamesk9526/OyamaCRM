// Scheduling and availability workspace powered by persisted HRM schedule data.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHrmScheduling } from "@/app/lib/hrm/api";
import type { HrmScheduleItem, HrmSchedulingResponse } from "@/app/lib/hrm/types";

/** Returns one local datetime label from an ISO string. */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** Returns one default YYYY-MM-DD value for today's date. */
function defaultDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** HrmSchedulingPage renders real assignment, conflict, and staff availability views. */
export default function HrmSchedulingPage() {
  const [selectedDate, setSelectedDate] = useState(defaultDay());
  const [data, setData] = useState<HrmSchedulingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads scheduling data for one selected day window. */
  const loadScheduling = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchHrmScheduling(day);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load scheduling data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScheduling(selectedDate);
  }, [loadScheduling, selectedDate]);

  /** Renders one assignment card from a schedule item. */
  function AssignmentCard({ item }: { item: HrmScheduleItem }) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="text-sm font-semibold text-slate-900">{item.personName}</p>
        <p className="text-xs text-gray-600 mt-0.5">{item.title} • {item.source}</p>
        <p className="text-xs text-teal-700 mt-1">{formatDateTime(item.startTime)}{item.endTime ? ` - ${formatDateTime(item.endTime)}` : ""}</p>
        <p className="text-xs text-gray-600 mt-1">{item.location || "Location not set"}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.status}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Scheduling</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Staff Availability And Exceptions</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-3xl">
              Unified assignment timeline across meetings and Compassion appointments with conflict detection for shared staffing operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
            />
            <button
              type="button"
              onClick={() => void loadScheduling(selectedDate)}
              className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Selected Day Assignments</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : data?.todayItems.length ?? 0}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Upcoming 7-Day Assignments</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-700">{loading ? "..." : data?.upcomingItems.length ?? 0}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Conflict Alerts</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{loading ? "..." : data?.conflicts.length ?? 0}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Schedulable Staff</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-700">
            {loading ? "..." : data?.staffAvailability.filter((staff) => staff.supportsScheduling).length ?? 0}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Selected Day Assignments</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading assignments...</p>
            ) : (data?.todayItems.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No assignments found for this date.</p>
            ) : (
              data?.todayItems.map((item) => <AssignmentCard key={`today-${item.source}-${item.id}`} item={item} />)
            )}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Conflict Alerts (7 Days)</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading conflict detection...</p>
            ) : (data?.conflicts.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No overlap conflicts detected in the next seven days.</p>
            ) : (
              data?.conflicts.map((conflict, index) => (
                <div key={`${conflict.personKey}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{conflict.personName}</p>
                  <p className="text-xs text-amber-800 mt-1">{conflict.first.title} overlaps with {conflict.second.title}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatDateTime(conflict.first.startTime)} - {formatDateTime(conflict.first.endTime || conflict.first.startTime)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatDateTime(conflict.second.startTime)} - {formatDateTime(conflict.second.endTime || conflict.second.startTime)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming Assignments (7 Days)</h2>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
            {loading ? (
              <p className="text-sm text-gray-500">Loading upcoming schedule...</p>
            ) : (data?.upcomingItems.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No upcoming assignments in this window.</p>
            ) : (
              data?.upcomingItems.map((item) => <AssignmentCard key={`upcoming-${item.source}-${item.id}`} item={item} />)
            )}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Staff Availability Directory</h2>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
            {loading ? (
              <p className="text-sm text-gray-500">Loading staff availability...</p>
            ) : (data?.staffAvailability.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No active Compassion staff profiles were found.</p>
            ) : (
              data?.staffAvailability.map((staff) => (
                <div key={staff.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{staff.fullName}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{staff.title || "Title not set"}</p>
                  <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${staff.supportsScheduling ? "text-teal-700" : "text-gray-500"}`}>
                    {staff.supportsScheduling ? "Available for scheduling" : "Not schedulable"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
