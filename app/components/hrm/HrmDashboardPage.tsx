// OyamaHRM dashboard view backed by persisted API data.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchHrmDashboard } from "@/app/lib/hrm/api";
import type { HrmDashboardResponse } from "@/app/lib/hrm/types";

/** Formats one ISO timestamp into readable local date and time text. */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** HrmDashboardPage renders the live HRM operations dashboard from persisted backend data. */
export default function HrmDashboardPage() {
  const [data, setData] = useState<HrmDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads dashboard metrics and widget datasets from the HRM API. */
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchHrmDashboard();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load HRM dashboard data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = data?.metrics;

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">OyamaHRM</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Internal People And Scheduling Hub</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-3xl">
              Live internal operations snapshot across people coverage, scheduling load, location readiness, and internal announcements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/hrm/people" className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
            Manage People
          </Link>
          <Link href="/hrm/scheduling" className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
            Open Scheduling
          </Link>
          <Link href="/hrm/messages" className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
            Internal Messages
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Active Staff</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.activeStaff ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Internal users currently active in HRM scope</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Board Members</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.boardMembers ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Users mapped as board-view roles</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Locations</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.locations ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Persisted HRM location records</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">People Scheduled Today</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.peopleScheduledToday ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Unique people with assignments today</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Unread Internal Messages</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.openInternalMessages ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Unread inbox and announcement messages</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Profile Completion Needed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : metrics?.profileCompletionNeeded ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Profiles missing title or contact fields</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Today's Staff Schedule</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading schedule...</p>
            ) : (data?.todaySchedule.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No scheduled assignments were found for today.</p>
            ) : (
              data?.todaySchedule.map((item) => (
                <div key={`${item.source}-${item.id}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{item.personName}</p>
                  <p className="text-xs text-gray-600">{item.title} • {item.source}</p>
                  <p className="text-xs text-teal-700 mt-0.5">{formatDateTime(item.startTime)}{item.endTime ? ` - ${formatDateTime(item.endTime)}` : ""}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.location || "Location not set"}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Location Status</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading locations...</p>
            ) : (data?.locationStatus.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">No HRM locations are configured yet.</p>
            ) : (
              data?.locationStatus.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">{item.location}</p>
                  <p className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${item.status === "Inactive" ? "text-gray-500" : "text-teal-700"}`}>
                    {item.status}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.coverage}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Internal Announcements</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {loading ? (
            <p className="text-sm text-gray-500">Loading announcements...</p>
          ) : (data?.announcements.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">No announcements have been posted yet.</p>
          ) : (
            data?.announcements.map((announcement) => (
              <div key={announcement.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{announcement.priority}</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{announcement.title}</p>
                <p className="text-xs text-gray-600 mt-1">{announcement.body}</p>
                <p className="text-[11px] text-gray-500 mt-2">{announcement.senderName} • {formatDateTime(announcement.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
