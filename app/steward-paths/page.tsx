/**
 * /steward-paths is the canonical URL for the Steward Paths workspace.
 *
 * Today the implementation still lives at /automations. This thin redirect
 * establishes the new URL so other surfaces (sidebar, docs, search) can begin
 * linking to it without breaking the existing /automations route.
 *
 * When the visual builder skeleton lands (refactor doc Phase 4), this page
 * will host the new builder and /automations will redirect here instead.
 *
 * See docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md.
 */
import { redirect } from "next/navigation";

/** Server component that 308-redirects to the current Steward Paths surface. */
export default function StewardPathsCanonicalPage() {
  redirect("/automations");
}
