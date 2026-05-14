"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface OShareviewNote {
  id: string;
  body: string;
  priority: "info" | "important" | "urgent";
  createdAt: string;
  createdByName: string;
}

interface NotesResponse {
  notes: OShareviewNote[];
}

interface OShareviewNotesPanelProps {
  canPost: boolean;
}

/** Displays OShareview broadcast notes and admin posting controls. */
export default function OShareviewNotesPanel({ canPost }: OShareviewNotesPanelProps) {
  const [notes, setNotes] = useState<OShareviewNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"info" | "important" | "urgent">("info");

  async function loadNotes() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<NotesResponse>("/api/reports/oshareview-notes");
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OShareview notes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ notes: OShareviewNote[] }>("/api/reports/oshareview-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed, priority }),
      });
      setNotes(Array.isArray(result.notes) ? result.notes : []);
      setBody("");
      setPriority("info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post note.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotes();
    }, 45000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className="rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">OShareview Notes</h3>
          <p className="text-xs text-gray-500">Broadcast updates and guidance for OShareview users.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
      </div>

      {canPost && (
        <div className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="block text-xs font-medium text-gray-700">Post note to OShareview users</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Share an announcement, report context, or follow-up instruction..."
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          <div className="flex items-center justify-between gap-2">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as "info" | "important" | "urgent")}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            >
              <option value="info">Info</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || body.trim().length === 0}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post note"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}

      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {loading && notes.length === 0 ? (
          <p className="text-xs text-gray-500">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-gray-500">No notes yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-gray-200 bg-white p-3 transition hover:border-emerald-200">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    note.priority === "urgent"
                      ? "bg-red-50 text-red-700"
                      : note.priority === "important"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {note.priority}
                </span>
                <span className="text-[11px] text-gray-400">
                  {new Date(note.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-gray-700">{note.body}</p>
              <p className="mt-1 text-[11px] text-gray-400">Posted by {note.createdByName}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
