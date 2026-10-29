// ClientServicesLogTab provides client-scoped service entry workflows for multiple Compassion tabs.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ServiceEntry {
  id: string;
  serviceType: string;
  serviceDate: string;
  quantity?: number | null;
  notes?: string | null;
  providedBy?: { id: string; firstName: string; lastName: string } | null;
}

interface ClientServicesLogTabProps {
  clientId: string;
  title: string;
  intro: string;
  allowedServiceTypes: string[];
  defaultServiceType?: string;
  emptyMessage: string;
  developmentNotice?: string;
}

/** Formats date strings for compact service-list rendering. */
function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * ClientServicesLogTab is a reusable service-log view for client tabs.
 * It powers Resources, Medical, Pregnancy Tests, Sonograms, Referrals, Classes, and Boutique tabs.
 */
export default function ClientServicesLogTab({
  clientId,
  title,
  intro,
  allowedServiceTypes,
  defaultServiceType,
  emptyMessage,
  developmentNotice,
}: ClientServicesLogTabProps) {
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<"ALL" | string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    serviceType: defaultServiceType ?? allowedServiceTypes[0] ?? "OTHER",
    serviceDate: new Date().toISOString().slice(0, 10),
    quantity: "",
    notes: "",
  });
  const [form, setForm] = useState({
    serviceType: defaultServiceType ?? allowedServiceTypes[0] ?? "OTHER",
    serviceDate: new Date().toISOString().slice(0, 10),
    quantity: "",
    notes: "",
  });

  const serviceTypeQuery = useMemo(() => allowedServiceTypes.join(","), [allowedServiceTypes]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (serviceTypeFilter !== "ALL" && entry.serviceType !== serviceTypeFilter) {
        return false;
      }
      if (!needle) return true;
      const haystack = `${entry.serviceType} ${entry.notes ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, query, serviceTypeFilter]);

  const totalQuantity = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0),
    [entries],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        clientId,
        serviceTypes: serviceTypeQuery,
        limit: "200",
      });
      const data = await apiFetch<ServiceEntry[]>(`/api/compassion/services?${params.toString()}`);
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [clientId, serviceTypeQuery]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function createEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/compassion/services", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          serviceType: form.serviceType,
          serviceDate: new Date(form.serviceDate).toISOString(),
          quantity: form.quantity ? Number(form.quantity) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm((current) => ({
        ...current,
        serviceDate: new Date().toISOString().slice(0, 10),
        quantity: "",
        notes: "",
      }));
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service entry");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(entry: ServiceEntry) {
    setEditingId(entry.id);
    setEditForm({
      serviceType: entry.serviceType,
      serviceDate: entry.serviceDate.slice(0, 10),
      quantity: entry.quantity == null ? "" : String(entry.quantity),
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/services/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          serviceType: editForm.serviceType,
          serviceDate: new Date(editForm.serviceDate).toISOString(),
          quantity: editForm.quantity ? Number(editForm.quantity) : null,
          notes: editForm.notes.trim() || null,
        }),
      });
      setEditingId(null);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service entry");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entryId: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/compassion/services/${entryId}`, {
        method: "DELETE",
      });
      if (editingId === entryId) {
        setEditingId(null);
      }
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete service entry");
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Entries</p>
          <p className="text-lg font-semibold text-gray-900">{entries.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Qty</p>
          <p className="text-lg font-semibold text-blue-700">{totalQuantity}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 col-span-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Service Scope</p>
          <p className="text-sm font-medium text-gray-700 mt-1">{allowedServiceTypes.map((serviceType) => serviceType.replace(/_/g, " ")).join(" · ")}</p>
        </div>
      </section>

      <form onSubmit={createEntry} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Add Service Entry</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={form.serviceType}
            onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {allowedServiceTypes.map((serviceType) => (
              <option key={serviceType} value={serviceType}>
                {serviceType.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.serviceDate}
            onChange={(event) => setForm((current) => ({ ...current, serviceDate: event.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            value={form.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            placeholder="Quantity"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Optional notes"
          className="w-full min-h-[80px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Service Entry"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search services"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[220px]"
        />
        <select
          value={serviceTypeFilter}
          onChange={(event) => setServiceTypeFilter(event.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="ALL">All service types</option>
          {allowedServiceTypes.map((serviceType) => (
            <option key={serviceType} value={serviceType}>
              {serviceType.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">Showing {filteredEntries.length}</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading entries...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Notes</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">Staff</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.map((entry) => {
                if (editingId === entry.id) {
                  return (
                    <tr key={entry.id} className="bg-blue-50/40">
                      <td className="px-4 py-3">
                        <select
                          value={editForm.serviceType}
                          onChange={(event) => setEditForm((current) => ({ ...current, serviceType: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                        >
                          {allowedServiceTypes.map((serviceType) => (
                            <option key={serviceType} value={serviceType}>
                              {serviceType.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={editForm.serviceDate}
                          onChange={(event) => setEditForm((current) => ({ ...current, serviceDate: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={editForm.quantity}
                          onChange={(event) => setEditForm((current) => ({ ...current, quantity: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                          placeholder="Qty"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={editForm.notes}
                          onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                          placeholder="Notes"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                        {entry.providedBy ? `${entry.providedBy.firstName} ${entry.providedBy.lastName}` : "System"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveEdit()}
                            className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditForm({
                                serviceType: defaultServiceType ?? allowedServiceTypes[0] ?? "OTHER",
                                serviceDate: new Date().toISOString().slice(0, 10),
                                quantity: "",
                                notes: "",
                              });
                            }}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{entry.serviceType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(entry.serviceDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{entry.quantity ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.notes || "-"}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {entry.providedBy ? `${entry.providedBy.firstName} ${entry.providedBy.lastName}` : "System"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => startEditing(entry)}
                          className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void removeEntry(entry.id)}
                          className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
