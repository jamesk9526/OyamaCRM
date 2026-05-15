/** Signature presets route — now managed in centralized Branding Settings. */
import { redirect } from "next/navigation";

/** Redirects to centralized signature management in Settings. */
export default function LetterSignaturePresetsPage() {
  redirect("/settings/branding/signatures");
}
