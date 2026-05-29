/** Communication template library route backed by communications templates view. */
import { redirect } from "next/navigation";

/** Redirects legacy template library route to OyamaEmail templates. */
export default function CommunicationsLibraryTemplatesPage() {
  redirect("/oyama-email/templates");
}
