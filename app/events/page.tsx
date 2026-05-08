"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventItem {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  registrationGoal?: number | null;
  active: boolean;
  _count?: { attendances: number; volunteerHours: number };
}

function badge(type: string) {
  switch (type) {
    case "GALA": return "bg-purple-50 text-purple-700";
    case "VOLUNTEER": return "bg-green-50 text-green-700";
    case "WORKSHOP": return "bg-blue-50 text-blue-700";
    case "ONLINE": return "bg-cyan-50 text-cyan-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

/** Events page backed by /api/events with create flow and real attendance counts. */
export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<EventItem[]>("/api/events");
      setEvents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = events.filter((e) => e.active).length;
  const totalAttendance = events.reduce((sum, e) => sum + (e._count?.attendances ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan fundraising and volunteer events with live attendance tracking</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          + New Event
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Events" value={events.length} />
        <Stat label="Active Events" value={activeCount} green />
        <Stat label="Total Attendees" value={totalAttendance} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl py-16 text-center">
          <p className="text-sm text-gray-500">No events yet. Create your first event.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const attendeeCount = event._count?.attendances ?? 0;
            const goal = event.registrationGoal ?? 0;
            const pct = goal > 0 ? Math.min(100, Math.round((attendeeCount / goal) * 100)) : 0;
            return (
              <div key={event.id} className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{event.name}</h3>
                  <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-xs font-medium ${badge(event.type)}`}>{event.type}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{event.description || "No description provided."}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <p className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location || "No location set"}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{attendeeCount} attendees</span>
                    <span>{goal > 0 ? `${pct}% of ${goal}` : "No goal set"}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <NewEventModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function Stat({ label, value, green }: { label: string; value: number; green?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${green ? "text-green-600" : "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function NewEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "OTHER",
    location: "",
    startDate: "",
    endDate: "",
    registrationGoal: "",
    description: "",
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
        }),
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Create Event</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <input required placeholder="Event name" className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {["GALA", "AUCTION", "WORKSHOP", "VOLUNTEER", "ONLINE", "OTHER"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Location" className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          <input required type="datetime-local" className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          <input type="datetime-local" className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          <input placeholder="Registration goal" className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.registrationGoal} onChange={(e) => setForm((f) => ({ ...f, registrationGoal: e.target.value }))} />
          <textarea placeholder="Description" className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Cancel</button>
          <button disabled={saving} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
            {saving ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
