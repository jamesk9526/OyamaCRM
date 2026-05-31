import { redirect } from "next/navigation";

/** New-path entry route that opens Path Library create flow. */
export default function StewardPathsNewRoute() {
  redirect("/steward-paths/library?create=1");
}
