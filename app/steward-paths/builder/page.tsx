/**
 * /steward-paths/builder hosts the Phase 4 visual builder skeleton.
 *
 * The production editor still lives at /automations. This page is the
 * preview surface where the new three-panel builder is being assembled.
 *
 * See docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md.
 */
import StewardPathBuilderPage from "@/app/components/steward-paths/StewardPathBuilderPage";

/** Thin page wrapper that renders the builder client component. */
export default function StewardPathsBuilderRoute() {
  return <StewardPathBuilderPage />;
}
