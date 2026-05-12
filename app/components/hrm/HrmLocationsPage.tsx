// Persisted location management workspace for OyamaHRM.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createHrmLocation, fetchHrmLocations, updateHrmLocation } from "@/app/lib/hrm/api";
import type { HrmLocationRecord } from "@/app/lib/hrm/types";

interface LocationFormState {
  name: string;
  code: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

const EMPTY_FORM: LocationFormState = {
  name: "",
  code: "",
  timezone: "America/Chicago",
  status: "ACTIVE",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

/** Builds a form state object from one persisted location row. */
function formFromLocation(location: HrmLocationRecord): LocationFormState {
  return {
    name: location.name,
    code: location.code ?? "",
    timezone: location.timezone,
    status: location.status,
    addressLine1: location.addressLine1 ?? "",
    addressLine2: location.addressLine2 ?? "",
    city: location.city ?? "",
    state: location.state ?? "",
    zip: location.zip ?? "",
    notes: location.notes ?? "",
  };
}

/** HrmLocationsPage renders real location CRUD over /api/hrm/locations. */
export default function HrmLocationsPage() {
  const [locations, setLocations] = useState<HrmLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);

  /** Loads location records from persisted HRM location APIs. */
  const loadLocations = useCallback(async (params?: { search?: string; status?: "all" | "ACTIVE" | "INACTIVE" }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchHrmLocations({
        search: params?.search,
        status: params?.status && params.status !== "all" ? params.status : undefined,
      });
      setLocations(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load HRM locations.");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadLocations({ search, status: statusFilter });
    }, 250);

    return () => clearTimeout(handle);
  }, [loadLocations, search, statusFilter]);

  /** Sets the location form into create mode. */
  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSuccess(null);
    setError(null);
  }

  /** Sets the location form into edit mode for one selected location. */
  function startEdit(location: HrmLocationRecord) {
    setEditingId(location.id);
    setForm(formFromLocation(location));
    setSuccess(null);
    setError(null);
  }

  /** Leaves edit mode and resets location form state. */
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  /** Persists location create or update action based on current edit mode. */
  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Location name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        timezone: form.timezone.trim() || "America/Chicago",
        status: form.status,
        addressLine1: form.addressLine1.trim() || undefined,
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zip: form.zip.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingId) {
        await updateHrmLocation(editingId, payload);
        setSuccess("Location updated.");
      } else {
        await createHrmLocation(payload);
        setSuccess("Location created.");
      }

      cancelEdit();
      await loadLocations({ search, status: statusFilter });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save location.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = useMemo(() => locations.filter((location) => location.status === "ACTIVE").length, [locations]);
  const inactiveCount = useMemo(() => locations.filter((location) => location.status === "INACTIVE").length, [locations]);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Locations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">HRM Location Management</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          Manage persisted office locations, status, timezone defaults, and address data used by scheduling and internal communication workflows.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Locations</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "..." : locations.length}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">{loading ? "..." : activeCount}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Inactive</p>
          <p className="mt-1 text-2xl font-semibold text-gray-700">{loading ? "..." : inactiveCount}</p>
        </article>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{editingId ? "Edit Location" : "Create Location"}</h2>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel Editing
            </button>
          ) : (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
            >
              Clear Form
            </button>
          )}
        </div>

        <form onSubmit={saveLocation} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
              <input
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "ACTIVE" | "INACTIVE" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
              <input
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zip</label>
              <input
                value={form.zip}
                onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1</label>
              <input
                value={form.addressLine1}
                onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                value={form.addressLine2}
                onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update Location" : "Create Location"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search by name, code, city, or state"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "ACTIVE" | "INACTIVE")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading locations...</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-gray-500">No locations found for these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Timezone</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Coverage Today</th>
                <th className="py-2 pr-3">City/State</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-900">{location.name}</td>
                  <td className="py-2 pr-3 text-gray-600">{location.code || "-"}</td>
                  <td className="py-2 pr-3 text-gray-600">{location.timezone}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${location.status === "ACTIVE" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"}`}>
                      {location.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{location.coverageToday}</td>
                  <td className="py-2 pr-3 text-gray-600">{[location.city, location.state].filter(Boolean).join(", ") || "-"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => startEdit(location)}
                      className="rounded border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
