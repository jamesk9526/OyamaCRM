/** Communication segment library route backed by communications segment view. */
import { redirect } from "next/navigation";

/** Redirects to segment view while library routes are consolidated. */
export default function CommunicationsLibrarySegmentsPage() {
  redirect("/communications?view=segments");
}
