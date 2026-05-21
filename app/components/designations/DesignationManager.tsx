// Donor CRM fund designation manager for creating and reviewing designation options.
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type DesignationRow = {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean;
  _count?: {
    donations?: number;
  };
};

/** Renders designation list + create form backed by /api/designations. */
export default function DesignationManager() {
  const [rows, setRows] = useState<DesignationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => rows.filter((row) => row.active !== false).length, [rows]);

  async function loadDesignations() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DesignationRow[]>("/api/designations");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load designations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDesignations();
  }, []);

  async function createDesignation() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Designation name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/api/designations", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          active,
        }),
      });

      setName("");
      setDescription("");
      setActive(true);
      setNotice("Designation created.");
      await loadDesignations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create designation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Fund Designations</h1>
            <p className="mt-1 text-sm text-gray-600">Create and manage donor fund/designation options used during gift entry.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <p>Total: <span className="font-semibold text-gray-900">{rows.length}</span></p>
            <p>Active: <span className="font-semibold text-gray-900">{activeCount}</span></p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-700">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="General Fund"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </label>

          <label className="text-sm text-gray-700 sm:col-span-2">
            Description (optional)
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Used for unrestricted gifts."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Active designation
          </label>

          <div className="flex items-center justify-end sm:col-span-2">
            <button
              type="button"
              onClick={() => void createDesignation()}
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add Designation"}
            </button>
          </div>
        </div>

        {notice ? (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Existing Designations</h2>
          <button
            type="button"
            onClick={() => void loadDesignations()}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading designations...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No designations yet. Add your first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Donations</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-2 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-2 py-2 text-gray-600">{row.description?.trim() || "-"}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.active === false ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"}`}>
                        {row.active === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-gray-700">{row._count?.donations ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
