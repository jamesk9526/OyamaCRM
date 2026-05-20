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
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import CRMEmptyState from "@/app/components/ui/crm/CRMEmptyState";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";
import { STATUS_LABELS } from "@/app/components/meetings/meeting-status";

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
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Meetings" },
        ]}
        statusLabel={loading ? "Loading" : "Working"}
        metadata={`${total.toLocaleString()} meetings · ${upcomingCount.toLocaleString()} upcoming · ${followUpCount.toLocaleString()} follow-up`}
        primaryAction={<WorkspaceRibbonButton label="Schedule Meeting" onClick={() => setShowModal(true)} variant="primary" />}
      />

      <CRMActionBar>
        <WorkspaceRibbonButton label="Schedule Meeting" onClick={() => setShowModal(true)} variant="primary" />
        <WorkspaceRibbonButton label="All" onClick={() => setStatusFilter("")} variant={!statusFilter ? "primary" : "secondary"} />
        <WorkspaceRibbonButton label="Scheduled" onClick={() => setStatusFilter("SCHEDULED")} variant={statusFilter === "SCHEDULED" ? "primary" : "secondary"} />
        <WorkspaceRibbonButton label="Follow-Up" onClick={() => setStatusFilter("NEEDS_FOLLOW_UP")} variant={statusFilter === "NEEDS_FOLLOW_UP" ? "primary" : "secondary"} />
        <WorkspaceRibbonButton label="Refresh" onClick={() => void loadMeetings()} />
      </CRMActionBar>

      <div className="grid gap-3 md:grid-cols-3">
        <CRMMetricCard label="Today's Meetings" value={todayCount.toLocaleString()} tone="blue" icon={<CalendarIcon />} helper="Scheduled for today" loading={loading} />
        <CRMMetricCard label="Upcoming" value={upcomingCount.toLocaleString()} tone="green" icon={<ClockIcon />} helper="Upcoming scheduled meetings" loading={loading} />
        <CRMMetricCard label="Needs Follow-Up" value={followUpCount.toLocaleString()} tone="orange" icon={<FollowUpIcon />} helper="Requires staff next step" loading={loading} />
      </div>

      <CRMFilterBar>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="text-sm font-medium text-slate-500">Filter by</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <CRMStatusBadge tone={statusFilter ? "green" : "gray"}>{total} meeting{total !== 1 ? "s" : ""}</CRMStatusBadge>
        </div>
      </CRMFilterBar>

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
    <CRMEmptyState
      title="No meetings yet"
      description="Schedule your first donor meeting to get started."
      icon={<CalendarIcon />}
      action={(
      <button
        onClick={onSchedule}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
      >
        Schedule Meeting
      </button>
      )}
    />
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v15H5z" />
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

function FollowUpIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v6h-6" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}
