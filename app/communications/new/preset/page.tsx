/** Legacy wizard route redirected to OyamaEmail templates. */
import { redirect } from "next/navigation";

/** Redirects old preset step into the redesigned template library. */
export default function CommunicationsNewPresetPage() {
  redirect("/oyama-email/templates");
}
