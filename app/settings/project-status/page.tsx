/** /settings/project-status compatibility route redirects to merged system status page. */
import { redirect } from "next/navigation";

export default function ProjectStatusPage() {
  redirect("/settings/system-status#project-status");
}
