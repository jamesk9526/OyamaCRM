/** Communication template library route backed by communications templates view. */
import { redirect } from "next/navigation";

/** Redirects to templates view while library routes are consolidated. */
export default function CommunicationsLibraryTemplatesPage() {
  redirect("/communications?view=templates");
}
