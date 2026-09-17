import { describe, expect, it } from "vitest";
import { eventRegistryGroup } from "@/app/lib/event-registry";
import type { EventItem } from "@/app/components/events/types";

const event: EventItem = { id: "event", name: "Trivia night", type: "TRIVIA", active: true, startDate: "2026-09-15T18:00:00", endDate: "2026-09-15T22:00:00" };
describe("Event registry grouping", () => {
  it("keeps a live event visible after doors open", () => {
    expect(eventRegistryGroup(event, new Date("2026-09-15T19:00:00").getTime())).toBe("current");
  });
  it("honors the end time and archived state", () => {
    expect(eventRegistryGroup(event, new Date("2026-09-15T23:00:00").getTime())).toBe("past");
    expect(eventRegistryGroup({ ...event, active: false }, 0)).toBe("past");
  });
  it("keeps events with missing dates discoverable", () => {
    expect(eventRegistryGroup({ ...event, startDate: "" })).toBe("unscheduled");
  });
  it("keeps today's event available when its end time is missing", () => {
    expect(eventRegistryGroup({ ...event, endDate: null }, new Date("2026-09-15T23:00:00").getTime())).toBe("current");
    expect(eventRegistryGroup(event, new Date("2026-09-14T23:00:00").getTime())).toBe("upcoming");
  });
});
