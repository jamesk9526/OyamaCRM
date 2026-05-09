/**
 * ConstituentNotesTab — inline-editable notes and manual activity logger.
 * Replaces the static notes display on the constituent detail page.
 * - Top section: textarea for free-text notes with a Save button (PATCH /api/constituents/:id/notes)
 * - Bottom section: "Log Activity" form for timeline entries (calls, meetings, emails, notes)
 *   that POST to /api/constituents/:id/activities
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string } | null;
}

/** Icon for each activity type */
function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    CALL:     "📞",
    EMAIL:    "✉️",
    MEETING:  "🤝",
    NOTE:     "📝",
    DONATION: "💚",
    TASK:     "✅",
  };
  return <span className="text-base">{icons[type] ?? "📌"}</span>;
}

/** Human-readable relative timestamp, e.g. "3 minutes ago" */
function relative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ACTIVITY_TYPES = [
  { value: "NOTE",    label: "📝 Note" },
  { value: "CALL",    label: "📞 Phone Call" },
  { value: "EMAIL",   label: "✉️ Email" },
  { value: "MEETING", label: "🤝 Meeting" },
];

interface Props {
  /** Constituent ID for API calls. */
  constituentId: string;
  /** Current saved notes from the database. */
  initialNotes: string;
  /** Existing timeline activities already loaded by the parent. */
  existingActivities: Activity[];
}

/**
 * ConstituentNotesTab — inline notes editor + activity logger.
 * Edits are saved individually so the page doesn't need a full reload.
 */
export default function ConstituentNotesTab({ constituentId, initialNotes, existingActivities }: Props) {
  /* ── Notes state ── */
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  /* ── Activity logger state ── */
  const [activities, setActivities] = useState<Activity[]>(existingActivities ?? []);
  const [actType, setActType] = useState("NOTE");
  const [actDesc, setActDesc] = useState("");
  const [actSaving, setActSaving] = useState(false);
  const [actError, setActError] = useState<string | null>(null);

  /** Save the notes textarea content via PATCH. */
  async function saveNotes() {
    setNotesSaving(true);
    setNotesError(null);
    setNotesSaved(false);
    try {
      await apiFetch(`/api/constituents/${constituentId}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setNotesSaving(false);
    }
  }

  /** Log a new activity to the constituent's timeline. */
  async function logActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actDesc.trim()) return;
    setActSaving(true);
    setActError(null);
    try {
      const created = await apiFetch<Activity>(`/api/constituents/${constituentId}/activities`, {
        method: "POST",
        body: JSON.stringify({ type: actType, description: actDesc.trim() }),
      });
      setActivities([created, ...activities]);
      setActDesc("");
    } catch (e) {
      setActError(e instanceof Error ? e.message : "Failed to log activity");
    } finally {
      setActSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Notes section ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Constituent Notes</h3>
          {notesSaved && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
          rows={5}
          placeholder="Add internal notes about this constituent — giving history context, personal details, stewardship reminders…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        {notesError && <p className="text-xs text-red-600 mt-1">{notesError}</p>}
        <div className="flex justify-end mt-2">
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {notesSaving ? "Saving…" : "Save Notes"}
          </button>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* ── Log Activity section ── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Log Activity</h3>
        <form onSubmit={logActivity} className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-2 flex-wrap">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActType(t.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  actType === t.value
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Description input */}
          <textarea
            value={actDesc}
            onChange={(e) => setActDesc(e.target.value)}
            rows={2}
            placeholder={
              actType === "CALL"    ? "Describe the call — who you spoke with, outcome, next steps…" :
              actType === "EMAIL"   ? "What was the email about? Any response received?" :
              actType === "MEETING" ? "Meeting summary — who attended, what was discussed, next steps…" :
              "Add a note to the timeline…"
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />

          {actError && <p className="text-xs text-red-600">{actError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={actSaving || !actDesc.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actSaving ? "Logging…" : "Add to Timeline"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Recent activity feed (inline preview of new entries) ── */}
      {activities.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {activities.slice(0, 10).map((a) => (
              <div key={a.id} className="flex gap-3 py-2.5 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <ActivityIcon type={a.type} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800">{a.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {relative(a.createdAt)}
                    {a.user && ` · ${a.user.firstName} ${a.user.lastName}`}
                    {` · ${a.type.toLowerCase().replace("_", " ")}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
