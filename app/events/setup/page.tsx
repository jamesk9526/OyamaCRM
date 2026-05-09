/** Event setup workspace route for the Events CRM module. */

import EventSetupWorkspace from "@/app/components/events/EventSetupWorkspace";

/**
 * EventSetupRoute renders the dedicated setup workspace for configuring events
 * before opening registration and check-in workflows.
 */
export default function EventSetupRoute() {
  return <EventSetupWorkspace />;
}
