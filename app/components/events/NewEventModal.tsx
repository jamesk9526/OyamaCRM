"use client";

import { useState } from "react";
import { CalendarDays, Gamepad2, MapPin, X } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import type { EventItem } from "@/app/components/events/types";

/** Minimal first step: create the Event, then configure the details in its workspace. */
export default function NewEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (event: EventItem) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ mode: "STANDARD", name: "", date: "", time: "18:00", location: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<EventItem>("/api/events", { method: "POST", body: JSON.stringify({ name: form.name.trim(), type: form.mode === "TRIVIA" ? "TRIVIA" : "OTHER", mode: form.mode, location: form.location.trim() || null, startDate: `${form.date}T${form.time}`, active: true }) });
      // Trivia configuration is created in the same server transaction as the Event.
      // Keeping this a single request prevents a failed second call from leaving a
      // hidden duplicate Event that staff cannot safely retry.
      onCreated(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The event could not be created.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/35 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="new-event-title">
      <button type="button" className="fixed inset-0 cursor-default" onClick={onClose} aria-label="Close new event" />
      <form onSubmit={submit} className="relative my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7"><div><h2 id="new-event-title" className="text-xl font-semibold tracking-tight">Create an event</h2><p className="mt-1 text-sm text-slate-500">Start with the basics. Registration, pricing, tables, and other setup come next.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></header>
        <div className="space-y-5 px-5 py-5 sm:px-7">
          <fieldset><legend className="mb-2 text-sm font-semibold">What are you creating?</legend><div className="grid gap-2 sm:grid-cols-2">
            {([{ value: "STANDARD", label: "Standard event", detail: "Registration, guests, tables, and event-day tools", icon: CalendarDays }, { value: "TRIVIA", label: "Trivia night", detail: "The same event tools, plus game builder and live trivia", icon: Gamepad2 }] as const).map((option) => { const Icon = option.icon; const checked = form.mode === option.value; return <label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${checked ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-400"}`}><input type="radio" name="mode" value={option.value} checked={checked} onChange={() => setForm((value) => ({ ...value, mode: option.value }))} className="sr-only" /><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${checked ? "text-blue-700" : "text-slate-500"}`} /><span><strong className="block text-sm">{option.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span></span></label>; })}
          </div></fieldset>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Event name</span><input autoFocus required maxLength={160} value={form.name} onChange={(input) => setForm((value) => ({ ...value, name: input.target.value }))} placeholder={form.mode === "TRIVIA" ? "Trivia Night Fundraiser" : "Annual Banquet"} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-sm font-semibold">Date</span><input required type="date" value={form.date} onChange={(input) => setForm((value) => ({ ...value, date: input.target.value }))} className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><label><span className="mb-1.5 block text-sm font-semibold">Start time</span><input required type="time" value={form.time} onChange={(input) => setForm((value) => ({ ...value, time: input.target.value }))} className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label></div>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Location <span className="font-normal text-slate-400">(optional)</span></span><span className="relative block"><MapPin className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input maxLength={255} value={form.location} onChange={(input) => setForm((value) => ({ ...value, location: input.target.value }))} placeholder="Community Center" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></span></label>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7"><button type="button" onClick={onClose} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Cancel</button><button disabled={saving || !form.name.trim() || !form.date || !form.time} className="min-h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Creating…" : "Create event"}</button></footer>
      </form>
    </div>
  );
}
