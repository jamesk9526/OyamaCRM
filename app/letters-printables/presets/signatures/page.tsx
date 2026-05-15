/** Signature presets route for letters-printables workflow. */
import { redirect } from "next/navigation";

/** Redirects to dedicated signatures management route. */
export default function LetterSignaturePresetsPage() {
  redirect("/letters-printables/signatures");
}
