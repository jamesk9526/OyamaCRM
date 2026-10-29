/** Compassion CRM clients route composed from the production client workspace. */
import ClientsWorkspace from "@/app/components/compassion/clients/ClientsWorkspace";
import { Suspense } from "react";

/** Renders the client management workspace inside the Compassion shell. */
export default function CompassionClientsPage() {
  return <Suspense fallback={<p role="status">Loading client directory…</p>}><ClientsWorkspace /></Suspense>;
}
