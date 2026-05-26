/** Communication campaign library route backed by the canonical Communications workspace. */
import { redirect } from "next/navigation";

/** Redirects legacy/deep campaign-library traffic to the project library view. */
export default function CommunicationsLibraryCampaignsPage() {
  redirect("/communications?view=email-campaigns");
}