/** /settings/plugins compatibility route redirects to unified integrations page. */
import { redirect } from "next/navigation";

export default function PluginsPage() {
  redirect("/settings/integrations#plugins");
}
