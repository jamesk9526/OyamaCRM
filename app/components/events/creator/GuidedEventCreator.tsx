"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Plus, RefreshCw } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import EventPageBuilderShell, { type EventPageBuilderHandle } from "@/app/components/events/page-builder/EventPageBuilderShell";
import type { EventPageBuilderConfig, EventPagePaymentPolicy } from "@/app/components/events/page-builder/types";
import { creatorInput, defaultCreationTicket, EventDetailsFields, eventDetailsPayload, saveEventTicket, TicketFields, toLocalEventDate, type EventDetailsFieldsValue, type TicketFormValue } from "./event-forms";

import { useUnsavedEventChanges } from "./useUnsavedEventChanges";

type Step = "details" | "registration" | "design" | "review";
interface Readiness { ready: boolean; checks: { id: string; label: string; passed: boolean; step: Step }[]; warnings: string[]; nextStep: Step }
interface EventRecord extends EventDetailsFieldsValue { id: string; type: string; active: boolean; visibility: string; registrationDeadline?: string | null; capacity?: number | null }
interface TicketRecord { id: string; name: string; description?: string | null; price: number | string; capacity?: number | null; isTable: boolean; seatsIncluded: number; minPerOrder: number; maxPerOrder?: number | null; active: boolean }
interface TicketDraft extends TicketFormValue { key: string; id?: string }
const steps: { id: Step; label: string; description: string }[] = [
  { id: "details", label: "Details", description: "Tell guests what, when, and where." },
  { id: "registration", label: "Registration", description: "Choose tickets and how guests will pay." },
  { id: "design", label: "Design", description: "Make your event page ready to share." },
  { id: "review", label: "Review & publish", description: "Check the guest experience before going live. Publishing makes the page public and opens registration for a draft event." },
];
const emptyDetails: EventDetailsFieldsValue = { name: "", description: "", startDate: "", endDate: "", location: "", address: "", city: "", state: "", zip: "", virtualUrl: "" };
function ticketDraft(ticket: TicketRecord): TicketDraft {
  return { key: ticket.id, id: ticket.id, name: ticket.name, description: ticket.description ?? "", price: String(ticket.price), capacity: ticket.capacity == null ? "" : String(ticket.capacity), isTable: ticket.isTable, seatsIncluded: String(ticket.seatsIncluded), minPerOrder: String(ticket.minPerOrder), maxPerOrder: ticket.maxPerOrder == null ? "" : String(ticket.maxPerOrder), active: ticket.active };
}

