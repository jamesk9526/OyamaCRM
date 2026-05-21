// Legacy password route compatibility wrapper.
import { redirect } from "next/navigation";

/** Redirects legacy /password links to the standalone app launcher route. */
export default function OyamaPasswordPage() {
  redirect("/apps/password-vault");
}
