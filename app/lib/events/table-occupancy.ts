/** Older TableLink responses expose guests only through their seat relations. */
export function tableDetailGuests<T extends { id: string; seatId?: string | null }>(detail: {
  guests?: T[];
  seats: Array<{ id: string; guest?: T | null }>;
}): Array<T & { seatId?: string | null }> {
  if (Array.isArray(detail.guests)) return detail.guests;
  return detail.seats.flatMap((seat) => seat.guest ? [{ ...seat.guest, seatId: seat.id }] : []);
}

/** Table links can exist without a numbered seat (legacy assignments or cleared seats). */
export function tableOccupancy(table: {
  capacity: number;
  guests: Array<{ seatId?: string | null }>;
}) {
  const seated = table.guests.filter((guest) => Boolean(guest.seatId)).length;
  return {
    seated,
    open: Math.max(0, table.capacity - seated),
    awaitingSeat: table.guests.length - seated,
    overCapacity: seated > table.capacity,
  };
}
