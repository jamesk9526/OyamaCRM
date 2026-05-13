/** Template library list and management actions for Letters & Printables. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { LetterTemplateSummary } from "@/app/components/letters/types";

const STATUSES = ["ALL", "DRAFT", "ACTIVE", "ARCHIVED"] as const;

/** Lists templates with filters and quick actions for duplicate/archive. */
export default function LetterTemplatesList() {
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const result = await apiFetch<LetterTemplateSummary[]>(`/api/letters/templates?${params.toString()}`);
      setTemplates(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a copy of one template and refreshes the list. */
  async function duplicateTemplate(templateId: string) {
    await apiFetch(`/api/letters/templates/${templateId}/duplicate`, { method: "POST" });
    await load();
  }

  /** Archives one template after a user confirmation. */
  async function archiveTemplate(templateId: string) {
    if (!confirm("Archive this template?")) return;
    await apiFetch(`/api/letters/templates/${templateId}`, { method: "DELETE" });
    await load();
  }

  const activeCount = useMemo(() => templates.filter((item) => item.status === "ACTIVE").length, [templates]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Template Library</h1>
          <p className="mt-0.5 text-sm text-gray-500">Versioned donor letter templates with reusable print and mailing content.</p>
        </div>
        <Link
          href="/letters-printables/templates/new"
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          New Template
        </Link>
      </div>

      <LettersWorkspaceNav />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Templates</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "-" : templates.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{loading ? "-" : activeCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Filtered Status</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{status}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((entry) => (
            <button
              key={entry}
              onClick={() => setStatus(entry)}
              className={`px-3 py-1.5 text-sm rounded-full border ${status === entry ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >
              {entry}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by template name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <button onClick={() => void load()} className="text-sm text-gray-600 hover:text-gray-800">Refresh List</button>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={String(index)} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No templates found for this filter.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Link href={`/letters-printables/templates/${template.id}`} className="text-sm font-semibold text-gray-900 hover:text-green-700">
                    {template.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{template.category.replaceAll("_", " ")} · {template.status}</p>
                  {template.description && <p className="text-sm text-gray-600 mt-1">{template.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void duplicateTemplate(template.id)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => void archiveTemplate(template.id)}
                    className="px-3 py-1.5 text-xs border border-red-200 rounded-lg text-red-700 hover:bg-red-50"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
