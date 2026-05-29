/** Legacy wizard route redirected to OyamaEmail send step. */
import { redirect } from "next/navigation";

/** Redirects old send step into the redesigned send wizard. */
export default function CommunicationsNewSendPage() {
  redirect("/oyama-email/send");
}
