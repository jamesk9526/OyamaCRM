/**
 * NewGuestModal - add individual guests to events.
 * Supports constituent linking, ticket assignment, and dietary/special needs tracking.
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
  active?: boolean;
}

interface Props {
  eventId: string;
  onClose: () => void;
  onCreated: () => void;
}

/** NewGuestModal creates individual guest records for manual registration or walk-ins. */
export default function NewGuestModal({ eventId, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [constituentSearch, setConstituentSearch] = useState("");
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    ticketTypeId: "",
    dietaryRestrictions: "",
    specialNeeds: "",
    notes: "",
  });

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

  /** Filter constituents by search term */
  const filteredConstituents = constituents.filter((c) =>
    `${getConstituentDisplayName(c)} ${c.email || ""}`.toLowerCase().includes(constituentSearch.toLowerCase())
  );

  /** Handle constituent selection and auto-fill form */
  const handleConstituentSelect = (constituent: Constituent) => {
    setSelectedConstituent(constituent);
    setConstituentSearch("");
    // Auto-fill form with constituent data
    setForm({
      firstName: constituent.firstName,
      lastName: constituent.lastName,
      email: constituent.email || "",
      phone: "",
      ticketTypeId: "",
      dietaryRestrictions: "",
      specialNeeds: "",
      notes: "",
    });
  };

  /** Handle constituent unlink */
  const handleConstituentUnlink = () => {
    setSelectedConstituent(null);
    // Optionally clear the form or leave it as is
  };

  /** Submit the guest */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        body: JSON.stringify({
          constituentId: selectedConstituent?.id || undefined,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          ticketTypeId: form.ticketTypeId || undefined,
          dietaryRestrictions: form.dietaryRestrictions.trim() || undefined,
          specialNeeds: form.specialNeeds.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create guest");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title="Add Guest"
      subtitle="Register event attendees with optional constituent links and ticket assignments."
      checklist={["1. Link or enter guest", "2. Assign ticket details", "3. Save guest"]}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="bg-white w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add Guest</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manual registration, walk-in, or comp guest</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Constituent Link (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Link to Constituent (Optional)
            </label>
            {selectedConstituent ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{getConstituentDisplayName(selectedConstituent)}</p>
                  {selectedConstituent.email && <p className="text-xs text-gray-500">{selectedConstituent.email}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleConstituentUnlink}
                  className="text-xs text-amber-600 hover:text-amber-700"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search constituents by name or email..."
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
                        onClick={() => handleConstituentSelect(c)}
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

          {/* Guest Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Ticket Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ticket Type</label>
            <select
              value={form.ticketTypeId}
              onChange={(e) => setForm({ ...form, ticketTypeId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">None / Walk-in</option>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} - ${Number(t.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Dietary & Special Needs */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Dietary Restrictions</label>
            <input
              type="text"
              value={form.dietaryRestrictions}
              onChange={(e) => setForm({ ...form, dietaryRestrictions: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="Vegetarian, gluten-free, nut allergy, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Special Needs / Accessibility</label>
            <input
              type="text"
              value={form.specialNeeds}
              onChange={(e) => setForm({ ...form, specialNeeds: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="Wheelchair access, ASL interpreter, etc."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none"
              placeholder="VIP guest, staff comp, seating preference..."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Adding..." : "Add Guest"}
          </button>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
