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
