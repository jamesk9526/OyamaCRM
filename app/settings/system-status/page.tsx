/** Retired readiness dashboard compatibility route. */
import { redirect } from "next/navigation";

export default function SystemStatusRedirectPage() {
  redirect("/settings/system");
}
