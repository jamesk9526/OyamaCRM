/** EventSTUDIO root keeps old entry links compatible while using one event library. */

import { redirect } from "next/navigation";

export default function EventsPage() {
  redirect("/events/events");
}
