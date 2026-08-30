/** Focused public checkout for durable Event orders and Stripe handoff. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronDown, LockKeyhole, MapPin, Printer } from "lucide-react";
import type { EventBuilderEventDetail, EventBuilderTicketType, EventPageBranding, EventPagePaymentPolicy } from "@/app/components/events/page-builder/types";

interface PublicEventRegistrationFormProps {
  pageSlug?: string;
  ticketTypes: EventBuilderTicketType[];
  paymentPolicy?: EventPagePaymentPolicy;
  currency?: string;
  event?: EventBuilderEventDetail;
  branding?: EventPageBranding;
  eventImageUrl?: string;
  previewOnly?: boolean;
}

interface RegistrationResult {
  order: { orderNumber: string; status: string; totalAmount: number; ticketType: { name: string } };
  guests: Array<{ firstName?: string | null; lastName?: string | null; checkinCode?: string | null }>;
  table?: { id: string; name: string; tableNumber: number; capacity: number; hostName?: string | null } | null;
  message: string;
  email?: { status: "sent" | "skipped" | "failed"; detail: string };
  payment?: { required: boolean; provider: "stripe" | "offline" | "none"; checkoutUrl: string | null; mode: "sandbox" | "production" | null; error: { code: string; message: string } | null };
  reservationAccess?: { manageUrl: string; pin: string };
}

interface ReservationStatus {
  order: { orderNumber: string; status: string; totalAmount: number; paidAt: string | null };
  event: { name: string; startDate: string; location: string | null };
  guests: Array<{ firstName: string | null; lastName: string | null }>;
}

interface AttendeeDraft { firstName: string; lastName: string; email: string; phone: string; dietaryRestrictions: string; specialNeeds: string }
type PaymentReturnState = "returned" | "cancelled" | null;

const inputClass = "mt-1.5 min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--event-brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--event-brand-primary)_18%,transparent)] disabled:bg-slate-50 disabled:text-slate-500";

function createBlankAttendee(): AttendeeDraft {
  return { firstName: "", lastName: "", email: "", phone: "", dietaryRestrictions: "", specialNeeds: "" };
}

function formatMoney(value: number | string | null | undefined, currency = "USD"): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0.00";
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency.toUpperCase()) ? currency.toUpperCase() : "USD";
  return parsed.toLocaleString(undefined, { style: "currency", currency: normalizedCurrency });
}

function formatEventDate(event?: EventBuilderEventDetail): string {
  if (!event) return "Date to be announced";
  const date = new Date(event.startDate);
  if (Number.isNaN(date.getTime())) return "Date to be announced";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatEventTime(event?: EventBuilderEventDetail): string {
  if (!event) return "";
  const start = new Date(event.startDate);
  if (Number.isNaN(start.getTime())) return "";
  const startLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!event.endDate) return startLabel;
  const end = new Date(event.endDate);
  return Number.isNaN(end.getTime()) ? startLabel : `${startLabel}–${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function storageKey(pageSlug: string | undefined, orderNumber: string): string {
  return `oyama-event-registration:${pageSlug ?? "preview"}:${orderNumber}`;
}

function calendarHref(event?: EventBuilderEventDetail): string {
  if (!event) return "#";
  const compact = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = compact(event.startDate);
  const end = compact(event.endDate || new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000).toISOString());
  const location = [event.location, event.address, event.city, event.state, event.zip].filter(Boolean).join(", ");
  const query = new URLSearchParams({ action: "TEMPLATE", text: event.name, dates: `${start}/${end}`, details: event.description ?? "", location });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

function EventOrderSummary(props: { event?: EventBuilderEventDetail; branding?: EventPageBranding; eventImageUrl?: string; ticket: EventBuilderTicketType | null; quantity: number; total: number; currency?: string }) {
  const location = [props.event?.location, props.event?.city, props.event?.state].filter(Boolean).join(", ");
  return <div className="min-w-0">
    <div className="flex items-start gap-3">
      {props.eventImageUrl ? <img src={props.eventImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" /> : props.branding?.logoSquareUrl || props.branding?.logoUrl ? <img src={props.branding.logoSquareUrl || props.branding.logoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" /> : null}
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Your registration</p><h2 className="mt-1 break-words text-xl font-semibold tracking-[-0.02em] text-slate-950">{props.event?.name || "Event registration"}</h2></div>
    </div>
    <dl className="mt-6 space-y-3 text-sm">
      <div><dt className="sr-only">Date</dt><dd className="flex gap-2 text-slate-700"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{formatEventDate(props.event)}{formatEventTime(props.event) ? <><br />{formatEventTime(props.event)}</> : null}</span></dd></div>
      {location ? <div><dt className="sr-only">Location</dt><dd className="flex gap-2 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{location}</span></dd></div> : null}
    </dl>
    <div className="mt-7 border-t border-slate-200 pt-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm"><div className="min-w-0"><p className="break-words font-medium text-slate-950">{props.ticket?.name || "Select a registration option"}</p>{props.ticket ? <p className="mt-1 break-words text-slate-500">{props.quantity} × {formatMoney(props.ticket.price, props.currency)}{props.ticket.isTable ? ` · ${props.ticket.seatsIncluded ?? 1} seats each` : ""}</p> : null}</div><p className="shrink-0 font-medium text-slate-900">{formatMoney(props.total, props.currency)}</p></div>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-4"><span className="font-semibold text-slate-950">Total due</span><span className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{formatMoney(props.total, props.currency)}</span></div>
    </div>
  </div>;
}

export default function PublicEventRegistrationForm({ pageSlug, ticketTypes, paymentPolicy = "OfflineFollowUp", currency = "USD", event, branding, eventImageUrl, previewOnly = false }: PublicEventRegistrationFormProps) {
  const activeTickets = useMemo(() => ticketTypes.filter((ticket) => ticket.id), [ticketTypes]);
  const [ticketTypeId, setTicketTypeId] = useState(activeTickets[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [tableName, setTableName] = useState("");
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([createBlankAttendee()]);
  const [addGuestsNow, setAddGuestsNow] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [reservation, setReservation] = useState<ReservationStatus | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState>(null);

  const selectedTicket = activeTickets.find((ticket) => ticket.id === ticketTypeId) ?? activeTickets[0] ?? null;
  const requestedTicketUnits = Math.max(1, Math.min(10, Number(quantity) || 1));
  const seatsPerTicket = selectedTicket?.isTable ? Math.max(1, selectedTicket.seatsIncluded ?? 1) : 1;
  const requestedSeats = Math.min(50, requestedTicketUnits * seatsPerTicket);
  const totalAmount = paymentPolicy === "NoPaymentRequired" ? 0 : Number(selectedTicket?.price ?? 0) * requestedTicketUnits;
  const money = (value: number | string | null | undefined) => formatMoney(value, currency);
  const primaryAttendee = attendees[0];
  const canSubmit = Boolean(pageSlug && selectedTicket && primaryAttendee?.firstName.trim() && primaryAttendee.lastName.trim() && primaryAttendee.email.trim() && consentAccepted && !previewOnly);

  useEffect(() => {
    if (!activeTickets.length) return;
    if (!activeTickets.some((ticket) => ticket.id === ticketTypeId)) setTicketTypeId(activeTickets[0].id);
  }, [activeTickets, ticketTypeId]);

  useEffect(() => {
    setAttendees((current) => {
      const next = current.slice(0, requestedSeats);
      while (next.length < requestedSeats) next.push(createBlankAttendee());
      return next;
    });
  }, [requestedSeats]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("registration");
    const orderNumber = params.get("order") ?? "";
    if (state !== "payment-return" && state !== "payment-cancelled") return;
    setPaymentReturn(state === "payment-return" ? "returned" : "cancelled");
    window.requestAnimationFrame(() => document.getElementById("registration")?.scrollIntoView({ block: "start" }));
    if (!orderNumber) return;
    try {
      const saved = window.sessionStorage.getItem(storageKey(pageSlug, orderNumber));
      if (!saved) return;
      const restored = JSON.parse(saved) as RegistrationResult;
      setResult(restored);
      const pin = restored.reservationAccess?.pin;
      if (!pin) return;
      let attempts = 0;
      const refresh = async () => {
        attempts += 1;
        const response = await fetch("/api/events/public/reservation-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, pin }) });
        if (response.ok) {
          const current = await response.json() as ReservationStatus;
          setReservation(current);
          if (!current.order.paidAt && state === "payment-return" && attempts < 6) window.setTimeout(() => void refresh(), 1500);
        }
      };
      void refresh();
    } catch {
      // A missing browser copy never changes the durable server order.
    }
  }, [pageSlug]);

  function updateAttendee(index: number, field: keyof AttendeeDraft, value: string) {
    setAttendees((current) => current.map((attendee, attendeeIndex) => attendeeIndex === index ? { ...attendee, [field]: value } : attendee));
  }

  async function submitRegistration() {
    if (!pageSlug || !selectedTicket || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/events/public/page/${encodeURIComponent(pageSlug)}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketTypeId: selectedTicket.id, quantity: requestedTicketUnits, tableName: selectedTicket.isTable ? tableName.trim() : undefined, consentAccepted, attendees: attendees.slice(0, requestedSeats).map((attendee, index) => index === 0 || addGuestsNow ? attendee : createBlankAttendee()) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Registration could not be completed.");
      const completed = payload as RegistrationResult;
      setResult(completed);
      window.sessionStorage.setItem(storageKey(pageSlug, completed.order.orderNumber), JSON.stringify(completed));
      if (completed.payment?.checkoutUrl) {
        setRedirecting(true);
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        window.location.assign(completed.payment.checkoutUrl);
        return;
      }
    } catch (registrationError) {
      setError(registrationError instanceof TypeError ? "Unable to connect to the registration server. Check your connection and try again." : registrationError instanceof Error ? registrationError.message : "Registration could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (activeTickets.length === 0) return <p className="py-8 text-center text-sm text-slate-500">Registration options are not available yet.</p>;

  if (redirecting) return <section className="mx-auto max-w-xl px-5 py-16 text-center" role="status" aria-live="polite"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100"><LockKeyhole className="h-5 w-5 text-slate-700" /></span><h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Secure payment</h2><p className="mt-2 text-sm text-slate-600">You&apos;ll complete your payment securely through Stripe.</p></section>;

  if (result) {
    const paid = Boolean(reservation?.order.paidAt) || result.order.status === "CONFIRMED" || !result.payment?.required;
    const failed = Boolean(result.payment?.error);
    const cancelled = !paid && paymentReturn === "cancelled";
    const pending = !paid && !failed && !cancelled;
    const displayedGuests = reservation?.guests ?? result.guests;
    const checkoutUrl = result.payment?.checkoutUrl;
    return <section className="mx-auto max-w-3xl bg-white px-5 py-10 text-left sm:px-8 sm:py-14" aria-live="polite">
      <div className={`grid h-12 w-12 place-items-center rounded-full ${paid ? "bg-emerald-100 text-emerald-700" : failed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{paid ? <Check className="h-6 w-6" /> : <LockKeyhole className="h-5 w-5" />}</div>
      <p className="mt-6 text-sm font-semibold text-slate-500">{paid ? "Registration complete · Payment received" : cancelled ? "Registration saved" : failed ? "Payment failed" : "Payment pending"}</p>
      <h2 className="mt-1 break-words text-[clamp(1.75rem,8vw,2.25rem)] font-semibold leading-tight tracking-[-0.035em] text-slate-950">{paid ? "You’re registered" : cancelled ? "Your payment wasn’t completed" : failed ? "We couldn’t complete the payment" : "Your registration is saved"}</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{paid ? `${event?.name || "Your event"} is confirmed. Keep this page or your confirmation email for check-in.` : cancelled ? "Your registration has been saved, but payment wasn’t completed." : failed ? result.payment?.error?.message : "Payment has not been confirmed yet. This page will update after Stripe sends the signed payment confirmation."}</p>
      <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3"><div className="min-w-0 bg-white p-4"><p className="text-xs text-slate-500">Amount {paid ? "paid" : "due"}</p><p className="mt-1 break-words font-semibold text-slate-950">{money(result.order.totalAmount)}</p></div><div className="min-w-0 bg-white p-4"><p className="text-xs text-slate-500">Confirmation</p><p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">{result.order.orderNumber}</p></div><div className="min-w-0 bg-white p-4"><p className="text-xs text-slate-500">Reservation PIN</p><p className="mt-1 break-all font-mono text-sm font-semibold tracking-[0.12em] text-slate-950">{result.reservationAccess?.pin || "In your email"}</p></div></div>
      {result.table ? <div className="mt-6 border-b border-slate-200 pb-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reservation</p><p className="mt-1 font-semibold text-slate-950">Table {result.table.tableNumber} · {result.table.name}</p><p className="mt-1 text-sm text-slate-600">{result.table.capacity} seats reserved</p></div> : null}
      <div className="mt-6"><h3 className="text-sm font-semibold text-slate-950">Attendees</h3><ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{displayedGuests.map((guest, index) => <li key={index} className="py-3 text-sm text-slate-700">{[guest.firstName, guest.lastName].filter(Boolean).join(" ") || `Guest ${index + 1}`}</li>)}</ul></div>
      {(cancelled || failed || pending) && checkoutUrl ? <a href={checkoutUrl} className="event-brand-primary-bg mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-sm font-semibold text-white sm:w-auto">{cancelled || failed ? "Try payment again" : `Complete payment — ${money(result.order.totalAmount)}`}</a> : null}
      <div className="mt-8 grid grid-cols-2 gap-2 border-t border-slate-200 pt-6 text-sm font-semibold sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-3">{result.reservationAccess ? <a href={result.reservationAccess.manageUrl} className="event-brand-primary-text inline-flex min-h-11 items-center">View registration</a> : null}{event ? <a href={calendarHref(event)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-slate-700"><CalendarDays className="h-4 w-4" />Add to calendar</a> : null}{event?.location ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.location, event.address, event.city, event.state].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-slate-700"><MapPin className="h-4 w-4" />Get directions</a> : null}<button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-1.5 text-left text-slate-700"><Printer className="h-4 w-4" />Print / save</button></div>
      {result.email ? <p className="mt-5 text-xs leading-5 text-slate-500">{result.email.status === "sent" ? "A confirmation email was sent with these details." : result.email.detail}</p> : null}
    </section>;
  }

  return <section className="overflow-hidden border-y border-slate-200 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:rounded-xl sm:border-x">
    <div className="border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4 lg:hidden"><details><summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm font-semibold text-slate-900"><span className="min-w-0 break-words">View event and order summary</span><span className="flex shrink-0 items-center gap-2">{money(totalAmount)}<ChevronDown className="h-4 w-4" /></span></summary><div className="pt-5"><EventOrderSummary event={event} branding={branding} eventImageUrl={eventImageUrl} ticket={selectedTicket} quantity={requestedTicketUnits} total={totalAmount} currency={currency} /></div></details></div>
    <div className="lg:grid lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
      <aside className="hidden bg-slate-50 px-8 py-10 lg:block"><div className="sticky top-8"><a href="#hero" className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5" />Back to {event?.name || "event details"}</a><EventOrderSummary event={event} branding={branding} eventImageUrl={eventImageUrl} ticket={selectedTicket} quantity={requestedTicketUnits} total={totalAmount} currency={currency} /></div></aside>
      <div className="px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        {paymentReturn ? <div role="status" className="mb-7 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-semibold">{paymentReturn === "cancelled" ? "Payment not completed" : "Checking payment status"}</p><p className="mt-1">{paymentReturn === "cancelled" ? "Your saved registration could not be restored in this browser. Use the payment link in your confirmation email or contact the organizer." : "Use your confirmation email to view the saved registration if this message remains."}</p></div> : null}
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Registration</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950">Reserve seats for this event</h2></div>
        <fieldset className="mt-8"><legend className="text-sm font-semibold text-slate-950">Registration option</legend><div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">{activeTickets.map((ticket) => <label key={ticket.id} className={`grid min-h-[72px] cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-3 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4 ${ticketTypeId === ticket.id ? "bg-[color-mix(in_srgb,var(--event-brand-primary)_6%,white)]" : "bg-white hover:bg-slate-50"}`}><input type="radio" name="ticketTypeId" value={ticket.id} checked={ticketTypeId === ticket.id} onChange={() => setTicketTypeId(ticket.id)} disabled={previewOnly} className="h-5 w-5 shrink-0 accent-[var(--event-brand-primary)] sm:h-4 sm:w-4" /><span className="min-w-0"><span className="block break-words text-sm font-semibold text-slate-950">{ticket.name}</span><span className="mt-0.5 block break-words text-xs leading-5 text-slate-500">{ticket.isTable ? `Seats ${ticket.seatsIncluded ?? 1} guests` : ticket.description || "Individual registration"}{ticket.available != null ? ` · ${ticket.available} available` : ""}</span></span><span className="col-start-2 text-sm font-semibold text-slate-950 sm:col-start-3 sm:row-start-1">{money(ticket.price)}</span></label>)}</div></fieldset>
        <div className="mt-6 grid gap-4 sm:grid-cols-[150px_1fr] sm:items-end"><label className="text-sm font-medium text-slate-800">Quantity<input type="number" min="1" max="10" value={quantity} onChange={(changeEvent) => setQuantity(changeEvent.target.value)} disabled={previewOnly} className={inputClass} /></label><p className="pb-3 text-sm text-slate-500">{requestedSeats} attendee seat{requestedSeats === 1 ? "" : "s"} included</p></div>
        {selectedTicket?.isTable ? <label className="mt-5 block text-sm font-medium text-slate-800">Table or team name <span className="font-normal text-slate-400">(optional)</span><input value={tableName} onChange={(changeEvent) => setTableName(changeEvent.target.value)} disabled={previewOnly} maxLength={120} placeholder="For example, The Bright Ideas" className={inputClass} /><span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">A unique table number is assigned automatically and included with your confirmation.</span></label> : null}
        <fieldset className="mt-9 border-t border-slate-200 pt-7"><legend className="text-lg font-semibold text-slate-950">Contact information</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-800 sm:col-span-2">Email<input type="email" autoComplete="email" required value={primaryAttendee.email} onChange={(changeEvent) => updateAttendee(0, "email", changeEvent.target.value)} disabled={previewOnly} className={inputClass} /></label><label className="text-sm font-medium text-slate-800">First name<input autoComplete="given-name" required value={primaryAttendee.firstName} onChange={(changeEvent) => updateAttendee(0, "firstName", changeEvent.target.value)} disabled={previewOnly} className={inputClass} /></label><label className="text-sm font-medium text-slate-800">Last name<input autoComplete="family-name" required value={primaryAttendee.lastName} onChange={(changeEvent) => updateAttendee(0, "lastName", changeEvent.target.value)} disabled={previewOnly} className={inputClass} /></label><label className="text-sm font-medium text-slate-800 sm:col-span-2">Phone <span className="font-normal text-slate-400">(optional)</span><input type="tel" autoComplete="tel" value={primaryAttendee.phone} onChange={(changeEvent) => updateAttendee(0, "phone", changeEvent.target.value)} disabled={previewOnly} className={inputClass} /></label></div></fieldset>
        {requestedSeats > 1 ? <div className="mt-7 rounded-lg border border-slate-200 p-4"><label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" checked={addGuestsNow} onChange={(changeEvent) => setAddGuestsNow(changeEvent.target.checked)} disabled={previewOnly} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--event-brand-primary)]" /><span><span className="block text-sm font-semibold text-slate-900">Add guest names now</span><span className="mt-1 block text-xs leading-5 text-slate-500">Optional. You can complete guest information later with your reservation PIN.</span></span></label>{addGuestsNow ? <div className="mt-5 space-y-5 border-t border-slate-200 pt-5">{attendees.slice(1, requestedSeats).map((attendee, index) => <fieldset key={index}><legend className="text-sm font-semibold text-slate-800">Guest {index + 2}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-700">First name<input value={attendee.firstName} onChange={(changeEvent) => updateAttendee(index + 1, "firstName", changeEvent.target.value)} className={inputClass} /></label><label className="text-xs font-medium text-slate-700">Last name<input value={attendee.lastName} onChange={(changeEvent) => updateAttendee(index + 1, "lastName", changeEvent.target.value)} className={inputClass} /></label></div></fieldset>)}</div> : null}</div> : null}
        <details className="mt-6 border-y border-slate-200 py-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900"><span className="break-words">Dietary or accessibility information</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /></summary><div className="mt-4 grid gap-4"><label className="text-sm font-medium text-slate-800">Dietary restrictions <span className="font-normal text-slate-400">(optional)</span><textarea rows={2} value={primaryAttendee.dietaryRestrictions} onChange={(changeEvent) => updateAttendee(0, "dietaryRestrictions", changeEvent.target.value)} disabled={previewOnly} className={`${inputClass} py-3`} /></label><label className="text-sm font-medium text-slate-800">Accessibility needs <span className="font-normal text-slate-400">(optional)</span><textarea rows={2} value={primaryAttendee.specialNeeds} onChange={(changeEvent) => updateAttendee(0, "specialNeeds", changeEvent.target.value)} disabled={previewOnly} className={`${inputClass} py-3`} /></label></div></details>
        <label className="mt-6 flex min-h-11 items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={consentAccepted} onChange={(changeEvent) => setConsentAccepted(changeEvent.target.checked)} disabled={previewOnly} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--event-brand-primary)]" /><span>I agree to share this registration information with the event organizer for event operations and check-in.</span></label>
        <div className="mt-7 flex items-baseline justify-between border-t border-slate-200 pt-5"><span className="font-semibold text-slate-950">Total</span><span className="text-xl font-semibold text-slate-950">{money(totalAmount)}</span></div>
        {error ? <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {previewOnly ? <p className="mt-4 text-xs text-amber-700">Preview mode · Publish the event page to enable registration.</p> : null}
        <button type="button" onClick={() => void submitRegistration()} disabled={!canSubmit || submitting} className="event-brand-primary-bg mt-5 min-h-12 w-full rounded-md px-5 text-base font-semibold text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--event-brand-primary)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:brightness-100">{submitting ? "Saving registration…" : paymentPolicy === "StripeCheckout" && totalAmount > 0 ? `Pay ${money(totalAmount)}` : totalAmount > 0 ? "Reserve registration" : "Register"}</button>
        {paymentPolicy === "StripeCheckout" && totalAmount > 0 ? <div className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p><span className="font-semibold text-slate-700">Secure checkout</span><br />Payments are processed securely by Stripe. You’ll receive a confirmation email.</p></div> : <p className="mt-4 text-center text-xs text-slate-500">You’ll receive a confirmation email after registration.</p>}
      </div>
    </div>
  </section>;
}
