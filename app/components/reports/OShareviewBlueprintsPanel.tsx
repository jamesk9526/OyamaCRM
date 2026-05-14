"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { ReportsToolId, ReportsWorkspaceModule } from "@/app/components/reports/ReportsModuleToolbar";

export type ReportTabId = "overview" | "donors" | "giving" | "campaigns" | "retention";

export interface OShareviewReportBlueprint {
  id: string;
  name: string;
  description: string;
  module: ReportsWorkspaceModule;
  tool: ReportsToolId;
  tab: ReportTabId;
  year: number;
  allYears: boolean;
  includeGrants: boolean;
  exportMode: "csv" | "server_csv" | "print";
  createdAt: string;
  updatedAt: string;
  createdByName: string;
}

interface OShareviewBlueprintsPanelProps {
  canManage: boolean;
  currentConfig: {
    module: ReportsWorkspaceModule;
    tool: ReportsToolId;
    tab: ReportTabId;
    year: number;
    allYears: boolean;
    includeGrants: boolean;
  };
  onApply: (blueprint: OShareviewReportBlueprint) => void;
}

/** Admin-first panel to save, load, and curate reusable OShareview reporting presets. */
export default function OShareviewBlueprintsPanel({ canManage, currentConfig, onApply }: OShareviewBlueprintsPanelProps) {
  const [items, setItems] = useState<OShareviewReportBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exportMode, setExportMode] = useState<"csv" | "server_csv" | "print">("csv");

  async function loadBlueprints() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ blueprints: OShareviewReportBlueprint[] }>("/api/reports/oshareview-blueprints");
      setItems(Array.isArray(data.blueprints) ? data.blueprints : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved report blueprints.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBlueprints();
  }, []);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ blueprints: OShareviewReportBlueprint[] }>("/api/reports/oshareview-blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          module: currentConfig.module,
          tool: currentConfig.tool,
          tab: currentConfig.tab,
          year: currentConfig.year,
          allYears: currentConfig.allYears,
          includeGrants: currentConfig.includeGrants,
          exportMode,
        }),
      });
      setItems(Array.isArray(data.blueprints) ? data.blueprints : []);
      setName("");
      setDescription("");
      setExportMode("csv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blueprint.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const data = await apiFetch<{ blueprints: OShareviewReportBlueprint[] }>(`/api/reports/oshareview-blueprints/${id}`, {
        method: "DELETE",
      });
      setItems(Array.isArray(data.blueprints) ? data.blueprints : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete blueprint.");
    }
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [items],
  );

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Saved Report Blueprints</h3>
          <p className="text-xs text-gray-500">Custom report presets for repeatable board, finance, and operations reporting.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBlueprints()}
          className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {canManage && (
        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <input
            value={name}
            onChange={(eventInput) => setName(eventInput.target.value)}
            placeholder="Blueprint name"
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800"
          />
          <textarea
            value={description}
            onChange={(eventInput) => setDescription(eventInput.target.value)}
            placeholder="What this report is used for"
            rows={2}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800"
          />
          <div className="flex items-center gap-2">
            <select
              value={exportMode}
              onChange={(eventInput) => setExportMode(eventInput.target.value as "csv" | "server_csv" | "print")}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
            >
              <option value="csv">CSV Export</option>
              <option value="server_csv">Server CSV</option>
              <option value="print">Printable</option>
            </select>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || name.trim().length === 0}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Blueprint"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null}

      <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
        {loading && sorted.length === 0 ? (
          <p className="text-xs text-gray-500">Loading blueprints...</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-gray-500">No saved blueprints yet.</p>
        ) : (
          sorted.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                  <p className="text-[11px] text-gray-500">{item.module} • {item.tool} • {item.tab}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onApply(item)}
                  className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100"
                >
                  Apply
                </button>
              </div>
              {item.description ? <p className="mt-1 text-[11px] text-gray-600">{item.description}</p> : null}
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                <span>{new Date(item.updatedAt).toLocaleString()}</span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
