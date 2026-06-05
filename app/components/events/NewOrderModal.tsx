/**
 * NewOrderModal - manual order entry for offline registrations.
 * Supports cash/check/phone orders with payment status and constituent linking.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";

interface Constituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  available?: number;
  active?: boolean;
}

interface OrderItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Props {
  eventId: string;
  onClose: () => void;
  onCreated: () => void;
}

/** NewOrderModal creates manual event orders for offline purchases. */
export default function NewOrderModal({ eventId, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [constituentSearch, setConstituentSearch] = useState("");
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [status, setStatus] = useState("PENDING");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState("");

  /** Load constituents and ticket types on mount */
  useEffect(() => {
    async function load() {
      try {
        const [consData, ticketData] = await Promise.all([
          apiFetch("/api/constituents"),
          apiFetch(`/api/events/${eventId}/ticket-types`),
        ]);
        setConstituents(consData as Constituent[]);
        setTicketTypes((ticketData as TicketType[]).filter((t) => t.active));
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }
    load();
  }, [eventId]);

  /** Add a ticket type to the order */
  function addItem(ticketTypeId: string) {
    const ticketType = ticketTypes.find((t) => t.id === ticketTypeId);
    if (!ticketType) return;

    const existing = items.find((i) => i.ticketTypeId === ticketTypeId);
    if (existing) {
      setItems(items.map((i) =>
        i.ticketTypeId === ticketTypeId
          ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
          : i
      ));
    } else {
      setItems([
        ...items,
        {
          ticketTypeId,
          quantity: 1,
          unitPrice: Number(ticketType.price),
          totalPrice: Number(ticketType.price),
        },
      ]);
    }
  }

  /** Remove item from order */
  function removeItem(ticketTypeId: string) {
    setItems(items.filter((i) => i.ticketTypeId !== ticketTypeId));
  }

  /** Update item quantity */
  function updateQuantity(ticketTypeId: string, quantity: number) {
    setItems(items.map((i) =>
      i.ticketTypeId === ticketTypeId
        ? { ...i, quantity, totalPrice: quantity * i.unitPrice }
        : i
    ));
  }

  /** Calculate total order amount */
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  /** Filter constituents by search term */
  const filteredConstituents = constituents.filter((c) =>
    `${getConstituentDisplayName(c)} ${c.email || ""}`.toLowerCase().includes(constituentSearch.toLowerCase())
  );

  /** Submit the order */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConstituent || items.length === 0) {
      setError("Select a constituent and add at least one ticket");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/events/${eventId}/orders`, {
        method: "POST",
        body: JSON.stringify({
          constituentId: selectedConstituent.id,
          items,
          paymentMethod,
          status,
          notes: notes || undefined,
          paidAt: paidAt || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title="Create Manual Order"
      subtitle="Capture offline event registrations with ticket line items and payment tracking."
      checklist={["1. Choose purchaser", "2. Add tickets", "3. Confirm payment and save"]}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <form onSubmit={handleSubmit} className="bg-white w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Manual Order</h2>
            <p className="text-xs text-gray-500 mt-0.5">Cash, check, phone, or door registrations</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Constituent Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Purchaser (Constituent) *</label>
            {selectedConstituent ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{getConstituentDisplayName(selectedConstituent)}</p>
                  {selectedConstituent.email && <p className="text-xs text-gray-500">{selectedConstituent.email}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedConstituent(null)}
                  className="text-xs text-amber-600 hover:text-amber-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={constituentSearch}
                  onChange={(e) => setConstituentSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {constituentSearch && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredConstituents.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedConstituent(c);
                          setConstituentSearch("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{getConstituentDisplayName(c)}</p>
                        {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                      </button>
                    ))}
                    {filteredConstituents.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No matches found</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ticket Items */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Tickets *</label>
            {items.length > 0 && (
              <div className="space-y-2 mb-3">
                {items.map((item) => {
                  const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId);
                  return (
                    <div key={item.ticketTypeId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <p className="flex-1 text-sm font-medium text-gray-900">{ticketType?.name}</p>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.ticketTypeId, Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <p className="w-20 text-sm text-gray-700 text-right">${item.totalPrice.toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.ticketTypeId)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addItem(e.target.value);
                  e.target.value = "";
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">+ Add ticket type</option>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} - ${Number(t.price).toFixed(2)}
                  {t.available !== undefined && ` (${t.available} available)`}
                </option>
              ))}
            </select>
          </div>

          {/* Total Amount */}
          {items.length > 0 && (
            <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-900">Total Amount</p>
              <p className="text-lg font-bold text-amber-700">${totalAmount.toFixed(2)}</p>
            </div>
          )}

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="CHECK">Check</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="ACH">ACH</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed / Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Paid Date */}
          {status === "CONFIRMED" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Paid Date</label>
              <input
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none"
              placeholder="Payment reference, check number, special instructions..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            type="submit"
            disabled={saving || !selectedConstituent || items.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Creating..." : "Create Order"}
          </button>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
