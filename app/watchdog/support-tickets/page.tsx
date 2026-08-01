import { WatchdogTicketsDashboard } from "@/app/features/watchdog/tickets/WatchdogTicketsDashboard";

/** Dedicated command center for organization support requests. */
export default function WatchdogSupportTicketsPage() {
  return <div className="space-y-4"><WatchdogTicketsDashboard /></div>;
}