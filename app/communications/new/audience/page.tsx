/** Legacy wizard route redirected to OyamaEmail audience tools. */
import { redirect } from "next/navigation";

/** Redirects old audience step into the redesigned audience workspace. */
export default function CommunicationsNewAudiencePage() {
  redirect("/oyama-email/audience");
}
