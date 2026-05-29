/** OyamaEmail send wizard route. */
import { redirect } from "next/navigation";

/** Legacy route redirected to campaign-first wizard entry. */
export default function OyamaEmailSendPage() {
  redirect("/oyama-email/campaigns/new");
}
