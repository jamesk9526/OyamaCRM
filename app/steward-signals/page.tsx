import { redirect } from "next/navigation";

/** Retired standalone UI; saved links open the shared Steward chathead. */
export default function LegacyStewardEntry() {
  redirect("/steward-ai-workspace?prompt=Review%20donor%20follow-up%20priorities");
}
