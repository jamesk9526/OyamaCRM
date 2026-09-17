import type { EventItem } from "@/app/components/events/types";

export function eventRegistryGroup(event: EventItem, now = Date.now()): "current" | "upcoming" | "past" | "unscheduled" {
  if (!event.active) return "past";
  const start = Date.parse(event.startDate);
  if (!Number.isFinite(start)) return "unscheduled";
  if (start > now) return "upcoming";
  const end = event.endDate ? Date.parse(event.endDate) : NaN;
  // Without an end time, keep today's event available to event-night staff.
  const endOfDay = new Date(start);
  endOfDay.setHours(23, 59, 59, 999);
  return now <= (Number.isFinite(end) ? end : endOfDay.getTime()) ? "current" : "past";
}
