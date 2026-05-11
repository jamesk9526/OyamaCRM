// ClientActivityEntriesTab provides reusable client-scoped CRUD for activity-backed tabs.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ActivityEntry {
  id: string;
  activityType: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  performedBy?: { id: string; firstName: string; lastName: string } | null;
}

interface MetadataField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "url" | "date" | "select";
  options?: string[];
}

interface ClientActivityEntriesTabProps {
  clientId: string;
  activityType: "CLIENT_NOTE" | "CLIENT_ASSESSMENT" | "CLIENT_DOCUMENT" | "CLIENT_COMMUNICATION" | "CLIENT_PORTAL_EVENT";
  title: string;
  intro: string;
  entryLabel: string;
  emptyMessage: string;
  developmentNotice?: string;
  metadataFields?: MetadataField[];
}

/** Returns an ISO timestamp in local-date input format. */
function toLocalDateInputValue(value: string): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

/** Formats an ISO timestamp for compact display in cards. */
function fmtDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * ClientActivityEntriesTab renders editable activity records for a specific activity type.
 * It is used by Notes, Assessments, Documents, Communication, and Portal tabs.
 */
export default function ClientActivityEntriesTab({
  clientId,
  activityType,
  title,
  intro,
  entryLabel,
  emptyMessage,
  developmentNotice,
  metadataFields = [],
}: ClientActivityEntriesTabProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMetadata, setFormMetadata] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editMetadata, setEditMetadata] = useState<Record<string, string>>({});

  const fieldKeys = useMemo(() => metadataFields.map((field) => field.key), [metadataFields]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => {
      const metadataText = JSON.stringify(entry.metadata ?? {}).toLowerCase();
      return `${entry.description} ${metadataText}`.toLowerCase().includes(needle);
    });
  }, [entries, query]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ActivityEntry[]>(
        `/api/compassion/clients/${clientId}/activity-entries?types=${encodeURIComponent(activityType)}&limit=200`,
      );
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [clientId, activityType]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function collectMetadata(source: Record<string, string>): Record<string, string> {
    const next: Record<string, string> = {};
    fieldKeys.forEach((key) => {
      const value = (source[key] ?? "").trim();
      if (value) {
        next[key] = value;
      }
    });
    return next;
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formDescription.trim()) return;

    setSaving(true);
    try {
      await apiFetch(`/api/compassion/clients/${clientId}/activity-entries`, {
        method: "POST",
        body: JSON.stringify({
          activityType,
          description: formDescription.trim(),
          metadata: collectMetadata(formMetadata),
        }),
      });
      setFormDescription("");
      setFormMetadata({});
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: ActivityEntry) {
    setEditingId(entry.id);
    setEditDescription(entry.description);

    const nextMetadata: Record<string, string> = {};
    fieldKeys.forEach((key) => {
      const rawValue = entry.metadata && typeof entry.metadata[key] !== "undefined" ? entry.metadata[key] : "";
      nextMetadata[key] = rawValue == null ? "" : String(rawValue);
    });
    setEditMetadata(nextMetadata);
  }

  async function saveEdit() {
    if (!editingId || !editDescription.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/clients/${clientId}/activity-entries/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: editDescription.trim(),
          metadata: collectMetadata(editMetadata),
        }),
      });
      setEditingId(null);
      setEditDescription("");
      setEditMetadata({});
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update record");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entryId: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/clients/${clientId}/activity-entries/${entryId}`, {
        method: "DELETE",
      });
      if (editingId === entryId) {
        setEditingId(null);
        setEditDescription("");
        setEditMetadata({});
      }
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">{title}</p>
        <p className="text-sm text-blue-700 mt-1">{intro}</p>
      </section>

      {developmentNotice ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
          <p className="text-sm text-amber-800 mt-1">{developmentNotice}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Records</p>
          <p className="text-lg font-semibold text-gray-900">{entries.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Visible</p>
          <p className="text-lg font-semibold text-blue-700">{filteredEntries.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 col-span-2 md:col-span-1">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Type</p>
          <p className="text-sm font-medium text-gray-700 mt-1">{activityType.replace("CLIENT_", "").replace(/_/g, " ")}</p>
        </div>
      </section>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Add {entryLabel}</p>
        <label className="block text-xs font-semibold text-gray-700">{entryLabel}</label>
        <textarea
          value={formDescription}
          onChange={(event) => setFormDescription(event.target.value)}
          placeholder={`Enter ${entryLabel.toLowerCase()}...`}
          className="w-full min-h-[90px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
          required
        />

        {metadataFields.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {metadataFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    value={formMetadata[field.key] ?? ""}
                    onChange={(event) =>
                      setFormMetadata((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={field.type === "date" ? toLocalDateInputValue(formMetadata[field.key] ?? "") : (formMetadata[field.key] ?? "")}
                    onChange={(event) =>
                      setFormMetadata((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : `Add ${entryLabel}`}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${entryLabel.toLowerCase()} records`}
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading records...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const entryMetadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
            const isEditing = editingId === entry.id;

            return (
              <article key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                {isEditing ? (
                  <>
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="w-full min-h-[90px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    {metadataFields.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {metadataFields.map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                            {field.type === "select" ? (
                              <select
                                value={editMetadata[field.key] ?? ""}
                                onChange={(event) =>
                                  setEditMetadata((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              >
                                <option value="">Select...</option>
                                {(field.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type === "date" ? "date" : "text"}
                                value={field.type === "date" ? toLocalDateInputValue(editMetadata[field.key] ?? "") : (editMetadata[field.key] ?? "")}
                                onChange={(event) =>
                                  setEditMetadata((current) => ({
                                    ...current,
                                    [field.key]: event.target.value,
                                  }))
                                }
                                placeholder={field.placeholder}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDescription("");
                          setEditMetadata({});
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveEdit()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.description}</p>
                    {metadataFields.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {metadataFields.map((field) => {
                          const rawValue = entryMetadata[field.key];
                          if (typeof rawValue === "undefined" || rawValue === null || String(rawValue).trim() === "") {
                            return null;
                          }
                          return (
                            <p key={field.key} className="text-xs text-gray-500">
                              <span className="font-semibold text-gray-600">{field.label}:</span> {String(rawValue)}
                            </p>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                      <span>
                        {fmtDateTime(entry.createdAt)}
                        {entry.performedBy ? ` · ${entry.performedBy.firstName} ${entry.performedBy.lastName}` : " · System"}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="rounded border border-blue-200 px-2 py-1 text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void removeEntry(entry.id)}
                          className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
