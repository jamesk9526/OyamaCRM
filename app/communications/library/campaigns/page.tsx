/** Communication campaign library route backed by the canonical Communications workspace. */
import { redirect } from "next/navigation";

/** Redirects legacy campaign library route to OyamaEmail campaigns. */
export default function CommunicationsLibraryCampaignsPage() {
  redirect("/oyama-email/campaigns");
}