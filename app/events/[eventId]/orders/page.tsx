// Event-scoped orders route wrapper for /events/[eventId]/orders.

import EventOrdersPage from "@/app/events/orders/page";

/**
 * EventWorkspaceOrdersPage renders the orders tool inside event workspace routing.
 */
export default function EventWorkspaceOrdersPage() {
  return <EventOrdersPage />;
}
