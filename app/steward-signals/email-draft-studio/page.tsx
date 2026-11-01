import { redirect } from "next/navigation";

/** Retired standalone UI; saved links open the shared Steward chathead. */
export default function LegacyStewardEntry() {
  redirect("/steward-ai-workspace?prompt=Draft%20a%20donor%20thank-you%20email");
}
