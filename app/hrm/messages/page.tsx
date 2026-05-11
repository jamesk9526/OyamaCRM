// Internal messages route for OyamaHRM.

import HrmFeatureWorkspacePage from "@/app/components/hrm/HrmFeatureWorkspacePage";

/** HrmMessagesRoute renders first-pass internal communication workspace at /hrm/messages. */
export default function HrmMessagesRoute() {
  return (
    <HrmFeatureWorkspacePage
      title="Internal Messages"
      description="Coordinate staff-to-staff communication, department notices, and location-to-location updates without exposing donor or client-sensitive records."
      statusNote="Inbox, sent, archive, and read-status persistence are planned in the next implementation pass."
      highlights={[
        "Internal communication will support person, department, and location recipients.",
        "Priority levels (normal/high/urgent) will be tracked for operations alerts.",
        "Announcements and messaging remain separated from donor/client timeline records.",
      ]}
      nextActions={[
        { label: "Open Dashboard", href: "/hrm" },
        { label: "Open Locations", href: "/hrm/locations" },
      ]}
    />
  );
}
