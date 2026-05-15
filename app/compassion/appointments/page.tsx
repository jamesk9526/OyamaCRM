// Compassion CRM appointments route composed from the production scheduling workspace.

import AppointmentsWorkspace from "@/app/components/compassion/appointments/AppointmentsWorkspace";

/**
 * CompassionAppointmentsPage renders the office-facing appointment scheduling hub.
 * Access enforcement is handled by CompassionLayout and /api/compassion middleware.
 */
export default function CompassionAppointmentsPage() {
  return <AppointmentsWorkspace />;
}
