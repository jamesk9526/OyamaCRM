/** Branding presets have moved to centralized Branding Settings. */
import { redirect } from "next/navigation";

/** Redirects to the canonical branding preset management route in Settings. */
export default function LettersBrandingPage() {
  redirect("/settings/branding/letter-presets");
}
