/** Legacy wizard route redirected to OyamaEmail builder. */
import { redirect } from "next/navigation";

/** Redirects old editor step into the redesigned template builder. */
export default function CommunicationsNewEditorPage() {
  redirect("/oyama-email/templates/new");
}
