// Compatibility route that forwards legacy alerts path to the new security workspace.
import { redirect } from "next/navigation";

/** Redirects /watchdog/alerts to /watchdog/security to preserve compatibility. */
export default function WatchdogAlertsCompatibilityPage() {
  redirect("/watchdog/security");
}
