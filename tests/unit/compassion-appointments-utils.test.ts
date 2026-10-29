/** Unit tests for Compassion appointment calendar/list utility functions. */
import { describe, expect, it } from "vitest";
import {
  filterAppointments,
  humanizeEnum,
  mapAppointmentsToEvents,
  sortAppointments,
} from "@/app/components/compassion/appointments/appointmentUtils";
import type { AppointmentFilters, CompassionAppointmentRecord } from "@/app/components/compassion/appointments/types";

const baseAppointments: CompassionAppointmentRecord[] = [
  {
    id: "appt_1",
    clientId: "client_1",
    appointmentType: "INTAKE",
    status: "SCHEDULED",
    startTime: "2026-05-15T10:00:00.000Z",
    endTime: "2026-05-15T11:00:00.000Z",
    assignedStaffId: "staff_1",
    location: "Room A",
    notes: "Bring intake forms",
    client: { id: "client_1", firstName: "Anna", lastName: "Miller", email: "anna@example.com", phone: "555-1010" },
    assignedStaff: { id: "staff_1", firstName: "Sara", lastName: "Lane" },
    flags: { firstVisit: true, followUpNeeded: false, noShowRisk: false, incompleteIntake: false, noShowCount: 0 },
  },
  {
    id: "appt_2",
    clientId: "client_2",
    appointmentType: "FOLLOW_UP",
    status: "NO_SHOW",
    startTime: "2026-05-16T10:00:00.000Z",
    endTime: "2026-05-16T10:30:00.000Z",
    assignedStaffId: "staff_2",
    location: "Room B",
    notes: "Discuss resources",
    client: { id: "client_2", firstName: "Bea", lastName: "Jones", email: "bea@example.com", phone: "555-2020" },
    assignedStaff: { id: "staff_2", firstName: "Ivy", lastName: "Ng" },
    flags: { firstVisit: false, followUpNeeded: true, noShowRisk: true, incompleteIntake: true, noShowCount: 2 },
  },
];

const defaultFilters: AppointmentFilters = {
  search: "",
  status: "",
  appointmentType: "",
  assignedStaffId: "",
  dateFrom: "",
  dateTo: "",
  location: "",
};

describe("compassion appointment utils", () => {
  it("humanizes enum labels", () => {
    expect(humanizeEnum("NO_SHOW")).toBe("No Show");
  });

  it("maps records to calendar events", () => {
    const events = mapAppointmentsToEvents(baseAppointments);
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe("appt_1");
    expect(String(events[0].title)).toContain("Anna Miller");
  });

  it("filters by status and location", () => {
    const filtered = filterAppointments(baseAppointments, {
      ...defaultFilters,
      status: "NO_SHOW",
      location: "Room B",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("appt_2");
  });

  it("filters by search text across client and notes", () => {
    const byClient = filterAppointments(baseAppointments, { ...defaultFilters, search: "anna" });
    expect(byClient).toHaveLength(1);
    expect(byClient[0].id).toBe("appt_1");

    const byNotes = filterAppointments(baseAppointments, { ...defaultFilters, search: "resources" });
    expect(byNotes).toHaveLength(1);
    expect(byNotes[0].id).toBe("appt_2");
  });

  it("sorts by client name descending", () => {
    const sorted = sortAppointments(baseAppointments, "client", "desc");
    expect(sorted[0].client.lastName).toBe("Jones");
    expect(sorted[1].client.lastName).toBe("Miller");
  });
});
