/** Entry page for the new communications project wizard. */
import { redirect } from "next/navigation";

/** Redirects legacy new-communication wizard traffic to campaign-first wizard entry. */
export default function CommunicationsNewPage() {
  redirect("/oyama-email/campaigns/new");
}
