/** Dedicated communication log route backed by communications workspace log view. */
import { redirect } from "next/navigation";

/** Redirects to communications log view to keep one source-of-truth UI. */
export default function CommunicationsLogPage() {
  redirect("/communications?view=communication-log");
}
