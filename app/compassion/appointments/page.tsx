// Compassion CRM appointments route composed from the production scheduling workspace.

import AppointmentsWorkspace from "@/app/components/compassion/appointments/AppointmentsWorkspace";

/**
 * CompassionAppointmentsPage renders the office-facing appointment scheduling hub.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionAppointmentsPage() {
  return <AppointmentsWorkspace />;
}
