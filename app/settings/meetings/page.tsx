/**
 * Settings — Meetings page.
 * Displays and allows editing of default meeting configuration:
 * meeting types, default duration, default reminder, follow-up task behavior,
 * and whether meetings automatically create timeline entries.
 *
 * These defaults apply when scheduling new meetings throughout the Donor CRM.
 * NOTE: Settings display is real UI; persistence to OrganizationSettings.metadata
 * requires a future backend wiring (currently shows configured defaults only).
 * TODO: wire save button to PUT /api/settings with a "meetings" namespace in metadata JSON.
 */
"use client";

import { useState } from "react";

/** Meeting type option with label and description */
const MEETING_TYPES = [
  { value: "DONOR_VISIT", label: "Donor Visit", description: "In-person visit with a donor" },
  { value: "PHONE_CALL", label: "Phone Call", description: "Outbound or inbound donor call" },
  { value: "LUNCH_MEETING", label: "Lunch Meeting", description: "Lunch or coffee with a donor or partner" },
  { value: "BOARD_MEETING", label: "Board Meeting", description: "Internal board or leadership meeting" },
  { value: "SPONSOR_MEETING", label: "Sponsor Meeting", description: "Meeting with a corporate sponsor" },
  { value: "MAJOR_DONOR_MEETING", label: "Major Donor Meeting", description: "Cultivation or solicitation with a major donor" },
  { value: "CHURCH_PRESENTATION", label: "Church Presentation", description: "Presentation at a church partner" },
  { value: "VOLUNTEER_MEETING", label: "Volunteer Meeting", description: "Meeting with volunteers" },
  { value: "FOLLOW_UP_CALL", label: "Follow-Up Call", description: "Post-donation or post-event follow-up call" },
  { value: "THANK_YOU_VISIT", label: "Thank-You Visit", description: "Personal thank-you visit to a donor" },
  { value: "VIDEO_CALL", label: "Video Call", description: "Zoom, Teams, or other video call" },
  { value: "OTHER", label: "Other", description: "Any other meeting type" },
];

const REMINDER_OPTIONS = [
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "2 hours" },
];

const FOLLOWUP_DAYS_OPTIONS = [
  { value: "1", label: "1 day after" },
  { value: "2", label: "2 days after" },
  { value: "3", label: "3 days after" },
  { value: "5", label: "5 days after" },
  { value: "7", label: "1 week after" },
];

/** MeetingsSettingsPage — configure meeting defaults for the Donor CRM */
export default function MeetingsSettingsPage() {
  // Default settings (these would be loaded from/saved to OrganizationSettings.metadata in a future PR)
  const [defaultDuration, setDefaultDuration] = useState("60");
  const [defaultReminder, setDefaultReminder] = useState("1440");
  const [autoTimeline, setAutoTimeline] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [followUpDays, setFollowUpDays] = useState("2");
  const [followUpMessage, setFollowUpMessage] = useState("Thank the donor and recap next steps from your meeting.");
  const [saved, setSaved] = useState(false);

  // TODO: wire to PUT /api/settings with meetings namespace in metadata JSON
  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meeting Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure defaults for scheduling meetings across the Donor CRM.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          {saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>

      {/* Backend note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> These defaults are UI-configured. Backend persistence to
        OrganizationSettings requires wiring to{" "}
        <code className="text-amber-700 bg-amber-100 px-1 rounded">PUT /api/settings</code>.
        {/* TODO: backend API wiring needed */}
      </div>

      {/* Default durations and reminders */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Scheduling Defaults</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Meeting Duration</label>
            <select
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Used as end time when scheduling a meeting.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Reminder</label>
            <select
              value={defaultReminder}
              onChange={(e) => setDefaultReminder(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">When staff receive a notification before meetings.</p>
          </div>
        </div>
      </section>

      {/* Timeline integration */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Constituent Timeline</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoTimeline}
            onChange={(e) => setAutoTimeline(e.target.checked)}
            className="w-4 h-4 accent-green-600"
          />
          <div>
            <div className="text-sm font-medium text-gray-700">Auto-add meetings to constituent timeline</div>
            <div className="text-xs text-gray-400">When enabled, scheduling or completing a meeting writes a timeline entry on the linked constituent's profile.</div>
          </div>
        </label>
      </section>

      {/* Follow-up task settings */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Follow-Up Task Defaults</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoFollowUp}
            onChange={(e) => setAutoFollowUp(e.target.checked)}
            className="w-4 h-4 accent-green-600"
          />
          <div>
            <div className="text-sm font-medium text-gray-700">Auto-create follow-up task when a meeting is completed</div>
            <div className="text-xs text-gray-400">Automatically creates a follow-up task assigned to the same staff member.</div>
          </div>
        </label>

        {autoFollowUp && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Due</label>
              <select
                value={followUpDays}
                onChange={(e) => setFollowUpDays(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {FOLLOWUP_DAYS_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Task Note</label>
              <input
                type="text"
                value={followUpMessage}
                onChange={(e) => setFollowUpMessage(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Default task description…"
              />
            </div>
          </div>
        )}
      </section>

      {/* Meeting types reference */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Available Meeting Types</h2>
        <p className="text-xs text-gray-500">These types are available when scheduling a meeting. Custom types can be added in a future release.</p>
        <div className="grid grid-cols-2 gap-2">
          {MEETING_TYPES.map((t) => (
            <div key={t.value} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-800">{t.label}</div>
                <div className="text-xs text-gray-400">{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
