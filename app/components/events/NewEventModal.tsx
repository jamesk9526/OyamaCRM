"use client";
/** NewEventModal provides the first-step event creation flow for the Events registry. */

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Event</h2>
            <p className="text-xs text-gray-400 mt-0.5">Start the event record, then continue in setup.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Event name</label>
            <input required placeholder="Love at First Beat Gala"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Event type</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {["GALA", "AUCTION", "RUN_WALK", "CONFERENCE", "WORKSHOP", "CULTIVATION", "STEWARDSHIP", "VOLUNTEER", "ONLINE", "OTHER"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <input placeholder="Aurora Event Center"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
            <input required type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
            <input type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Guest capacity goal</label>
            <input placeholder="250"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.registrationGoal} onChange={(e) => setForm((f) => ({ ...f, registrationGoal: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Revenue goal</label>
            <input placeholder="50000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.revenueGoal} onChange={(e) => setForm((f) => ({ ...f, revenueGoal: e.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea placeholder="Summarize the fundraiser, audience, and purpose."
              className="w-full min-h-[100px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">Next step after creation: tickets, orders, guests, tables, sponsors, and check-in.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
            <button disabled={saving} className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60">
              {saving ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
