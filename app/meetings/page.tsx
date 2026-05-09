/**
 * Meetings page — schedule, view, filter, and manage donor meetings.
 * Wired to /api/meetings for real data.
 * Shows stat cards (upcoming, today, needs follow-up) + sortable meeting list.
 * Staff can schedule a new meeting via the "Schedule Meeting" modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import ScheduleMeetingModal from "@/app/components/meetings/ScheduleMeetingModal";
import MeetingCard from "@/app/components/meetings/MeetingCard";

/** Meeting shape as returned from the API */
export interface Meeting {
  id: string;
  title: string;
  type: string;
  status: string;
  startTime: string;
  endTime?: string;
  locationType: string;
  location?: string;
  purpose?: string;
  notes?: string;
  outcome?: string;
  followUpNeeded: boolean;
  constituent?: { id: string; firstName: string; lastName: string; email?: string };
  assignedStaff?: { id: string; firstName: string; lastName: string };
}

const STATUS_OPTIONS = ["", "SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW", "NEEDS_FOLLOW_UP"];
const STATUS_LABELS: Record<string, string> = {
  "": "All Statuses",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  NO_SHOW: "No-Show",
  NEEDS_FOLLOW_UP: "Needs Follow-Up",
};
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELED: "bg-gray-100 text-gray-500",
  NO_SHOW: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-yellow-100 text-yellow-700",
  NEEDS_FOLLOW_UP: "bg-orange-100 text-orange-700",
};
export { STATUS_COLORS, STATUS_LABELS };

/** Meetings list page */
export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [total, setTotal] = useState(0);

  // Summary counts for stat cards
  const [todayCount, setTodayCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);

  /** Load meetings from the real API */
  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<{ items?: Meeting[]; total?: number }>(`/api/meetings?${params}`);
      const items: Meeting[] = data.items ?? [];
      setMeetings(items);
      setTotal(data.total ?? items.length);

      // Compute quick stats from the loaded set
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      setTodayCount(items.filter(m => m.status === "SCHEDULED" && new Date(m.startTime) >= todayStart && new Date(m.startTime) < tomorrowStart).length);
      setUpcomingCount(items.filter(m => m.status === "SCHEDULED" && new Date(m.startTime) >= now).length);
      setFollowUpCount(items.filter(m => m.followUpNeeded && m.status !== "CANCELED").length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  /** Mark a meeting as completed */
  async function handleComplete(id: string, outcome?: string) {
    await apiFetch(`/api/meetings/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
    loadMeetings();
  }

  /** Cancel a meeting */
  async function handleCancel(id: string) {
    await apiFetch(`/api/meetings/${id}/cancel`, { method: "POST" });
    loadMeetings();
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Schedule and manage donor visits, phone calls, and follow-ups.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Meeting
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today's Meetings" value={todayCount} color="blue" />
        <StatCard label="Upcoming" value={upcomingCount} color="green" />
        <StatCard label="Needs Follow-Up" value={followUpCount} color="orange" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="text-sm text-gray-500 font-medium">Filter by:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-gray-400">{total} meeting{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Meeting list */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={loadMeetings} />
      ) : meetings.length === 0 ? (
        <EmptyState onSchedule={() => setShowModal(true)} />
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Schedule Meeting modal */}
      {showModal && (
        <ScheduleMeetingModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadMeetings(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Small stat card for the page header summary */
function StatCard({ label, value, color }: { label: string; value: number; color: "blue" | "green" | "orange" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 0116 0" />
      </svg>
      Loading meetings…
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p className="text-red-700 font-medium">Failed to load meetings</p>
      <p className="text-red-500 text-sm mt-1">{message}</p>
      <button onClick={onRetry} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
        Retry
      </button>
    </div>
  );
}

/** Empty state when no meetings exist */
function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-8 py-16 text-center">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-gray-900 font-semibold">No meetings yet</h3>
      <p className="text-gray-500 text-sm mt-1 mb-4">Schedule your first donor meeting to get started.</p>
      <button
        onClick={onSchedule}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
      >
        Schedule Meeting
      </button>
    </div>
  );
}
