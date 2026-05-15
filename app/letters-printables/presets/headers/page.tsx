/** Header presets route for letters-printables workflow. */
import { redirect } from "next/navigation";

/** Redirects to branding controls where header settings currently live. */
export default function LetterHeaderPresetsPage() {
  redirect("/letters-printables/branding");
}
