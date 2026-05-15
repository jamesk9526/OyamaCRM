/** StewardAIWorkspace route entry for full-page Steward AI operations. */

import { Suspense } from "react";
import StewardAIWorkspace from "@/app/components/ai/StewardAIWorkspace";

/**
 * StewardAIWorkspaceRoute renders the dedicated full-page AI workspace.
 * Suspense is required here because StewardAIWorkspace calls useSearchParams()
 * — Next.js App Router requires a Suspense boundary around any component that
 * opts into CSR via that hook to allow static pre-rendering of the shell.
 */
export default function StewardAIWorkspaceRoute() {
  return (
    <Suspense fallback={null}>
      <StewardAIWorkspace />
    </Suspense>
  );
}
