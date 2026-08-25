/** Legacy registry path retained as a compatible redirect. */
import { redirect } from "next/navigation";

/**
 * EventRegistryRoute renders the event registry workspace with event creation and list management.
 */
export default function EventRegistryRoute() {
  redirect("/events");
}
