/** User-managed Steward AI memories and memory preferences. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface MemoryPreference {
  memoryEnabled: boolean;
  fileContextEnabled: boolean;
  updatedAt: string;
}

interface AiMemory {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  confidence: number;
  active: boolean;
  workspaceScope: string | null;
  createdAt: string;
  updatedAt: string;
}

const MEMORY_CATEGORIES = [
  "preference",
  "organization",
  "writing_style",
  "project",
  "workflow",
  "event",
  "crm_setting",
  "communication",
  "other",
];

const WORKSPACE_SCOPES = ["global", "donor", "events", "compassion", "hrm", "watchdog", "webmaster", "steward"];

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** AIMemorySettingsPanel lets the current user control Steward's long-term memory. */
export default function AIMemorySettingsPanel() {
  const [preference, setPreference] = useState<MemoryPreference | null>(null);
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "preference",
    workspaceScope: "global",
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [pref, rows] = await Promise.all([
        apiFetch<MemoryPreference>("/api/steward-ai/memory/preferences"),
        apiFetch<AiMemory[]>("/api/steward-ai/memories"),
      ]);
      setPreference(pref);
      setMemories(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredMemories = useMemo(() => memories.filter((memory) => {
    if (categoryFilter && memory.category !== categoryFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${memory.title} ${memory.content} ${memory.category} ${memory.workspaceScope ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [categoryFilter, memories, query]);

  async function updatePreference(patch: Partial<MemoryPreference>) {
    if (!preference) return;
    const next = { ...preference, ...patch };
    const saved = await apiFetch<MemoryPreference>("/api/steward-ai/memory/preferences", {
      method: "PUT",
      body: JSON.stringify(next),
    });
    setPreference(saved);
    setNotice("Memory preferences saved.");
  }

  async function createMemory() {
    if (!form.content.trim()) return;
    const created = await apiFetch<AiMemory>("/api/steward-ai/memories", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        workspaceScope: form.workspaceScope === "global" ? "global" : form.workspaceScope,
        source: "manual",
        active: true,
      }),
    });
    setMemories((current) => [created, ...current]);
    setForm({ title: "", content: "", category: "preference", workspaceScope: "global" });
    setNotice("Memory added.");
  }

  async function toggleMemory(memory: AiMemory) {
    const updated = await apiFetch<AiMemory>(`/api/steward-ai/memories/${memory.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !memory.active }),
    });
    setMemories((current) => current.map((row) => row.id === updated.id ? updated : row));
  }

  async function deleteMemory(memory: AiMemory) {
    await apiFetch(`/api/steward-ai/memories/${memory.id}`, { method: "DELETE" });
    setMemories((current) => current.filter((row) => row.id !== memory.id));
    setNotice("Memory deleted.");
  }

  async function clearAll() {
    if (!window.confirm("Clear all Steward memories for your user account?")) return;
    await apiFetch("/api/steward-ai/memories/clear", { method: "POST" });
    setMemories([]);
    setNotice("All memories cleared.");
  }

  if (loading || !preference) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Memories</h2>
        <p className="mt-1 text-sm text-gray-500">Loading memory controls...</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Memories</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Steward saves durable, reusable facts only: preferences, writing style, organization details, recurring workflows, event details, and CRM settings. Session details stay temporary.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={preference.memoryEnabled}
              onChange={(event) => void updatePreference({ memoryEnabled: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            Memory on
          </label>
          <button type="button" onClick={clearAll} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
            Clear All Memories
          </button>
        </div>
      </div>

      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{notice}</div> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Add Memory</h3>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Short title"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={form.content}
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            placeholder="Example: Use a warm, direct writing style for board updates."
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {MEMORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              value={form.workspaceScope}
              onChange={(event) => setForm((current) => ({ ...current, workspaceScope: event.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {WORKSPACE_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
            </select>
          </div>
          <button type="button" onClick={createMemory} className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
            Add Memory
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search memories"
              className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {MEMORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-lg border border-gray-200">
            {filteredMemories.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No memories match the current filters.</p>
            ) : filteredMemories.map((memory) => (
              <article key={memory.id} className="border-b border-gray-100 p-3 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900">{memory.title}</h4>
                    <p className="mt-1 text-sm leading-5 text-gray-600">{memory.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {memory.category} · {memory.workspaceScope ?? "global"} · {memory.source} · created {formatDate(memory.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void toggleMemory(memory)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      {memory.active ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => void deleteMemory(memory)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
