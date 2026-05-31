"use client";
/** NewEventModal provides the first-step event creation flow for the Events registry. */

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

/**
 * NewEventModal creates a foundational event record using the current backend schema.
 * Richer setup fields like banner image, dress code, and childcare can layer in later.
 */
export default function NewEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "GALA",
    location: "",
    startDate: "",
    endDate: "",
    registrationGoal: "",
    revenueGoal: "",
    description: "",
    active: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          registrationGoal: form.registrationGoal ? Number(form.registrationGoal) : null,
          revenueGoal: form.revenueGoal ? Number(form.revenueGoal) : null,
        }),
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title="Create Event"
      subtitle="Start the event record, then continue setup for tickets, guests, tables, and sponsors."
      checklist={["Event basics", "Dates and goals", "Create and continue setup"]}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      closeOnBackdropClick
    >
      <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Event name</label>
            <input
              required
              placeholder="Love at First Beat Gala"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Event type</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {["GALA", "AUCTION", "RUN_WALK", "CONFERENCE", "WORKSHOP", "CULTIVATION", "STEWARDSHIP", "VOLUNTEER", "ONLINE", "OTHER"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
            <input
              placeholder="Aurora Event Center"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start date</label>
            <input
              required
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">End date</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Guest capacity goal</label>
            <input
              placeholder="250"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.registrationGoal}
              onChange={(e) => setForm((f) => ({ ...f, registrationGoal: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Revenue goal</label>
            <input
              placeholder="50000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.revenueGoal}
              onChange={(e) => setForm((f) => ({ ...f, revenueGoal: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <textarea
              placeholder="Summarize the fundraiser, audience, and purpose."
              className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">Next step after creation: tickets, orders, guests, tables, sponsors, and check-in.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-60">
              {saving ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
