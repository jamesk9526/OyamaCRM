/** Dedicated communication log route backed by communications workspace log view. */
import { redirect } from "next/navigation";

/** Redirects legacy log route to OyamaEmail campaigns workspace. */
export default function CommunicationsLogPage() {
  redirect("/oyama-email/campaigns");
}
