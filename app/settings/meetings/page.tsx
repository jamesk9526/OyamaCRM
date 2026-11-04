/** Organization meeting defaults persisted through the meeting settings service. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { MeetingSettings } from "@/server/src/lib/meeting-settings";

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

type MeetingDefaults = MeetingSettings & { canManage: boolean };

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
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [defaultDuration, setDefaultDuration] = useState("60");
  const [autoTimeline, setAutoTimeline] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [followUpDays, setFollowUpDays] = useState("2");
  const [followUpMessage, setFollowUpMessage] = useState("Thank the donor and recap next steps from your meeting.");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError(""); setSaved(false);
    try {
      const settings = await apiFetch<MeetingDefaults>("/api/meetings/settings");
      if (current !== requestId.current) return;
      setCanEdit(settings.canManage);
      setDefaultDuration(String(settings.defaultDuration));
      setAutoTimeline(settings.autoTimeline); setAutoFollowUp(settings.autoFollowUp);
      setFollowUpDays(String(settings.followUpDays)); setFollowUpMessage(settings.followUpMessage);
      setLoaded(true);
    } catch (error) {
      if (current === requestId.current) { setLoaded(false); setError(error instanceof Error ? error.message : "Meeting defaults could not be loaded."); }
    } finally { if (current === requestId.current) setLoading(false); }
  }, []);
  const cancelLoad = useCallback(() => { requestId.current++; }, []);
  useEffect(() => { void load(); return cancelLoad; }, [load, cancelLoad]);
  async function handleSave() {
    if (!loaded || !canEdit) return;
    setSaving(true); setSaved(false); setError("");
    try {
      await apiFetch("/api/meetings/settings", { method: "PUT", body: JSON.stringify({ defaultDuration: Number(defaultDuration), autoTimeline, autoFollowUp, followUpDays: Number(followUpDays), followUpMessage }) });
      setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Meeting defaults could not be saved."); }
    finally { setSaving(false); }
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
          onClick={() => void handleSave()}
          disabled={loading || saving || !loaded || !canEdit}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {loading && <p role="status" className="text-sm text-slate-600">Loading meeting defaults…</p>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!loaded && <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">Retry loading defaults</button>}</div>}
      {saved && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Meeting defaults saved. New meetings use these defaults.</p>}
      {!canEdit && <p className="text-sm text-slate-600">Organization settings permission is required to change these defaults.</p>}
      <fieldset disabled={loading || saving || !loaded || !canEdit} onChange={() => setSaved(false)} className="space-y-6 disabled:opacity-60">
      {/* Default durations and reminders */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Scheduling Defaults</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="meeting-default-duration" className="block text-sm font-medium text-gray-700 mb-1">Default Meeting Duration</label>
            <select
              id="meeting-default-duration"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label htmlFor="meeting-follow-up-days" className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Due</label>
              <select
                id="meeting-follow-up-days"
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
              <label htmlFor="meeting-follow-up-message" className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Task Note</label>
              <input
                type="text"
                maxLength={2000}
                id="meeting-follow-up-message"
                value={followUpMessage}
                onChange={(e) => setFollowUpMessage(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Default task description…"
              />
            </div>
          </div>
        )}
      </section>

      </fieldset>
      {/* Meeting types reference */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Available Meeting Types</h2>
        <p className="text-xs text-gray-500">These types are available when scheduling a meeting.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
