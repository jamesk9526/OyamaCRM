/**
 * EventTicketsPage — full CRUD ticket type manager for Events CRM.
 * Allows staff to select an event and manage its ticket types including
 * table tickets, pricing, capacity, and order limits.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  price: number;
  capacity?: number;
  available?: number;
  sortOrder: number;
  active: boolean;
  isTable: boolean;
  seatsIncluded: number;
  minPerOrder: number;
  maxPerOrder?: number;
  _count: { guests: number; orderItems: number };
  createdAt: string;
}

interface TicketTypeFormState {
  name: string;
  description: string;
  price: string;
  capacity: string;
  isTable: boolean;
  seatsIncluded: string;
  minPerOrder: string;
  maxPerOrder: string;
  active: boolean;
}

const DEFAULT_FORM: TicketTypeFormState = {
  name: "",
  description: "",
  price: "0",
  capacity: "",
  isTable: false,
  seatsIncluded: "1",
  minPerOrder: "1",
  maxPerOrder: "",
  active: true,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * EventTicketsPage - ticket type manager for Events CRM.
 * Select an event from the dropdown to view and manage its ticket types.
 */
export default function EventTicketsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Load all events on mount */
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        setEvents(data.filter((e) => e.active !== false));
      } catch (err) {
        console.error("Failed to load events:", err);
      } finally {
        setLoadingEvents(false);
      }
    }
    loadEvents();
  }, []);

  /** Load ticket types for selected event */
  const loadTicketTypes = useCallback(async () => {
    if (!selectedEventId) {
      setTicketTypes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<TicketType[]>(`/api/events/${selectedEventId}/ticket-types`);
      setTicketTypes(data);
    } catch (err) {
      console.error("Failed to load ticket types:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadTicketTypes();
  }, [loadTicketTypes]);

  /** Open modal for create */
  function openCreateModal() {
    setEditingTicket(null);
    setError(null);
    setShowModal(true);
  }

  /** Open modal for edit */
  function openEditModal(ticket: TicketType) {
    setEditingTicket(ticket);
    setError(null);
    setShowModal(true);
  }

  /** Toggle active status without opening modal */
  async function toggleActive(ticket: TicketType) {
    try {
      await apiFetch(`/api/events/${selectedEventId}/ticket-types/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !ticket.active }),
      });
      loadTicketTypes();
    } catch (err) {
      console.error("Failed to toggle ticket type:", err);
    }
  }

  /** Delete a ticket type */
  async function deleteTicketType(ticket: TicketType) {
    const sold = ticket._count.guests + ticket._count.orderItems;
    if (sold > 0) {
      alert(`Cannot delete: ${sold} order(s) reference this ticket type. It will be marked inactive instead.`);
      return;
    }
    if (!confirm(`Delete "${ticket.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/events/${selectedEventId}/ticket-types/${ticket.id}`, {
        method: "DELETE",
      });
      loadTicketTypes();
    } catch (err) {
      console.error("Failed to delete ticket type:", err);
    }
  }

  /** Save ticket type (create or update) */
  async function handleSave(form: TicketTypeFormState) {
    if (!selectedEventId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price) || 0,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        isTable: form.isTable,
        seatsIncluded: form.isTable ? parseInt(form.seatsIncluded, 10) || 8 : 1,
        minPerOrder: parseInt(form.minPerOrder, 10) || 1,
        maxPerOrder: form.maxPerOrder ? parseInt(form.maxPerOrder, 10) : undefined,
        active: form.active,
      };

      if (editingTicket) {
        await apiFetch(`/api/events/${selectedEventId}/ticket-types/${editingTicket.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/events/${selectedEventId}/ticket-types`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      setEditingTicket(null);
      loadTicketTypes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ticket type");
    } finally {
      setSaving(false);
    }
  }

  // ─── Computed metrics ────────────────────────────────────────────────────
  const activeTypes = ticketTypes.filter((t) => t.active).length;
  const totalCapacity = ticketTypes.reduce((sum, t) => sum + (t.capacity ?? 0), 0);
  const totalSold = ticketTypes.reduce((sum, t) => sum + t._count.guests + t._count.orderItems, 0);
  const tableTypes = ticketTypes.filter((t) => t.isTable).length;

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ticket Types</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure ticket pricing, capacity, table tickets, and order limits for your events.
        </p>
      </div>

      {/* Event selector */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            disabled={loadingEvents}
          >
            <option value="">
              {loadingEvents ? "Loading events..." : "Select an event to manage ticket types"}
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {new Date(e.startDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        {selectedEventId && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            + Add Ticket Type
          </button>
        )}
      </div>

      {/* No event selected */}
      {!selectedEventId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 010-4V8z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">Select an event to manage ticket types</p>
          <p className="text-sm text-gray-400 mt-1">Choose an event from the dropdown above to view and configure ticket types.</p>
        </div>
      ) : loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Loading ticket types...
        </div>
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Types" value={ticketTypes.length} />
            <MetricCard label="Active Types" value={activeTypes} color="amber" />
            <MetricCard label="Table Types" value={tableTypes} color="blue" />
            <MetricCard label="Total Sold" value={totalSold} helper={totalCapacity > 0 ? `of ${totalCapacity} capacity` : undefined} />
          </div>

          {/* Ticket types list */}
          {ticketTypes.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">No ticket types yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first ticket type to start managing registrations.</p>
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                + Add Ticket Type
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Sold / Cap</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Order Limits</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ticketTypes.map((ticket) => {
                    const sold = ticket._count.guests + ticket._count.orderItems;
                    const capLabel = ticket.capacity ? `${sold} / ${ticket.capacity}` : `${sold} sold`;
                    const pct = ticket.capacity && ticket.capacity > 0 ? Math.min(100, Math.round((sold / ticket.capacity) * 100)) : null;
                    return (
                      <tr key={ticket.id} className={`hover:bg-gray-50 ${!ticket.active ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{ticket.name}</p>
                          {ticket.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{ticket.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.isTable ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              Table ({ticket.seatsIncluded} seats)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                              Individual
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">
                            ${Number(ticket.price).toFixed(2)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{capLabel}</p>
                          {pct !== null && (
                            <div className="mt-1 w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600">
                            Min: {ticket.minPerOrder}
                            {ticket.maxPerOrder ? ` · Max: ${ticket.maxPerOrder}` : " · No max"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleActive(ticket)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-colors ${
                              ticket.active
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {ticket.active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openEditModal(ticket)}
                              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTicketType(ticket)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
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
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <TicketTypeModal
          ticketType={editingTicket}
          saving={saving}
          error={error}
          onClose={() => { setShowModal(false); setEditingTicket(null); setError(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

/**
 * MetricCard renders a single KPI metric for the ticket types page.
 */
function MetricCard({
  label,
  value,
  helper,
  color = "gray",
}: {
  label: string;
  value: number;
  helper?: string;
  color?: "gray" | "amber" | "blue" | "green";
}) {
  const colorMap = { gray: "text-gray-900", amber: "text-amber-600", blue: "text-blue-600", green: "text-green-600" };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
      {helper && <p className="text-xs text-gray-400 mt-0.5">{helper}</p>}
    </div>
  );
}

// ─── Ticket Type Modal ────────────────────────────────────────────────────────

/**
 * TicketTypeModal handles both creation and editing of ticket types.
 * Renders a form with all ticket configuration fields.
 */
function TicketTypeModal({
  ticketType,
  saving,
  error,
  onClose,
  onSave,
}: {
  ticketType: TicketType | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (form: TicketTypeFormState) => void;
}) {
  const [form, setForm] = useState<TicketTypeFormState>(
    ticketType
      ? {
          name: ticketType.name,
          description: ticketType.description ?? "",
          price: String(ticketType.price),
          capacity: ticketType.capacity ? String(ticketType.capacity) : "",
          isTable: ticketType.isTable,
          seatsIncluded: String(ticketType.seatsIncluded),
          minPerOrder: String(ticketType.minPerOrder),
          maxPerOrder: ticketType.maxPerOrder ? String(ticketType.maxPerOrder) : "",
          active: ticketType.active,
        }
      : DEFAULT_FORM
  );

  /** Generic field updater */
  function setField<K extends keyof TicketTypeFormState>(key: K, value: TicketTypeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {ticketType ? "Edit Ticket Type" : "Add Ticket Type"}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. General Admission, VIP Table"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Optional description shown to guests"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Price ($)</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Table ticket toggle */}
          <div className="flex items-center gap-3">
            <input
              id="isTable"
              type="checkbox"
              checked={form.isTable}
              onChange={(e) => {
                setField("isTable", e.target.checked);
                if (e.target.checked && form.seatsIncluded === "1") {
                  setField("seatsIncluded", "8");
                }
              }}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded"
            />
            <label htmlFor="isTable" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Table Ticket (covers multiple guests)
            </label>
          </div>

          {/* Seats included — shown only for table tickets */}
          {form.isTable && (
            <div className="ml-7">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Seats Included</label>
              <input
                type="number"
                value={form.seatsIncluded}
                onChange={(e) => setField("seatsIncluded", e.target.value)}
                min="1"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Capacity */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Capacity (leave blank for unlimited)
            </label>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setField("capacity", e.target.value)}
              min="0"
              placeholder="Unlimited"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Order limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Min per Order</label>
              <input
                type="number"
                value={form.minPerOrder}
                onChange={(e) => setField("minPerOrder", e.target.value)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Max per Order <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                value={form.maxPerOrder}
                onChange={(e) => setField("maxPerOrder", e.target.value)}
                min="1"
                placeholder="No max"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setField("active", e.target.checked)}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded"
            />
            <label htmlFor="active" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Active (visible and available for purchase)
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : ticketType ? "Save Changes" : "Add Ticket Type"}
          </button>
        </div>
      </div>
    </div>
  );
}

