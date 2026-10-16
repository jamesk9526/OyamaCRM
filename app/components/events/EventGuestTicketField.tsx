"use client";

import { useEffect, useId, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface TicketType { id: string; name: string; price: number | string; active?: boolean }

/** Event tickets load independently of optional constituent access. */
export default function EventGuestTicketField({ eventId, value, onChange, currentTicketName }: {
  eventId: string; value: string; onChange: (id: string) => void; currentTicketName?: string;
}) {
  const id = useId();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<TicketType[]>(`/api/events/${eventId}/ticket-types`).then((rows) => {
      if (!Array.isArray(rows)) throw new Error("Ticket types could not be loaded.");
      if (!cancelled) setTickets(rows.filter((ticket) => ticket.active !== false));
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Ticket types could not be loaded.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId, attempt]);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-gray-600">Ticket Type</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={loading || Boolean(error)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-60">
        <option value="">None / Walk-in</option>
        {value && !tickets.some((ticket) => ticket.id === value) && <option value={value}>{currentTicketName ?? "Current ticket"}</option>}
        {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.name} - ${Number(ticket.price).toFixed(2)}</option>)}
      </select>
      {loading && <p role="status" className="mt-1 text-xs text-gray-500">Loading ticket types…</p>}
      {error && <div role="alert" className="mt-2 text-sm text-red-700">{error} <button type="button" onClick={() => setAttempt((previous) => previous + 1)} className="font-semibold underline">Retry tickets</button></div>}
      {!loading && !error && tickets.length === 0 && <p className="mt-1 text-xs text-gray-500">No active ticket types. You can save as a walk-in and assign a ticket later.</p>}
      <p className="mt-1 text-xs text-gray-500">Assigns this guest’s ticket category. Purchases and payments are managed in Orders.</p>
    </div>
  );
}
