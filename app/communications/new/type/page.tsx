/** Legacy wizard route redirected to OyamaEmail. */
import { redirect } from "next/navigation";

/** Redirects old type step into the redesigned send workflow. */
export default function CommunicationsNewTypePage() {
  redirect("/oyama-email/send");
}
