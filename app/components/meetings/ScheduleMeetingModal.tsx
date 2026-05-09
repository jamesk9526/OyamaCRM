/**
 * ScheduleMeetingModal — modal form for scheduling a new meeting.
 * POSTs to /api/meetings with the form data.
 * Supports linking to a constituent (optional) and assigning to a staff member.
 * Closes and triggers a refresh on success.
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Meeting type options shown in the form */
const MEETING_TYPES = [
  { value: "DONOR_VISIT", label: "Donor Visit" },
  { value: "PHONE_CALL", label: "Phone Call" },
  { value: "LUNCH_MEETING", label: "Lunch Meeting" },
  { value: "BOARD_MEETING", label: "Board Meeting" },
  { value: "SPONSOR_MEETING", label: "Sponsor Meeting" },
  { value: "MAJOR_DONOR_MEETING", label: "Major Donor Meeting" },
  { value: "CHURCH_PRESENTATION", label: "Church Presentation" },
  { value: "VOLUNTEER_MEETING", label: "Volunteer Meeting" },
  { value: "FOLLOW_UP_CALL", label: "Follow-Up Call" },
  { value: "THANK_YOU_VISIT", label: "Thank-You Visit" },
  { value: "VIDEO_CALL", label: "Video Call" },
  { value: "OTHER", label: "Other" },
];

/** Location type options */
const LOCATION_TYPES = [
  { value: "IN_PERSON", label: "In Person" },
  { value: "PHONE", label: "Phone Call" },
  { value: "VIDEO", label: "Video Call" },
  { value: "AT_DONORS_HOME", label: "At Donor's Home" },
  { value: "AT_CHURCH", label: "At Church" },
  { value: "AT_OFFICE", label: "At Office" },
  { value: "AT_EVENT", label: "At Event" },
  { value: "CUSTOM", label: "Custom Location" },
];

interface Props {
  /** Called when the user dismisses the modal without saving */
  onClose: () => void;
  /** Called after the meeting is successfully created */
  onCreated: () => void;
  /** Optional: pre-fill the constituentId when opened from a constituent profile */
  constituentId?: string;
  /** Optional: display name of the pre-filled constituent */
  constituentName?: string;
}

/**
 * ScheduleMeetingModal — full-featured form to create a new meeting.
 * Sends a POST request to /api/meetings and calls onCreated on success.
 */
export default function ScheduleMeetingModal({ onClose, onCreated, constituentId, constituentName }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("DONOR_VISIT");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [locationType, setLocationType] = useState("IN_PERSON");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Build ISO datetime string from separate date + time inputs */
  function buildDateTime(dateStr: string, timeStr: string): string {
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
  }

  /** Submit the form — POST to /api/meetings */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Meeting title is required."); return; }
    if (!date) { setError("Please select a meeting date."); return; }

    setSaving(true);
    try {
      await apiFetch("/api/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          type,
          startTime: buildDateTime(date, time),
          endTime: endTime ? buildDateTime(date, endTime) : undefined,
          locationType,
          location: location.trim() || undefined,
          meetingUrl: meetingUrl.trim() || undefined,
          purpose: purpose.trim() || undefined,
          notes: notes.trim() || undefined,
          constituentId: constituentId || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Modal backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Schedule Meeting</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Pre-filled constituent */}
          {constituentName && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800">
              Meeting with <strong>{constituentName}</strong>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lunch with John Smith"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Date and times */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Type</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {LOCATION_TYPES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Physical location — shown for non-phone, non-video types */}
          {!["PHONE", "VIDEO"].includes(locationType) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Main Street Cafe, 123 Main St"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}

          {/* Video/online link — shown for video type */}
          {locationType === "VIDEO" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose / Agenda</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              placeholder="What is the goal of this meeting?"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preparation Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What should staff know or prepare before this meeting?"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Scheduling…" : "Schedule Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
