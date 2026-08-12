"use client";

import { useState } from "react";

interface ManagedGuest {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  dietaryRestrictions: string | null;
  specialNeeds: string | null;
  paymentStatus: string;
  rsvpStatus: string;
  table: { name: string } | null;
  seat: { seatNumber: number } | null;
}

interface Reservation {
  order: { orderNumber: string; status: string; totalAmount: number; paidAt: string | null };
  event: { name: string; startDate: string; location: string | null };
  guests: ManagedGuest[];
}

const inputClass = "mt-1 min-h-11 w-full border border-[#8a8886] bg-white px-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]";

export default function EventReservationManagerPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [pin, setPin] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function request(method: "POST" | "PATCH") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/events/public/reservation-access", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, pin, guests: method === "PATCH" ? reservation?.guests : undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Reservation access failed.");
      setReservation(payload as Reservation);
      setMessage(method === "PATCH" ? "Reservation details saved." : "Reservation unlocked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reservation access failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateGuest(id: string, field: keyof ManagedGuest, value: string) {
    setReservation((current) => current ? { ...current, guests: current.guests.map((guest) => guest.id === id ? { ...guest, [field]: value } : guest) } : current);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-4 py-10 text-[#242424] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="border-t-4 border-[#0f6cbd] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">Oyama Events</p>
          <h1 className="mt-2 text-2xl font-semibold">Manage your reservation</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#616161]">Use the order number and reservation PIN from your confirmation email. You can update attendee contact, dietary, and accessibility details; payment, price, seating, and check-in remain protected.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <label className="text-sm font-semibold">Order number<input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} autoComplete="off" className={inputClass} placeholder="PUB-…" /></label>
            <label className="text-sm font-semibold">Reservation PIN<input value={pin} onChange={(event) => setPin(event.target.value.toUpperCase())} autoComplete="one-time-code" className={`${inputClass} font-mono tracking-widest`} /></label>
            <button type="button" onClick={() => void request("POST")} disabled={busy || !orderNumber.trim() || !pin.trim()} className="min-h-11 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:bg-[#c8c6c4]">{busy ? "Checking…" : "Open reservation"}</button>
          </div>
          {message ? <p className={`mt-4 border-l-4 px-3 py-2 text-sm ${reservation ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-amber-600 bg-amber-50 text-amber-900"}`} aria-live="polite">{message}</p> : null}
        </header>

        {reservation ? <section className="mt-5 border border-[#d1d1d1] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edebe9] pb-4">
            <div><h2 className="text-xl font-semibold">{reservation.event.name}</h2><p className="mt-1 text-sm text-[#616161]">{new Date(reservation.event.startDate).toLocaleString()}{reservation.event.location ? ` · ${reservation.event.location}` : ""}</p></div>
            <div className="text-right text-sm"><p className="font-semibold">{reservation.order.orderNumber}</p><p className="text-[#616161]">{reservation.order.status} · ${reservation.order.totalAmount.toFixed(2)}</p></div>
          </div>
          <div className="mt-4 space-y-4">{reservation.guests.map((guest, index) => <fieldset key={guest.id} className="border border-[#d1d1d1] p-4"><legend className="px-1 text-sm font-semibold">{index === 0 ? "Primary registrant" : `Attendee ${index + 1}`}</legend><div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">First name<input value={guest.firstName ?? ""} onChange={(event) => updateGuest(guest.id, "firstName", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Last name<input value={guest.lastName ?? ""} onChange={(event) => updateGuest(guest.id, "lastName", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Email<input type="email" value={guest.email ?? ""} onChange={(event) => updateGuest(guest.id, "email", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Phone<input value={guest.phone ?? ""} onChange={(event) => updateGuest(guest.id, "phone", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Dietary needs<textarea value={guest.dietaryRestrictions ?? ""} onChange={(event) => updateGuest(guest.id, "dietaryRestrictions", event.target.value)} rows={2} className={`${inputClass} py-2`} /></label>
            <label className="text-sm font-semibold">Accessibility notes<textarea value={guest.specialNeeds ?? ""} onChange={(event) => updateGuest(guest.id, "specialNeeds", event.target.value)} rows={2} className={`${inputClass} py-2`} /></label>
          </div><p className="mt-3 text-xs text-[#616161]">{guest.table ? guest.table.name : "No table assigned"}{guest.seat ? ` · Seat ${guest.seat.seatNumber}` : ""} · Payment {guest.paymentStatus.toLowerCase()}</p></fieldset>)}</div>
          <button type="button" onClick={() => void request("PATCH")} disabled={busy} className="mt-5 min-h-11 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:bg-[#c8c6c4]">{busy ? "Saving…" : "Save attendee details"}</button>
        </section> : null}
      </div>
    </main>
  );
}
