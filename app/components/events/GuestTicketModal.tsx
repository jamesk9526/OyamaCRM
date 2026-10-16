"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import EventGuestTicketField from "./EventGuestTicketField";

export default function GuestTicketModal({ eventId, guest, onClose, onSaved }: {
  eventId: string;
  guest: { id: string; firstName?: string; lastName?: string; ticketType?: { id: string; name: string } };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ticketTypeId, setTicketTypeId] = useState(guest.ticketType?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/events/guests/${guest.id}`, { method: "PATCH", body: JSON.stringify({ ticketTypeId: ticketTypeId || null }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The ticket could not be assigned.");
    } finally { setSaving(false); }
  }
  return (
    <WorkspaceSetupModal title="Assign Ticket" subtitle={`${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim() || "Event guest"} onClose={onClose} maxWidthClassName="max-w-lg">
      <form onSubmit={submit} className="space-y-5 p-5">
        <EventGuestTicketField eventId={eventId} value={ticketTypeId} onChange={setTicketTypeId} currentTicketName={guest.ticketType?.name} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving || ticketTypeId === (guest.ticketType?.id ?? "")} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Ticket"}</button>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
