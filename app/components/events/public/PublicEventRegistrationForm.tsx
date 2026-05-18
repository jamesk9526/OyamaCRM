/** PublicEventRegistrationForm captures public event registrations and returns check-in codes. */
"use client";

import { useMemo, useState } from "react";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const selectedTicket = activeTickets.find((ticket) => ticket.id === ticketTypeId) ?? activeTickets[0] ?? null;
  const canSubmit = Boolean(pageSlug && selectedTicket && firstName.trim() && lastName.trim() && email.trim() && consentAccepted && !previewOnly);

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
          quantity: Number(quantity) || 1,
          consentAccepted,
          attendees: [{ firstName, lastName, email, phone, dietaryRestrictions, specialNeeds }],
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

  function handleRegistrationClick() {
    void submitRegistration();
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
              </span>
              <span className="text-sm font-bold text-violet-700">{formatMoney(ticket.price)}</span>
            </span>
            {ticket.description ? <span className="mt-3 block text-xs leading-5 text-slate-600">{ticket.description}</span> : null}
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          First name
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Last name
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone
          <input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Quantity
          <input type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Dietary needs
          <input value={dietaryRestrictions} onChange={(event) => setDietaryRestrictions(event.target.value)} disabled={previewOnly} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
        </label>
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        Accessibility or special notes
        <textarea value={specialNeeds} onChange={(event) => setSpecialNeeds(event.target.value)} disabled={previewOnly} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>

      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} disabled={previewOnly} className="mt-1" />
        I agree to share this registration information with the event organizer for event operations and check-in.
      </label>

      {previewOnly ? <p className="mt-3 text-xs text-amber-700">Preview mode: publish the event page to enable live registration.</p> : null}
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={handleRegistrationClick}
        disabled={!canSubmit || submitting}
        className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Registering..." : selectedTicket && Number(selectedTicket.price) > 0 ? "Reserve registration" : "Register"}
      </button>
    </section>
  );
}
