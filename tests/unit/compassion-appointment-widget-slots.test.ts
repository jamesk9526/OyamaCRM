/** Unit tests for Compassion appointment widget slot generation and scheduling policy rules. */
import { describe, expect, it } from "vitest";
import {
  buildDefaultWidgetConfig,
  buildWidgetAvailableSlots,
  type AppointmentSlotReservation,
} from "@/server/src/services/compassion-appointment-widget";

/** Returns a YYYY-MM-DD string for stable blackout and date-range tests. */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Builds a base config tailored for deterministic slot tests. */
function buildTestConfig(date: Date) {
  const config = buildDefaultWidgetConfig();
  config.maxAdvanceDays = 365;
  config.minLeadHours = 0;
  config.slotIntervalMinutes = 30;
  config.appointmentDurationMinutes = 30;
  config.blackoutDates = [];
  config.availabilityBlocks = [
    {
      id: "slot-test-block",
      dayOfWeek: date.getDay(),
      startTime: "09:00",
      endTime: "10:00",
      location: "Main Office",
      appointmentType: "ANY",
      capacity: 1,
      isActive: true,
    },
  ];
  return config;
}

describe("buildWidgetAvailableSlots", () => {
  it("returns open slots for an active availability block", () => {
    const date = new Date(2026, 4, 11, 0, 0, 0, 0);
    const config = buildTestConfig(date);

    const slots = buildWidgetAvailableSlots({
      config,
      date,
      appointments: [],
      now: new Date(2026, 4, 10, 8, 0, 0, 0),
    });

    expect(slots.length).toBe(2);
    expect(slots[0].remainingCapacity).toBe(1);
    expect(slots[0].location).toBe("Main Office");
  });

  it("returns no slots on configured blackout dates", () => {
    const date = new Date(2026, 4, 11, 0, 0, 0, 0);
    const config = buildTestConfig(date);
    config.blackoutDates = [{ date: toDateKey(date), reason: "Holiday" }];

    const slots = buildWidgetAvailableSlots({
      config,
      date,
      appointments: [],
      now: new Date(2026, 4, 10, 8, 0, 0, 0),
    });

    expect(slots).toEqual([]);
  });

  it("removes fully booked slots from availability", () => {
    const date = new Date(2026, 4, 11, 0, 0, 0, 0);
    const config = buildTestConfig(date);

    const bookedSlotStart = new Date(date);
    bookedSlotStart.setHours(9, 0, 0, 0);

    const appointments: AppointmentSlotReservation[] = [
      {
        startTime: bookedSlotStart,
        location: "Main Office",
        appointmentType: "INTAKE",
        status: "SCHEDULED",
      },
    ];

    const slots = buildWidgetAvailableSlots({
      config,
      date,
      appointments,
      now: new Date(2026, 4, 10, 8, 0, 0, 0),
    });

    expect(slots.length).toBe(1);
    expect(slots[0].startTime).toBe(new Date(2026, 4, 11, 9, 30, 0, 0).toISOString());
  });

  it("respects minimum lead-hour cutoff when generating slots", () => {
    const date = new Date(2026, 4, 11, 0, 0, 0, 0);
    const config = buildTestConfig(date);
    config.minLeadHours = 1;
    config.availabilityBlocks[0].endTime = "12:00";

    const slots = buildWidgetAvailableSlots({
      config,
      date,
      appointments: [],
      now: new Date(2026, 4, 11, 8, 45, 0, 0),
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startTime).toBe(new Date(2026, 4, 11, 10, 0, 0, 0).toISOString());
  });
});
