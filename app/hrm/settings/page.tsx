// Settings route for OyamaHRM.

import HrmFeatureWorkspacePage from "@/app/components/hrm/HrmFeatureWorkspacePage";

/** HrmSettingsRoute renders HRM governance and permission scaffolding at /hrm/settings. */
export default function HrmSettingsRoute() {
  return (
    <HrmFeatureWorkspacePage
      title="HRM Settings"
      description="Configure HRM governance for people profiles, assignment eligibility, scheduling defaults, and interoffice communication policies."
      statusNote="Fine-grained HRM permission keys and audit controls are scaffolded for upcoming backend enforcement."
      highlights={[
        "HRM permission surfaces will align with platform role and user-permission infrastructure.",
        "Assignment policies will control who is visible to Compassion appointment assignment workflows.",
        "HRM data boundaries prohibit direct exposure of donor/client sensitive records.",
      ]}
      nextActions={[
        { label: "Open People", href: "/hrm/people" },
        { label: "Open Dashboard", href: "/hrm" },
      ]}
    />
  );
}
