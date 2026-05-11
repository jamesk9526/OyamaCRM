// Locations route for OyamaHRM.

import HrmFeatureWorkspacePage from "@/app/components/hrm/HrmFeatureWorkspacePage";

/** HrmLocationsRoute renders first-pass location management scaffolding at /hrm/locations. */
export default function HrmLocationsRoute() {
  return (
    <HrmFeatureWorkspacePage
      title="Locations"
      description="Manage office locations, timezone context, active status, and location-level staffing references for scheduling and communication workflows."
      statusNote="Location CRUD and location-to-location message channels are being wired to backend APIs."
      highlights={[
        "Location records stay module-safe and contain internal operational metadata only.",
        "Scheduling rules will be stored per location and shared with appointment assignment views.",
        "Cross-location communication channels are planned in the internal message center.",
      ]}
      nextActions={[
        { label: "Open People Directory", href: "/hrm/people" },
        { label: "Review Scheduling", href: "/hrm/scheduling" },
      ]}
    />
  );
}
