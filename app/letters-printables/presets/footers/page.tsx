/** Footer presets route for letters-printables workflow. */
import { redirect } from "next/navigation";

/** Redirects to branding controls where footer settings currently live. */
export default function LetterFooterPresetsPage() {
  redirect("/letters-printables/branding");
}
