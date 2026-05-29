/** OyamaEmail analytics route. */
import { redirect } from "next/navigation";

/** Legacy route redirected to campaign workspace analytics tab. */
export default function OyamaEmailAnalyticsPage() {
  redirect("/oyama-email/campaigns?tab=analytics");
}
