import { Suspense } from "react";

import PublicTableLinkPortal from "@/app/components/events/public/PublicTableLinkPortal";

/** Public table host login entry point for EventSTUDIO TableLink. */
export default function PublicTableLinkLoginRoute() {
  return (
    <Suspense fallback={null}>
      <PublicTableLinkPortal />
    </Suspense>
  );
}
