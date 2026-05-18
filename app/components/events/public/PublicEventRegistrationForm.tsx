/** PublicEventRegistrationForm captures public event registrations and returns check-in codes. */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventBuilderTicketType } from "@/app/components/events/page-builder/types";

interface PublicEventRegistrationFormProps {
  /** Published event page slug used by the unauthenticated registration endpoint. */
  pageSlug?: string;
  /** Active ticket types exposed by the public event page payload. */
  ticketTypes: EventBuilderTicketType[];
  /** When true, render a non-submitting preview inside the page builder canvas. */
  previewOnly?: boolean;
}

interface RegistrationResult {
  order: {
    orderNumber: string;
    status: string;
    totalAmount: number;
    ticketType: { name: string };
  };
  guests: Array<{
    firstName?: string | null;
    lastName?: string | null;
    checkinCode?: string | null;
  }>;
  message: string;
}

interface AttendeeDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dietaryRestrictions: string;
  specialNeeds: string;
}

function createBlankAttendee(): AttendeeDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dietaryRestrictions: "",
    specialNeeds: "",
  };
}

function hasRequiredAttendeeNames(attendee: AttendeeDraft): boolean {
  return Boolean(attendee.firstName.trim() && attendee.lastName.trim());
}

function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0";
  return `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** PublicEventRegistrationForm renders a compact one-ticket checkout starter flow. */
export default function PublicEventRegistrationForm({ pageSlug, ticketTypes, previewOnly = false }: PublicEventRegistrationFormProps) {
  const activeTickets = useMemo(() => ticketTypes.filter((ticket) => ticket.id), [ticketTypes]);
  const [ticketTypeId, setTicketTypeId] = useState(activeTickets[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([createBlankAttendee()]);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const selectedTicket = activeTickets.find((ticket) => ticket.id === ticketTypeId) ?? activeTickets[0] ?? null;
  const requestedTicketUnits = Math.max(1, Math.min(10, Number(quantity) || 1));
  const seatsPerTicket = selectedTicket?.isTable ? Math.max(1, selectedTicket.seatsIncluded ?? 1) : 1;
  const requestedSeats = Math.min(50, requestedTicketUnits * seatsPerTicket);
  const totalAmount = Number(selectedTicket?.price ?? 0) * requestedTicketUnits;
  const primaryAttendee = attendees[0];
  const allAttendeesNamed = attendees.slice(0, requestedSeats).every(hasRequiredAttendeeNames);
  const canSubmit = Boolean(
    pageSlug
    && selectedTicket
    && primaryAttendee?.firstName.trim()
    && primaryAttendee.lastName.trim()
    && primaryAttendee.email.trim()
    && allAttendeesNamed
    && consentAccepted
    && !previewOnly,
  );

  useEffect(() => {
    if (!activeTickets.length) return;
    if (!activeTickets.some((ticket) => ticket.id === ticketTypeId)) {
      setTicketTypeId(activeTickets[0].id);
    }
  }, [activeTickets, ticketTypeId]);

  useEffect(() => {
    setAttendees((current) => {
      const next = current.slice(0, requestedSeats);
      while (next.length < requestedSeats) next.push(createBlankAttendee());
      return next;
    });
  }, [requestedSeats]);

  function updateAttendee(index: number, field: keyof AttendeeDraft, value: string) {
    setAttendees((current) => current.map((attendee, attendeeIndex) => (
      attendeeIndex === index ? { ...attendee, [field]: value } : attendee
    )));
  }

  async function submitRegistration() {
    if (!pageSlug || !selectedTicket) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/events/public/page/${encodeURIComponent(pageSlug)}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTypeId: selectedTicket.id,
          quantity: requestedTicketUnits,
          consentAccepted,
          attendees: attendees.slice(0, requestedSeats),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Registration could not be completed.");
      }
      setResult(payload as RegistrationResult);
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "Registration could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (activeTickets.length === 0) {
    return <p className="text-sm text-slate-500">No ticket options configured yet.</p>;
  }

  if (result) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-left shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Registration received</p>
        <h3 className="mt-1 text-lg font-semibold text-emerald-950">Order {result.order.orderNumber}</h3>
        <p className="mt-2 text-sm text-emerald-900">{result.message}</p>
        <div className="mt-4 grid gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-700 sm:grid-cols-3">
          <p><span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ticket</span>{result.order.ticketType.name}</p>
          <p><span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</span>{formatMoney(result.order.totalAmount)}</p>
          <p><span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</span>{result.order.status}</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {result.guests.map((guest, index) => (
            <div key={`${guest.checkinCode ?? "guest"}-${index}`} className="rounded-lg border border-emerald-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-950">
                {[guest.firstName, guest.lastName].filter(Boolean).join(" ") || `Guest ${index + 1}`}
              </p>
              <p className="mt-1 font-mono text-sm text-emerald-700">Code: {guest.checkinCode ?? "Pending"}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Registration</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Reserve seats for this event</h3>
          <p className="mt-1 text-sm text-slate-600">Choose a ticket, enter attendee details, and receive check-in codes after confirmation.</p>
        </div>
        <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-right">
          <p className="text-xs font-semibold text-violet-700">Estimated total</p>
          <p className="text-lg font-bold text-violet-950">{formatMoney(totalAmount)}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {activeTickets.slice(0, 4).map((ticket) => (
          <label key={ticket.id} className={`rounded-lg border p-4 shadow-sm ${ticketTypeId === ticket.id ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"}`}>
            <input
              type="radio"
              name="ticketTypeId"
              className="sr-only"
              value={ticket.id}
              checked={ticketTypeId === ticket.id}
              onChange={() => setTicketTypeId(ticket.id)}
              disabled={previewOnly}
            />
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-slate-950">{ticket.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{ticket.isTable ? `${ticket.seatsIncluded ?? 1} seats included` : "Individual registration"}</span>
                {ticket.available != null ? <span className="mt-1 block text-[11px] font-medium text-slate-500">{ticket.available} available</span> : null}
              </span>
              <span className="text-sm font-bold text-violet-700">{formatMoney(ticket.price)}</span>
            </span>
            {ticket.description ? <span className="mt-3 block text-xs leading-5 text-slate-600">{ticket.description}</span> : null}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">Attendee details</p>
          <p className="mt-1 text-xs text-slate-600">
            {requestedSeats} seat{requestedSeats === 1 ? "" : "s"} will be created from {requestedTicketUnits} ticket{requestedTicketUnits === 1 ? "" : "s"}.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Ticket quantity
          <input type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {attendees.slice(0, requestedSeats).map((attendee, index) => (
          <fieldset key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {index === 0 ? "Primary registrant" : `Attendee ${index + 1}`}
            </legend>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                First name
                <input value={attendee.firstName} onChange={(event) => updateAttendee(index, "firstName", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Last name
                <input value={attendee.lastName} onChange={(event) => updateAttendee(index, "lastName", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Email {index === 0 ? "" : <span className="text-xs text-slate-400">(optional)</span>}
                <input type="email" value={attendee.email} onChange={(event) => updateAttendee(index, "email", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone {index === 0 ? "" : <span className="text-xs text-slate-400">(optional)</span>}
                <input value={attendee.phone} onChange={(event) => updateAttendee(index, "phone", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Dietary needs
                <input value={attendee.dietaryRestrictions} onChange={(event) => updateAttendee(index, "dietaryRestrictions", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Accessibility notes
                <input value={attendee.specialNeeds} onChange={(event) => updateAttendee(index, "specialNeeds", event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" />
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} disabled={previewOnly} className="mt-1" />
        I agree to share this registration information with the event organizer for event operations and check-in.
      </label>

      {previewOnly ? <p className="mt-3 text-xs text-amber-700">Preview mode: publish the event page to enable live registration.</p> : null}
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={() => void submitRegistration()}
        disabled={!canSubmit || submitting}
        className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Registering..." : selectedTicket && Number(selectedTicket.price) > 0 ? "Reserve registration" : "Register"}
      </button>
      {!allAttendeesNamed ? <p className="mt-2 text-xs text-slate-500">Enter first and last names for every seat before submitting.</p> : null}
    </section>
  );
}
