import { describe, expect, it } from "vitest";
import { tableOccupancy, tableDetailGuests } from "@/app/lib/events/table-occupancy";

describe("numbered table occupancy", () => {
  it("reads the existing table-detail response without a top-level guests list", () => {
    const guests = tableDetailGuests({ seats: [
      { id: "seat-1", guest: { id: "guest-1", firstName: "Rebecca" } },
      { id: "seat-2", guest: null },
    ] });
    expect(guests).toEqual([{ id: "guest-1", firstName: "Rebecca", seatId: "seat-1" }]);
    expect(tableOccupancy({ capacity: 8, guests })).toEqual({ seated: 1, open: 7, awaitingSeat: 0, overCapacity: false });
  });
  it("preserves table-only links when the API supplies the complete guest list", () => {
    const guests = [{ id: "guest-1", seatId: "seat-1" }, { id: "legacy-1", seatId: null }];
    expect(tableDetailGuests({ guests, seats: [] })).toEqual(guests);
  });
  it("counts one seated person and seven open seats despite four legacy table links", () => {
    expect(tableOccupancy({ capacity: 8, guests: [{ seatId: "seat-1" }, ...Array.from({ length: 4 }, () => ({ seatId: null }))] }))
      .toEqual({ seated: 1, open: 7, awaitingSeat: 4, overCapacity: false });
  });
  it("does not treat a table-only guest as seated", () => {
    expect(tableOccupancy({ capacity: 8, guests: [{}] }).open).toBe(8);
  });
  it("reports excess seated guests without negative availability", () => {
    expect(tableOccupancy({ capacity: 1, guests: [{ seatId: "s1" }, { seatId: "s2" }] }))
      .toEqual({ seated: 2, open: 0, awaitingSeat: 0, overCapacity: true });
  });
});
