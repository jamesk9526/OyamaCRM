/** Canonical calendar alias route for OyamaEmail schedule manager. */
import { redirect } from "next/navigation";

/** Keeps /calendar discoverable while primary nav label remains Callender. */
export default function OyamaEmailCalendarAliasPage() {
  redirect("/oyama-email/callender");
}
