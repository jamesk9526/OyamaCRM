/** Retired project-status compatibility route. */
import { redirect } from "next/navigation";

export default function ProjectStatusPage() {
  redirect("/settings/system");
}
