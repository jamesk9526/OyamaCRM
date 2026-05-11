/** OGentic legacy route now forwards users into the main donor workspace with docked Steward chat. */

import { redirect } from "next/navigation";

/** OGenticPage keeps backward compatibility for old links by opening Steward in donor mode. */
export default function OGenticPage() {
  redirect("/?steward=open");
}
