/** Canonical, persisted event settings workspace. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, RefreshCw, Save, TriangleAlert } from "lucide-react";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";

interface EventSettingsRecord {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  visibility: string;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  virtualUrl?: string | null;
  startDate: string;
  endDate?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  registrationGoal?: number | null;
  revenueGoal?: number | string | null;
  internalNotes?: string | null;
  active: boolean;
}

type EventSettingsForm = Omit<EventSettingsRecord, "id" | "type" | "active" | "capacity" | "registrationGoal" | "revenueGoal"> & {
  capacity: string;
  registrationGoal: string;
  revenueGoal: string;
};

const inputClass = "mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600";

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toForm(event: EventSettingsRecord): EventSettingsForm {
  return {
    name: event.name,
    description: event.description ?? "",
    status: event.status,
    visibility: event.visibility,
    location: event.location ?? "",
    address: event.address ?? "",
    city: event.city ?? "",
    state: event.state ?? "",
    zip: event.zip ?? "",
    virtualUrl: event.virtualUrl ?? "",
    startDate: toLocalDateTime(event.startDate),
    endDate: toLocalDateTime(event.endDate),
    registrationDeadline: toLocalDateTime(event.registrationDeadline),
    capacity: event.capacity == null ? "" : String(event.capacity),
    registrationGoal: event.registrationGoal == null ? "" : String(event.registrationGoal),
    revenueGoal: event.revenueGoal == null ? "" : String(event.revenueGoal),
    internalNotes: event.internalNotes ?? "",
  };
}

/** Edits the Event record directly; provider configuration lives in global settings. */
export default function EventSettingsPage() {
  const { eventId = "" } = useParams<{ eventId?: string }>();
  const [record, setRecord] = useState<EventSettingsRecord | null>(null);
  const [form, setForm] = useState<EventSettingsForm | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const next = await apiFetch<EventSettingsRecord>(`/api/events/${eventId}`);
      setRecord(next);
      setForm(toForm(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Event settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [eventId]);
  const dirty = useMemo(() => Boolean(record && form && JSON.stringify(form) !== JSON.stringify(toForm(record))), [form, record]);

  function patch<K extends keyof EventSettingsForm>(field: K, value: EventSettingsForm[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current);
    setMessage("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !eventId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch<EventSettingsRecord>(`/api/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          description: form.description?.trim() || null,
          location: form.location?.trim() || null,
          address: form.address?.trim() || null,
          city: form.city?.trim() || null,
          state: form.state?.trim() || null,
          zip: form.zip?.trim() || null,
          virtualUrl: form.virtualUrl?.trim() || null,
          internalNotes: form.internalNotes?.trim() || null,
          endDate: form.endDate || null,
          registrationDeadline: form.registrationDeadline || null,
          capacity: form.capacity === "" ? null : Number(form.capacity),
          registrationGoal: form.registrationGoal === "" ? null : Number(form.registrationGoal),
          revenueGoal: form.revenueGoal === "" ? null : Number(form.revenueGoal),
        }),
      });
      setRecord(updated);
      setForm(toForm(updated));
      setMessage("Event settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Event settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!eventId) return <RequireEventSelectionNotice tool="event settings" />;
  if (loading) return <div className="mx-auto max-w-6xl space-y-4 p-5 sm:p-8"><div className="h-28 animate-pulse rounded-md bg-slate-200" /><div className="h-96 animate-pulse rounded-md bg-slate-200" /></div>;
  if (!form || !record) return <div className="mx-auto max-w-3xl p-5 sm:p-8"><section className="event-industrial-panel p-6"><TriangleAlert className="h-6 w-6 text-amber-700" /><h1 className="mt-3 text-xl font-semibold">Settings unavailable</h1><p className="mt-2 text-sm text-slate-600">{error || "This event could not be loaded."}</p><button type="button" onClick={() => void load()} className="event-industrial-secondary mt-5"><RefreshCw className="h-4 w-4" />Try again</button></section></div>;

  return (
    <form onSubmit={save} className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="event-industrial-page-header">
        <div className="min-w-0"><p className="event-industrial-kicker">Configuration / {record.type === "TRIVIA" ? "Trivia Night" : "Event"}</p><h1>Event settings</h1><p>Canonical details used by registration, public pages, staff tools, and event-night stations.</p></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2"><span className={`event-industrial-state ${dirty ? "is-warning" : "is-ready"}`}>{dirty ? "Unsaved changes" : "Saved"}</span><button type="submit" disabled={saving || !dirty || !form.name.trim() || !form.startDate} className="event-industrial-primary"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save settings"}</button></div>
      </header>

      {error ? <div className="flex gap-3 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div> : null}
      {message ? <div className="flex gap-3 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status"><Check className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="event-industrial-panel p-5 sm:p-6">
          <div className="event-industrial-section-heading"><div><p>01 / Identity</p><h2>Public event details</h2></div><span>{record.type.replaceAll("_", " ")}</span></div>
          <div className="mt-5 grid gap-5">
            <label className={labelClass}>Event name<input required maxLength={160} value={form.name} onChange={(event) => patch("name", event.target.value)} className={inputClass} /></label>
            <label className={labelClass}>Description<textarea rows={4} maxLength={10_000} value={form.description ?? ""} onChange={(event) => patch("description", event.target.value)} className={`${inputClass} resize-y py-3`} /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Lifecycle<select value={form.status} onChange={(event) => patch("status", event.target.value)} className={inputClass}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="REGISTRATION_OPEN">Registration open</option><option value="REGISTRATION_CLOSED">Registration closed</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label><label className={labelClass}>Visibility<select value={form.visibility} onChange={(event) => patch("visibility", event.target.value)} className={inputClass}><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option><option value="INVITE_ONLY">Invite only</option></select></label></div>
          </div>
        </section>

        <section className="event-industrial-panel p-5 sm:p-6">
          <div className="event-industrial-section-heading"><div><p>02 / Schedule</p><h2>Operating window</h2></div></div>
          <div className="mt-5 grid gap-4"><label className={labelClass}>Starts<input required type="datetime-local" value={form.startDate} onChange={(event) => patch("startDate", event.target.value)} className={inputClass} /></label><label className={labelClass}>Ends<input type="datetime-local" min={form.startDate} value={form.endDate ?? ""} onChange={(event) => patch("endDate", event.target.value)} className={inputClass} /></label><label className={labelClass}>Registration deadline<input type="datetime-local" max={form.startDate} value={form.registrationDeadline ?? ""} onChange={(event) => patch("registrationDeadline", event.target.value)} className={inputClass} /></label></div>
        </section>

        <section className="event-industrial-panel p-5 sm:p-6">
          <div className="event-industrial-section-heading"><div><p>03 / Venue</p><h2>Location and access</h2></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={`${labelClass} sm:col-span-2`}>Venue name<input maxLength={255} value={form.location ?? ""} onChange={(event) => patch("location", event.target.value)} className={inputClass} /></label><label className={`${labelClass} sm:col-span-2`}>Street address<input maxLength={255} value={form.address ?? ""} onChange={(event) => patch("address", event.target.value)} className={inputClass} /></label><label className={labelClass}>City<input maxLength={120} value={form.city ?? ""} onChange={(event) => patch("city", event.target.value)} className={inputClass} /></label><div className="grid grid-cols-[1fr_110px] gap-3"><label className={labelClass}>State<input maxLength={80} value={form.state ?? ""} onChange={(event) => patch("state", event.target.value)} className={inputClass} /></label><label className={labelClass}>ZIP<input maxLength={24} value={form.zip ?? ""} onChange={(event) => patch("zip", event.target.value)} className={inputClass} /></label></div><label className={`${labelClass} sm:col-span-2`}>Virtual event URL<input type="url" value={form.virtualUrl ?? ""} onChange={(event) => patch("virtualUrl", event.target.value)} placeholder="https://" className={inputClass} /></label></div>
        </section>

        <section className="event-industrial-panel p-5 sm:p-6">
          <div className="event-industrial-section-heading"><div><p>04 / Targets</p><h2>Capacity and goals</h2></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-1"><label className={labelClass}>Maximum guests<input type="number" min="0" max="1000000" inputMode="numeric" value={form.capacity} onChange={(event) => patch("capacity", event.target.value)} className={inputClass} /></label><label className={labelClass}>Registration goal<input type="number" min="0" max="1000000" inputMode="numeric" value={form.registrationGoal} onChange={(event) => patch("registrationGoal", event.target.value)} className={inputClass} /></label><label className={labelClass}>Revenue goal<input type="number" min="0" max="100000000" step="0.01" inputMode="decimal" value={form.revenueGoal} onChange={(event) => patch("revenueGoal", event.target.value)} className={inputClass} /></label></div>
        </section>
      </div>

      <section className="event-industrial-panel p-5 sm:p-6"><div className="event-industrial-section-heading"><div><p>05 / Internal</p><h2>Staff notes</h2></div><span>Not public</span></div><label className={`${labelClass} mt-5`}>Operational notes<textarea rows={5} maxLength={20_000} value={form.internalNotes ?? ""} onChange={(event) => patch("internalNotes", event.target.value)} className={`${inputClass} resize-y py-3`} /></label></section>
    </form>
  );
}
