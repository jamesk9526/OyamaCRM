import { redirect } from "next/navigation";

/**
 * Legacy setup route. Event preparation now lives in each event's real-data
 * overview, so this route sends staff to the event selector first.
 */
export default function EventSetupRoute() {
  redirect("/events/events");
}