export default function GuidedEventCreator({ eventId: initialId }: { eventId?: string }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const query = useSearchParams();
  const requestedStep = query.get("step");
  const [step, setStep] = useState<Step>("details");
  const [eventId, setEventId] = useState(initialId);
  const createdId = useRef(initialId);
  const [details, setDetails] = useState(emptyDetails);
  const [mode, setMode] = useState("STANDARD");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [active, setActive] = useState(true);
  const [tickets, setTickets] = useState<TicketDraft[]>([{ ...defaultCreationTicket, key: "suggestion" }]);
  const ticketsRef = useRef(tickets);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  const [policy, setPolicy] = useState<EventPagePaymentPolicy | "">("");
  const [deadline, setDeadline] = useState("");
  const [capacity, setCapacity] = useState("");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [registrationDirty, setRegistrationDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [pageConfig, setPageConfig] = useState<EventPageBuilderConfig | null>(null);
  const [reload, setReload] = useState(0);
  const builder = useRef<EventPageBuilderHandle>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!initialId) return;
    let current = true;
    setLoading(true);
    setError("");
    void Promise.all([
      apiFetch<EventRecord>(`/api/events/${initialId}`),
      apiFetch<TicketRecord[]>(`/api/events/${initialId}/ticket-types`),
      apiFetch<EventPageBuilderConfig>(`/api/events/${initialId}/page-builder-config`),
      apiFetch<Readiness>(`/api/events/${initialId}/creation-readiness`),
    ]).then(([event, ticketList, config, ready]) => {
      if (!current) return;
      if (config.status === "Published") { router.replace(`/events/${initialId}/event-page`); return; }
      setEventId(initialId); createdId.current = initialId;
      setDetails({ ...event, startDate: toLocalEventDate(event.startDate), endDate: toLocalEventDate(event.endDate) });
      setMode(event.type === "TRIVIA" ? "TRIVIA" : "STANDARD");
      setVisibility(event.visibility); setActive(event.active);
      setTickets(ticketList.length ? ticketList.map(ticketDraft) : [{ ...defaultCreationTicket, key: "suggestion" }]);
      // Config GET supplies a fallback policy; only a saved choice counts as explicit.
      setPolicy(ready.checks.find((check) => check.id === "policy")?.passed ? config.paymentPolicy : "");
      setDeadline(toLocalEventDate(event.registrationDeadline)); setCapacity(event.capacity == null ? "" : String(event.capacity));
      setPageConfig(config); setReadiness(ready);
      setStep(steps.some((item) => item.id === requestedStep) ? requestedStep as Step : ready.nextStep);
      setDetailsDirty(false); setRegistrationDirty(false);
    }).catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "The event could not be loaded."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
    // Query changes are handled without reloading unsaved form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, reload, router]);

  useEffect(() => { if (eventId && steps.some((item) => item.id === requestedStep)) setStep(requestedStep as Step); }, [eventId, requestedStep]);
  useEffect(() => { heading.current?.focus(); }, [step, loading]);

  const dirty = detailsDirty || registrationDirty;
  const busy = saving || navigating;
  useUnsavedEventChanges(dirty, "Leave without saving your changes?");

  const loadReview = useCallback(async (id: string) => {
    const [ready, config] = await Promise.all([apiFetch<Readiness>(`/api/events/${id}/creation-readiness`), apiFetch<EventPageBuilderConfig>(`/api/events/${id}/page-builder-config`)]);
    setReadiness(ready); setPageConfig(config);
  }, []);
  useEffect(() => { if (step === "review" && eventId) { setReadiness(null); void loadReview(eventId).catch((reason) => setError(reason instanceof Error ? reason.message : "Launch checks failed.")); } }, [step, eventId, loadReview]);

  async function saveCurrent(exit: boolean) {
    if ((step === "details" || step === "registration") && !form.current?.reportValidity()) throw new Error("Check the highlighted fields.");
    let id = createdId.current;
    if (step === "details" || detailsDirty) {
      const payload = { ...eventDetailsPayload(details), visibility, active };
      if (!id) {
        const event = await apiFetch<EventRecord>("/api/events", { method: "POST", body: JSON.stringify({ ...payload, mode, type: mode === "TRIVIA" ? "TRIVIA" : "OTHER", status: "DRAFT" }) });
        id = event.id; createdId.current = id; setEventId(id);
      } else await apiFetch(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setDetailsDirty(false);
    }
    if (!id) throw new Error("Save the event details first.");
    if (step === "registration" || registrationDirty) {
      if (!exit && !policy) throw new Error("Choose how guests will pay.");
      if (policy === "NoPaymentRequired" && tickets.some((ticket) => ticket.active && Number(ticket.price) > 0)) throw new Error("Free registration requires all active ticket prices to be zero.");
      if (!exit && !tickets.some((ticket) => ticket.active)) throw new Error("Add an active ticket before continuing.");
      // Keep IDs immediately: if a later write fails, retry updates these records.
      for (const ticket of ticketsRef.current) {
        if (!ticket.name.trim() || !ticket.price.trim() || !ticket.minPerOrder.trim() || (ticket.isTable && !ticket.seatsIncluded.trim())) throw new Error("Complete the required ticket fields before saving.");
        const saved = await saveEventTicket<TicketRecord>(id, ticket, ticket.id);
        ticketsRef.current = ticketsRef.current.map((item) => item.key === ticket.key ? { ...item, id: saved.id } : item);
        setTickets(ticketsRef.current);
      }
      await apiFetch(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify({ registrationDeadline: deadline ? new Date(deadline).toISOString() : null, capacity: capacity === "" ? null : Number(capacity) }) });
      if (policy) await apiFetch(`/api/events/${id}/page-builder-config`, { method: "PATCH", body: JSON.stringify({ paymentPolicy: policy }) });
      setRegistrationDirty(false);
    }
    if (step === "design" || step === "review") {
      if (!builder.current) throw new Error("Wait for the page editor to load.");
      await builder.current.flush();
    }
    return id;
  }

  async function navigate(next?: Step, exit = false) {
    if (savingRef.current || navigating) return;
    // Earlier form steps can be revisited without discarding unfinished input.
    // Save & continue / exit commits all dirty forms, including retained input.
    if (next && steps.findIndex((item) => item.id === next) < steps.findIndex((item) => item.id === step) && (step === "details" || step === "registration")) {
      setError("");
      startNavigation(() => router.replace(`/events/${eventId}/create?step=${next}`, { scroll: false }));
      return;
    }
    savingRef.current = true; setSaving(true); setError("");
    try {
      const id = await saveCurrent(exit);
      if (exit) { startNavigation(() => router.push(`/events/${id}/overview`)); return; }
      const target = next ?? steps[Math.min(steps.findIndex((item) => item.id === step) + 1, 3)].id;
      startNavigation(() => router.replace(`/events/${id}/create?step=${target}`, { scroll: false }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Changes could not be saved. Try again."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function publish() {
    if (savingRef.current || !eventId) return;
    savingRef.current = true; setSaving(true); setError("");
    try {
      if (!builder.current) throw new Error("Wait for the preview to load.");
      await builder.current.publish();
      await loadReview(eventId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Publishing failed. Your draft is saved."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 p-6" role="status" aria-label="Loading event creator"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (initialId && !pageConfig) return <div className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Creator unavailable</h1><p role="alert" className="my-4 text-red-700">{error}</p><button className="event-industrial-secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>;
  const index = steps.findIndex((item) => item.id === step);
  const published = pageConfig?.status === "Published";
  return <div className="min-h-full bg-slate-50 text-slate-950">
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/events/events" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />All events</Link><h1 className="mt-3 text-2xl font-semibold tracking-tight">{eventId ? details.name : "Create your event"}</h1><p className="mt-1 text-sm text-slate-500">Build a registration page your guests can use.</p></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{published ? "Published" : "Draft · private until published"}</span></header>
      <nav className="my-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Event creation steps">{steps.map((item, position) => <button key={item.id} type="button" disabled={busy || (!eventId && position > 0) || published} aria-current={step === item.id ? "step" : undefined} onClick={() => { if (item.id !== step) void navigate(item.id); }} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${step === item.id ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${step === item.id ? "bg-blue-600 text-white" : "bg-slate-100"}`}>{position + 1}</span>{item.label}</button>)}</nav>
      <p role="status" className="mb-3 text-xs text-slate-500">{busy ? "Saving your changes…" : dirty ? "Unsaved form changes" : eventId ? "Saved draft" : "Your event will be saved when you continue."}</p>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{steps[index].label}</h2><p className="mb-5 mt-1 text-sm text-slate-500">{steps[index].description}</p>
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}{step === "review" ? <button type="button" className="ml-3 underline" onClick={() => eventId && void loadReview(eventId).catch((reason) => setError(String(reason)))}>Retry checks</button> : null}</div> : null}
      <form ref={form} onSubmit={(event) => { event.preventDefault(); void navigate(); }}>
        <fieldset disabled={busy || published} className="min-w-0">
          {step === "details" ? <section className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <fieldset className="mb-6"><legend className="mb-2 text-sm font-semibold">Event format</legend><div className="grid gap-2 sm:grid-cols-2">{[{ value: "STANDARD", label: "Standard event", helper: "Tickets, guests, and event-day tools" }, { value: "TRIVIA", label: "Trivia night", helper: "Event tools plus game builder and live trivia" }].map((item) => <label key={item.value} className={`cursor-pointer rounded-xl border p-4 ${mode === item.value ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}><span className="flex items-center gap-2"><input type="radio" name="event-mode" checked={mode === item.value} disabled={Boolean(eventId)} onChange={() => { setMode(item.value); setDetailsDirty(true); }} /><strong className="text-sm">{item.label}</strong></span><span className="mt-1 block text-xs text-slate-500">{item.helper}</span></label>)}</div>{eventId ? <p className="mt-2 text-xs text-slate-500">Event format is fixed after creation.</p> : null}</fieldset>
            <EventDetailsFields value={details} onChange={(value) => { setDetails(value); setDetailsDirty(true); }} />
            {eventId ? <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-blue-700">Event availability</summary><label className="mt-3 block text-sm">Visibility<select className={creatorInput} value={visibility} onChange={(event) => { setVisibility(event.target.value); setDetailsDirty(true); }}><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option><option value="INVITE_ONLY">Invite only</option></select></label><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => { setActive(event.target.checked); setDetailsDirty(true); }} />Event is active</label></details> : null}
          </section> : null}
          {step === "registration" ? <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4"><h3 className="font-semibold">Tickets and table packages</h3>{tickets.map((ticket, position) => <article key={ticket.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Option {position + 1}</span>{!ticket.id && tickets.length > 1 ? <button type="button" className="text-sm text-red-700" onClick={() => { setTickets((current) => current.filter((item) => item.key !== ticket.key)); setRegistrationDirty(true); }}>Remove</button> : null}</div><TicketFields value={ticket} onChange={(value) => { setTickets((current) => current.map((item) => item.key === ticket.key ? { ...item, ...value } : item)); setRegistrationDirty(true); }} /></article>)}<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-blue-50" onClick={() => { setTickets((current) => [...current, { ...defaultCreationTicket, name: "", key: crypto.randomUUID() }]); setRegistrationDirty(true); }}><Plus className="h-4 w-4" />Add ticket or table package</button></section>
            <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Registration settings</h3><label className="block text-sm font-medium">How will guests pay?<select className={creatorInput} value={policy} onChange={(event) => { setPolicy(event.target.value as EventPagePaymentPolicy); setRegistrationDirty(true); }}><option value="">Choose a payment option</option><option value="NoPaymentRequired">Free — no payment required</option><option value="StripeCheckout">Online — Stripe checkout</option><option value="PayAtEvent">Pay at the event</option><option value="OfflineFollowUp">Offline payment follow-up</option></select></label><p className="text-xs leading-5 text-slate-500">Online payments require configured Stripe checkout and payment confirmation. Free registration requires zero-priced tickets.</p><label className="block text-sm font-medium">Registration deadline (optional)<input type="datetime-local" className={creatorInput} max={details.startDate} value={deadline} onChange={(event) => { setDeadline(event.target.value); setRegistrationDirty(true); }} /></label><label className="block text-sm font-medium">Maximum guests (optional)<input type="number" min="0" max="1000000" className={creatorInput} value={capacity} onChange={(event) => { setCapacity(event.target.value); setRegistrationDirty(true); }} /></label></aside>
          </div> : null}
        </fieldset>
      </form>
      {step === "review" ? <section className="mb-5 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Ready for guests</h3><p className="mt-2 text-sm text-slate-600">{details.name} · {new Date(details.startDate).toLocaleString()}<br />{details.location || details.virtualUrl || "Location not specified"}</p><ul className="mt-3 space-y-2 text-sm">{tickets.filter((ticket) => ticket.active).map((ticket) => <li key={ticket.key}>{ticket.name} · {Number(ticket.price).toLocaleString("en-US", { style: "currency", currency: pageConfig?.currency ?? "USD" })}{ticket.isTable ? ` · ${ticket.seatsIncluded} seats` : ""}</li>)}</ul><p className="mt-3 text-sm text-slate-600">Payment: {policy === "NoPaymentRequired" ? "Free registration" : policy === "StripeCheckout" ? "Stripe checkout" : policy === "PayAtEvent" ? "Pay at event" : "Offline follow-up"}</p><p className="mt-2 break-all text-sm text-slate-500">Public address: {pageConfig?.pageUrl}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Launch checks</h3><button type="button" disabled={busy || published} className="text-sm font-semibold text-blue-700" onClick={() => eventId && void loadReview(eventId).catch((reason) => setError(String(reason)))}>Refresh checks</button></div>{readiness ? <ul className="mt-3 space-y-2">{readiness.checks.map((check) => <li key={check.id}><button type="button" disabled={busy || published} onClick={() => void navigate(check.step)} className="flex min-h-9 items-center gap-2 text-left text-sm hover:text-blue-700">{check.passed ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-amber-600" />}{check.label}{!check.passed ? <ArrowRight className="h-4 w-4" /> : null}</button></li>)}</ul> : <p role="status" className="mt-3 text-sm text-slate-500">Checking readiness…</p>}{readiness?.warnings.map((warning) => <p key={warning} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>)}</div></section> : null}
      {(step === "design" || step === "review") && eventId ? <div className={step === "design" ? "h-[760px] min-h-[600px] overflow-hidden rounded-2xl border border-slate-200" : "overflow-hidden rounded-2xl border border-slate-200"} inert={busy || published}><EventPageBuilderShell ref={builder} eventId={eventId} creatorStage={step} /></div> : null}
      {published ? <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6" role="status"><h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-900"><CheckCircle2 className="h-5 w-5" />Your event page is live</h2><div className="mt-4 flex flex-wrap gap-4"><a className="font-semibold text-blue-700 underline" href={pageConfig?.pageUrl} target="_blank" rel="noreferrer">View live event page</a><Link className="font-semibold text-blue-700 underline" href={`/events/${eventId}/overview`}>Open event overview</Link></div></section> : <footer className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 py-4 backdrop-blur"><div className="flex gap-3">{index > 0 ? <button disabled={busy} type="button" onClick={() => void navigate(steps[index - 1].id)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Back</button> : null}<button disabled={busy} type="button" onClick={() => void navigate(undefined, true)} className="min-h-11 px-3 text-sm font-semibold text-slate-600 disabled:opacity-50">Save & exit</button></div><button type="button" disabled={busy || (step === "review" && !readiness?.ready)} onClick={() => step === "review" ? void publish() : void navigate()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : step === "review" ? "Publish event page" : step === "design" ? "Save & review" : "Save & continue"}<ArrowRight className="h-4 w-4" /></button></footer>}
    </div>
  </div>;
}
