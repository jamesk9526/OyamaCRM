// Watchdog route entry for cross-CRM feedback ticket triage.

import { WatchdogTicketsDashboard } from "@/app/features/watchdog/tickets/WatchdogTicketsDashboard";

/**
 * WatchdogFeedbackTicketsPage renders the dedicated ticketing command center.
 * This page is intentionally separate from dashboard anchors so queue triage has room.
 */
export default function WatchdogFeedbackTicketsPage() {
  return (
    <div className="space-y-4">
      <WatchdogTicketsDashboard />
    </div>
  );
}
