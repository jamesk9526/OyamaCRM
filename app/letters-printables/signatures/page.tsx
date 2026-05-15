/** Signature blocks have moved to centralized Branding Settings. */
import { redirect } from "next/navigation";

/** Redirects to the canonical signature management route in Settings. */
export default function LettersSignaturesPage() {
  redirect("/settings/branding/signatures");
}
