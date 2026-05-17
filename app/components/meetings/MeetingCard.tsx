/**
 * MeetingCard — displays a single meeting in a card layout.
 * Shows title, constituent, date/time, type, status badge, and action buttons.
 * Used on the /meetings list page and the constituent profile meetings tab.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Meeting } from "@/app/meetings/page";
import { STATUS_COLORS, STATUS_LABELS } from "@/app/components/meetings/meeting-status";

/** Human-readable meeting type labels */
const TYPE_LABELS: Record<string, string> = {
  DONOR_VISIT: "Donor Visit",
  PHONE_CALL: "Phone Call",
  LUNCH_MEETING: "Lunch Meeting",
  BOARD_MEETING: "Board Meeting",
  SPONSOR_MEETING: "Sponsor Meeting",
  MAJOR_DONOR_MEETING: "Major Donor Meeting",
  CHURCH_PRESENTATION: "Church Presentation",
  VOLUNTEER_MEETING: "Volunteer Meeting",
  FOLLOW_UP_CALL: "Follow-Up Call",
  THANK_YOU_VISIT: "Thank-You Visit",
  VIDEO_CALL: "Video Call",
  OTHER: "Meeting",
};

/** Location type labels */
const LOCATION_LABELS: Record<string, string> = {
  IN_PERSON: "In Person",
  PHONE: "Phone",
  VIDEO: "Video Call",
  AT_DONORS_HOME: "At Donor's Home",
  AT_CHURCH: "At Church",
  AT_OFFICE: "At Office",
  AT_EVENT: "At Event",
  CUSTOM: "Custom",
};

interface Props {
  meeting: Meeting;
  onComplete: (id: string, outcome?: string) => void;
  onCancel: (id: string) => void;
}

/**
 * MeetingCard — renders one meeting as a horizontal card with status badge,
 * constituent link, staff assignee, and quick-action buttons (Complete / Cancel).
 */
export default function MeetingCard({ meeting, onComplete, onCancel }: Props) {
  const [completing, setCompleting] = useState(false);
  const [outcome, setOutcome] = useState("");

  const start = new Date(meeting.startTime);
  const isToday = start.toDateString() === new Date().toDateString();
  const statusColor = STATUS_COLORS[meeting.status] ?? "bg-gray-100 text-gray-500";

  async function handleComplete() {
    setCompleting(false);
    onComplete(meeting.id, outcome || undefined);
  }

  const canComplete = meeting.status === "SCHEDULED";
  const canCancel = meeting.status === "SCHEDULED";

  return (
    <div className={`bg-white border rounded-lg p-4 flex items-start gap-4 hover:shadow-sm transition-shadow ${isToday ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"}`}>
      {/* Date column */}
      <div className="shrink-0 text-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[64px]">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          {start.toLocaleDateString("en-US", { month: "short" })}
        </div>
        <div className="text-2xl font-bold text-gray-800 leading-none">{start.getDate()}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{meeting.title}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {/* Meeting type */}
              <span className="text-xs text-gray-500">{TYPE_LABELS[meeting.type] ?? meeting.type}</span>
              {/* Location */}
              {(meeting.locationType || meeting.location) && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">
                    {meeting.location || LOCATION_LABELS[meeting.locationType] || meeting.locationType}
                  </span>
                </>
              )}
              {/* Today badge */}
              {isToday && meeting.status === "SCHEDULED" && (
                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">Today</span>
              )}
              {/* Follow-up badge */}
              {meeting.followUpNeeded && meeting.status !== "CANCELED" && (
                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Needs Follow-Up</span>
              )}
            </div>
          </div>
          {/* Status badge */}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
            {STATUS_LABELS[meeting.status] ?? meeting.status}
          </span>
        </div>

        {/* Constituent + staff row */}
        <div className="flex items-center gap-4 mt-2">
          {meeting.constituent && (
            <Link
              href={`/constituents/${meeting.constituent.id}`}
              className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {meeting.constituent.firstName} {meeting.constituent.lastName}
            </Link>
          )}
          {meeting.assignedStaff && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {meeting.assignedStaff.firstName} {meeting.assignedStaff.lastName}
            </span>
          )}
        </div>

        {/* Purpose / notes preview */}
        {(meeting.purpose || meeting.outcome) && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">
            {meeting.outcome ? `Outcome: ${meeting.outcome}` : meeting.purpose}
          </p>
        )}

        {/* Complete outcome input (shown when completing) */}
        {completing && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Optional: describe the outcome…"
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
            <button
              onClick={handleComplete}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setCompleting(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
            >
              Back
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {!completing && (
        <div className="flex items-center gap-2 shrink-0">
          {canComplete && (
            <button
              onClick={() => setCompleting(true)}
              className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              Mark Complete
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(meeting.id)}
              className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
