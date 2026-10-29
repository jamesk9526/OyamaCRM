// Utility helpers for Compassion appointment formatting, filtering, and calendar mapping.

import type { EventInput } from "@fullcalendar/core";
import type { AppointmentFilters, CompassionAppointmentRecord } from "./types";

/** Returns the best visible staff label for list and calendar surfaces. */
function staffLabel(appointment: CompassionAppointmentRecord): string {
  if (!appointment.assignedStaff) return "";
  return appointment.assignedStaff.displayName
    ?? `${appointment.assignedStaff.firstName} ${appointment.assignedStaff.lastName}`.trim();
}

/** Converts enum-like values into office-friendly labels. */
export function humanizeEnum(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Formats ISO date/time for table and detail displays. */
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Converts an ISO date/time into a local datetime-local input value. */
export function toDatetimeLocalValue(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Returns a stable FullCalendar event color by appointment status. */
export function statusColor(status: string): string {
  if (status === "COMPLETED") return "#059669";
  if (status === "CANCELLED") return "#dc2626";
  if (status === "NO_SHOW") return "#d97706";
  if (status === "RESCHEDULED") return "#0ea5e9";
  return "#2563eb";
}

/** Creates a compact calendar title from appointment fields. */
export function calendarTitle(appointment: CompassionAppointmentRecord): string {
  const clientName = `${appointment.client.firstName} ${appointment.client.lastName}`.trim();
  const type = humanizeEnum(appointment.appointmentType);
  return `${clientName} • ${type}`;
}

/** Maps API appointments into FullCalendar event inputs. */
export function mapAppointmentsToEvents(appointments: CompassionAppointmentRecord[]): EventInput[] {
  return appointments.map((appointment) => ({
    id: appointment.id,
    title: calendarTitle(appointment),
    start: appointment.startTime,
    end: appointment.endTime ?? undefined,
    backgroundColor: statusColor(appointment.status),
    borderColor: statusColor(appointment.status),
    extendedProps: {
      appointment,
      status: appointment.status,
      appointmentType: appointment.appointmentType,
      staffName: staffLabel(appointment) || "Unassigned",
    },
  }));
}

/** Applies client-side list filtering for already-loaded appointments. */
export function filterAppointments(
  appointments: CompassionAppointmentRecord[],
  filters: AppointmentFilters,
): CompassionAppointmentRecord[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  return appointments.filter((appointment) => {
    if (filters.status && appointment.status !== filters.status) return false;
    if (filters.appointmentType && appointment.appointmentType !== filters.appointmentType) return false;
    const assignedId = appointment.assignedCompassionStaffId ?? appointment.assignedStaffId ?? "";
    if (filters.assignedStaffId && assignedId !== filters.assignedStaffId) return false;

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (new Date(appointment.startTime) < from) return false;
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(appointment.startTime) > to) return false;
    }

    if (filters.location) {
      const appointmentLocation = (appointment.location ?? "").toLowerCase();
      if (!appointmentLocation.includes(filters.location.toLowerCase())) return false;
    }

    if (!normalizedSearch) return true;

    const staffName = staffLabel(appointment);

    const haystack = [
      `${appointment.client.firstName} ${appointment.client.lastName}`,
      appointment.client.email ?? "",
      appointment.client.phone ?? "",
      humanizeEnum(appointment.appointmentType),
      appointment.location ?? "",
      appointment.notes ?? "",
      staffName,
      appointment.status,
    ].join(" ").toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

/** Sorts appointments by common list columns. */
export function sortAppointments(
  appointments: CompassionAppointmentRecord[],
  sortBy: "startTime" | "client" | "appointmentType" | "status" | "staff" | "location",
  sortDirection: "asc" | "desc",
): CompassionAppointmentRecord[] {
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...appointments].sort((left, right) => {
    const leftValue = (() => {
      if (sortBy === "client") return `${left.client.firstName} ${left.client.lastName}`;
      if (sortBy === "appointmentType") return left.appointmentType;
      if (sortBy === "status") return left.status;
      if (sortBy === "staff") return staffLabel(left);
      if (sortBy === "location") return left.location ?? "";
      return left.startTime;
    })();

    const rightValue = (() => {
      if (sortBy === "client") return `${right.client.firstName} ${right.client.lastName}`;
      if (sortBy === "appointmentType") return right.appointmentType;
      if (sortBy === "status") return right.status;
      if (sortBy === "staff") return staffLabel(right);
      if (sortBy === "location") return right.location ?? "";
      return right.startTime;
    })();

    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? direction : -direction;
  });
}
