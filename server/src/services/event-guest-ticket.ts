import { prisma } from "../lib/prisma.js";

/** Ticket labels do not create purchases, consume ticket units, or settle payments. */
export async function guestTicketTypeError(eventId: string, ticketTypeId: unknown, currentTicketTypeId?: string | null): Promise<string | null> {
  if (ticketTypeId === undefined || ticketTypeId === null) return null;
  if (typeof ticketTypeId !== "string" || !ticketTypeId.trim()) return "Choose a ticket type or None / Walk-in.";
  const ticket = await prisma.ticketType.findFirst({
    where: { id: ticketTypeId, eventId }, select: { id: true, active: true },
  });
  if (!ticket || (!ticket.active && ticket.id !== currentTicketTypeId)) {
    return "Choose an active ticket type for this event.";
  }
  return null;
}
