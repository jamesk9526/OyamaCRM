/** Communication segment library route backed by communications segment view. */
import { redirect } from "next/navigation";

/** Redirects legacy segment route to OyamaEmail audience workspace. */
export default function CommunicationsLibrarySegmentsPage() {
  redirect("/oyama-email/audience");
}
