/**
 * MeetingsWidget — upcoming meetings dashboard widget.
 * Fetches from /api/meetings/upcoming to show the next scheduled donor meetings.
 * Includes a count of today's meetings and a link to the full meetings page.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

/** Minimal meeting shape needed by this widget */
interface MeetingItem {
  id: string;
  title: string;
  type: string;
  startTime: string;
  locationType: string;
  location?: string;
  constituent?: { id: string; firstName: string; lastName: string } | null;
  assignedStaff?: { id: string; firstName: string; lastName: string } | null;
}

/** Human-readable meeting type labels */
const TYPE_LABELS: Record<string, string> = {
  DONOR_VISIT: "Donor Visit",
  PHONE_CALL: "Phone Call",
  LUNCH_MEETING: "Lunch",
  BOARD_MEETING: "Board Meeting",
  SPONSOR_MEETING: "Sponsor Meeting",
  MAJOR_DONOR_MEETING: "Major Donor",
  CHURCH_PRESENTATION: "Church Presentation",
  VOLUNTEER_MEETING: "Volunteer Meeting",
  FOLLOW_UP_CALL: "Follow-Up Call",
  THANK_YOU_VISIT: "Thank-You Visit",
  VIDEO_CALL: "Video Call",
  OTHER: "Meeting",
};

/**
 * MeetingsWidget — renders upcoming scheduled meetings on the dashboard.
 * Links each meeting title to the /meetings page.
 */
export default function MeetingsWidget() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items?: MeetingItem[]; todayCount?: number }>(
        "/api/meetings/upcoming"
      );
      setMeetings(data.items ?? []);
      setTodayCount(data.todayCount ?? 0);
    } catch {
      setMeetings([]);
      setTodayCount(0);
      setError("Upcoming meetings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 0116 0" />
        </svg>
        Loading meetings…
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-gray-400 text-sm mb-2">{error ?? "No upcoming meetings"}</div>
        <Link
          href="/meetings"
          className="text-xs text-green-600 hover:text-green-700 font-medium hover:underline"
        >
          Schedule a meeting →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Today count badge */}
      {todayCount > 0 && (
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {todayCount} today
          </span>
        </div>
      )}

      {/* Meeting list */}
      {meetings.slice(0, 6).map((meeting) => {
        const start = new Date(meeting.startTime);
        const isToday = start.toDateString() === new Date().toDateString();

        return (
          <div
            key={meeting.id}
            className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors ${isToday ? "bg-blue-50 hover:bg-blue-50" : ""}`}
          >
            {/* Date block */}
            <div className="shrink-0 text-center">
              <div className="text-[10px] text-gray-400 uppercase font-semibold leading-none">
                {start.toLocaleDateString("en-US", { month: "short" })}
              </div>
              <div className="text-base font-bold text-gray-800 leading-tight">{start.getDate()}</div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate leading-tight">{meeting.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{TYPE_LABELS[meeting.type] ?? meeting.type}</span>
                <span className="text-gray-300">·</span>
                <span>{start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                {meeting.constituent && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-green-700">
                      {meeting.constituent.firstName} {meeting.constituent.lastName}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Today pill */}
            {isToday && (
              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                Today
              </span>
            )}
          </div>
        );
      })}

      {/* View all link */}
      <div className="pt-1.5 border-t border-gray-100">
        <Link
          href="/meetings"
          className="block text-center text-xs text-green-600 hover:text-green-700 font-medium py-1 hover:underline"
        >
          View all meetings →
        </Link>
      </div>
    </div>
  );
}
