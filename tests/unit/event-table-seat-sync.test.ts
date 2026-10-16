import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncEventTableSeats } from "@/server/src/services/event-table-service";

type Seat = { id: string; seatNumber: number; guest: { id: string } | null; status: string };
const state = vi.hoisted(() => ({
  capacity: 4,
  exists: true,
  seats: [] as Seat[],
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: {
  eventTable: {
    findUnique: async () => state.exists ? {
      id: "table-1", eventId: "event-1", capacity: state.capacity,
      seats: [...state.seats].sort((a, b) => a.seatNumber - b.seatNumber),
    } : null,
  },
  eventTableSeat: {
    createMany: async ({ data }: { data: Array<{ seatNumber: number; status: string }> }) => {
      for (const seat of data) {
        if (state.seats.some((existing) => existing.seatNumber === seat.seatNumber)) throw new Error("Duplicate seat number");
        state.seats.push({ ...seat, id: `seat-${seat.seatNumber}`, guest: null });
      }
    },
    deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
      state.seats = state.seats.filter((seat) => !where.id.in.includes(seat.id));
    },
  },
} }));

function seedSeats(numbers: number[], occupied: number[] = []) {
  state.seats = numbers.map((seatNumber) => ({
    id: `seat-${seatNumber}`, seatNumber,
    guest: occupied.includes(seatNumber) ? { id: `guest-${seatNumber}` } : null,
    status: occupied.includes(seatNumber) ? "CONFIRMED" : "EMPTY",
  }));
}
const numbers = () => state.seats.map((seat) => seat.seatNumber).sort((a, b) => a - b);

beforeEach(() => {
  state.capacity = 4;
  state.exists = true;
  state.seats = [];
});

describe("event table seat synchronization", () => {
  it("fills missing numbers when seat count already equals capacity", async () => {
    seedSeats([1, 2, 4, 8], [8]);
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4, 8]);
    expect(state.seats.find((seat) => seat.seatNumber === 8)?.guest?.id).toBe("guest-8");
  });

  it("removes empty out-of-range seats even when seat count equals capacity", async () => {
    seedSeats([1, 2, 4, 8]);
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4]);
  });

  it("preserves an occupied high seat through shrink and repeated growth without duplicates", async () => {
    seedSeats([1, 2, 3, 4, 5, 6, 7, 8], [8]);
    const assignedSeat = state.seats[7];
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4, 8]);
    state.capacity = 6;
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4, 5, 6, 8]);
    state.capacity = 8;
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(state.seats.find((seat) => seat.id === "seat-8")).toEqual(assignedSeat);
    await syncEventTableSeats("table-1");
    expect(numbers()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("returns null for a missing table", async () => {
    state.exists = false;
    expect(await syncEventTableSeats("missing")).toBeNull();
    expect(state.seats).toEqual([]);
  });
});
