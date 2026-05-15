/** Entry page for the new communications project wizard. */
import { redirect } from "next/navigation";

/** Redirects directly to wizard type selection. */
export default function CommunicationsNewPage() {
  redirect("/communications/new/type");
}
