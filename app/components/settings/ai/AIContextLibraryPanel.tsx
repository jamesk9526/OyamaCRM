/** User-managed uploaded context library for Steward AI retrieval. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface MemoryPreference {
  memoryEnabled: boolean;
  fileContextEnabled: boolean;
  updatedAt: string;
}

interface ContextFile {
  id: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  workspaceScope: string | null;
  description: string | null;
  tags: string[];
  indexingStatus: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
  chunkCount: number;
}

const WORKSPACE_SCOPES = ["global", "donor", "events", "compassion", "hrm", "watchdog", "webmaster", "steward"];
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);

function bytesLabel(value: number): string {
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value > 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function statusClass(status: string): string {
  if (status === "indexed") return "border-green-200 bg-green-50 text-green-700";
  if (status === "needs_text") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

async function extractClientText(file: File): Promise<string> {
  if (TEXT_TYPES.has(file.type) || /\.(txt|md|markdown|csv|json|log)$/i.test(file.name)) {
    return file.text();
  }
  return "";
}

/** AIContextLibraryPanel lets users upload and control file context available to Steward. */
export default function AIContextLibraryPanel() {
  const [preference, setPreference] = useState<MemoryPreference | null>(null);
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [upload, setUpload] = useState({
    workspaceScope: "global",
    description: "",
    tags: "",
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [pref, rows] = await Promise.all([
        apiFetch<MemoryPreference>("/api/steward-ai/memory/preferences"),
        apiFetch<ContextFile[]>("/api/steward-ai/context-files"),
      ]);
      setPreference(pref);
      setFiles(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredFiles = useMemo(() => files.filter((file) => {
    if (workspaceFilter && file.workspaceScope !== workspaceFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${file.displayName} ${file.fileName} ${file.description ?? ""} ${file.tags.join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [files, query, workspaceFilter]);

  async function updatePreference(enabled: boolean) {
    if (!preference) return;
    const saved = await apiFetch<MemoryPreference>("/api/steward-ai/memory/preferences", {
      method: "PUT",
      body: JSON.stringify({ ...preference, fileContextEnabled: enabled }),
    });
    setPreference(saved);
    setNotice("Context retrieval preference saved.");
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setNotice(null);
    try {
      const extractedText = await extractClientText(file);
      const saved = await apiFetch<ContextFile>("/api/steward-ai/context-files", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          displayName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileType: file.name.split(".").pop()?.toLowerCase() || "unknown",
          sizeBytes: file.size,
          workspaceScope: upload.workspaceScope,
          description: upload.description,
          tags: upload.tags,
          extractedText,
        }),
      });
      setFiles((current) => [saved, ...current]);
      setNotice(extractedText
        ? "File uploaded and indexed for Steward retrieval."
        : "File uploaded. Add a description or extracted text later so Steward can use it as searchable context.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleFile(file: ContextFile) {
    const updated = await apiFetch<ContextFile>(`/api/steward-ai/context-files/${file.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !file.active }),
    });
    setFiles((current) => current.map((row) => row.id === updated.id ? updated : row));
  }

  async function reindexFile(file: ContextFile) {
    const updated = await apiFetch<ContextFile>(`/api/steward-ai/context-files/${file.id}/reindex`, { method: "POST" });
    setFiles((current) => current.map((row) => row.id === updated.id ? updated : row));
    setNotice("Context source re-indexed.");
  }

  async function deleteFile(file: ContextFile) {
    await apiFetch(`/api/steward-ai/context-files/${file.id}`, { method: "DELETE" });
    setFiles((current) => current.filter((row) => row.id !== file.id));
    setNotice("Context source removed.");
  }

  if (loading || !preference) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">AI Context Library</h2>
        <p className="mt-1 text-sm text-gray-500">Loading context library...</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">AI Context Library</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Uploaded files are private to your user account and can be scoped to a workspace. Steward searches indexed text before answering document-dependent questions.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={preference.fileContextEnabled}
            onChange={(event) => void updatePreference(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600"
          />
          File retrieval on
        </label>
      </div>

      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{notice}</div> : null}

      <div className="rounded-lg border border-gray-200 p-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_180px_1fr_auto]">
          <input
            type="text"
            value={upload.description}
            onChange={(event) => setUpload((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description for PDFs/images or notes for retrieval"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={upload.workspaceScope}
            onChange={(event) => setUpload((current) => ({ ...current, workspaceScope: event.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {WORKSPACE_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
          </select>
          <input
            type="text"
            value={upload.tags}
            onChange={(event) => setUpload((current) => ({ ...current, tags: event.target.value }))}
            placeholder="tags, comma separated"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            {uploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Text, CSV, Markdown, and JSON files are indexed immediately. PDFs, images, and binary documents are tracked, but need extracted text or a strong description before Steward can search their contents.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={workspaceFilter}
          onChange={(event) => setWorkspaceFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All workspaces</option>
          {WORKSPACE_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Workspace</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredFiles.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No context files match the current filters.</td></tr>
            ) : filteredFiles.map((file) => (
              <tr key={file.id} className={!file.active ? "bg-gray-50 text-gray-500" : ""}>
                <td className="px-3 py-3">
                  <p className="font-semibold text-gray-900">{file.displayName}</p>
                  <p className="text-xs text-gray-500">{file.mimeType} · {bytesLabel(file.sizeBytes)} · {file.chunkCount} chunk(s)</p>
                  {file.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-600">{file.description}</p> : null}
                </td>
                <td className="px-3 py-3">{file.workspaceScope ?? "global"}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(file.indexingStatus)}`}>
                    {file.indexingStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{file.tags.join(", ") || "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void toggleFile(file)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50">
                      {file.active ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => void reindexFile(file)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50">
                      Re-index
                    </button>
                    <button type="button" onClick={() => void deleteFile(file)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
