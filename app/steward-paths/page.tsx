/** Canonical Steward Paths workspace route. */
import { redirect } from "next/navigation";

/** Redirects to the dedicated Path Library main screen. */
export default function StewardPathsCanonicalPage() {
  redirect("/steward-paths/library");
}
