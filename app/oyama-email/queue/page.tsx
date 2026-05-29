/** OyamaEmail queue route. */
import { redirect } from "next/navigation";

/** Legacy route redirected to campaign workspace queue tab. */
export default function OyamaEmailQueuePage() {
  redirect("/oyama-email/campaigns?tab=queue");
}
