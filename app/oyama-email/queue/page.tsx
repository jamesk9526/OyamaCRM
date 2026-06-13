/** OyamaEmail queue route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

/** Renders drafted and sent email records in the dedicated queue workspace. */
export default function OyamaEmailQueuePage() {
  return <OyamaEmailWorkspace view="queue" />;
}
