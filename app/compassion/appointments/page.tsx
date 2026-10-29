import { Suspense } from "react";
import AppointmentsWorkspace from "@/app/components/compassion/appointments/AppointmentsWorkspace";
export default function CompassionAppointmentsPage() { return <Suspense fallback={<p role="status">Loading schedule...</p>}><AppointmentsWorkspace /></Suspense>; }
