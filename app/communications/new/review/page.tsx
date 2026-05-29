/** Legacy wizard route redirected to OyamaEmail publish checks. */
import { redirect } from "next/navigation";

/** Redirects old review step into the redesigned send flow. */
export default function CommunicationsNewReviewPage() {
  redirect("/oyama-email/send");
}
