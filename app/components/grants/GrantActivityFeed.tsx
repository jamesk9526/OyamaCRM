/**
 * GrantActivityFeed — timeline of notes and status changes on a grant.
 * Supports adding new notes via a textarea at the top.
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { GrantActivity, GrantActivityType } from "./types";

interface Props {
  grantId: string;
  activities: GrantActivity[];
  onActivityAdded: (a: GrantActivity) => void;
}

/** Icon and color for each activity type. */
const ACTIVITY_META: Record<GrantActivityType, { icon: string; color: string }> = {
  NOTE:                    { icon: "💬", color: "bg-gray-100" },
  STATUS_CHANGE:           { icon: "🔄", color: "bg-blue-50" },
  LOI_SUBMITTED:           { icon: "📤", color: "bg-yellow-50" },
  PROPOSAL_SUBMITTED:      { icon: "📨", color: "bg-purple-50" },
  AWARD_NOTIFICATION:      { icon: "🏆", color: "bg-green-50" },
  REJECTION_NOTIFICATION:  { icon: "❌", color: "bg-red-50" },
  REPORTING_SUBMITTED:     { icon: "📊", color: "bg-indigo-50" },
  DOCUMENT_ADDED:          { icon: "📎", color: "bg-gray-100" },
  OTHER:                   { icon: "📝", color: "bg-gray-100" },
};

/** Format a date to a relative or absolute time string. */
function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * GrantActivityFeed — shows grant timeline with a note composer at the top.
 * Activities are displayed newest-first.
 */
export default function GrantActivityFeed({ grantId, activities, onActivityAdded }: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Post a new note to the grant activity timeline. */
  async function handleAddNote() {
    if (!note.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const activity: GrantActivity = await apiFetch(`/api/grants/${grantId}/activity`, {
        method: "POST",
        body: JSON.stringify({ description: note.trim(), type: "NOTE" }),
      });
      onActivityAdded(activity);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Note composer */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Add Note</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter to submit
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleAddNote();
          }}
          rows={3}
          placeholder="Add a note, update, or next step…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={handleAddNote}
            disabled={submitting || !note.trim()}
            className="px-4 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">No activity yet.</div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.OTHER;
            return (
              <div key={a.id} className={`flex gap-3 rounded-xl border border-gray-100 p-4 ${meta.color}`}>
                <span className="text-lg shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{a.description}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {a.user ? `${a.user.firstName} ${a.user.lastName} · ` : ""}{timeAgo(a.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
