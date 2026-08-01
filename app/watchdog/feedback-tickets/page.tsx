import { redirect } from "next/navigation";

/** Legacy Watchdog ticket URL retained for saved links. */
export default function WatchdogFeedbackTicketsPage() {
  redirect("/watchdog/support-tickets");
}
