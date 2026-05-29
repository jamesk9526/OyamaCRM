/** Legacy communications route redirected to OyamaEmail. */
import { redirect } from "next/navigation";

/** Sends communications traffic to the redesigned OyamaEmail campaigns workspace. */
export default function CommunicationsPage() {
  redirect("/oyama-email/campaigns");
}
