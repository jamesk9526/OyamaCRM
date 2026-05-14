/** Deprecated compatibility route for legacy Steward Paths surface. */
import { redirect } from "next/navigation";

/** Redirects legacy /automations traffic to canonical /steward-paths workspace. */
export default function AutomationsDeprecatedRoute() {
  redirect("/steward-paths?deprecated=automations");
}
