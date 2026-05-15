/** Footer presets route — now managed in centralized Branding Settings. */
import { redirect } from "next/navigation";

/** Redirects to centralized letter preset management in Settings. */
export default function LetterFooterPresetsPage() {
  redirect("/settings/branding/letter-presets");
}
