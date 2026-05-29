/** OyamaEmail audience route. */
import { redirect } from "next/navigation";

/** Legacy route redirected to campaign workspace audience tab. */
export default function OyamaEmailAudiencePage() {
  redirect("/oyama-email/campaigns?tab=audience");
}
