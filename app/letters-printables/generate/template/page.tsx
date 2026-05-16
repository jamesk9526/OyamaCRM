/** Deprecated generation wizard step redirected to the unified generate workspace. */
import { redirect } from "next/navigation";

/** Preserves legacy step URL while using the new single-page generator. */
export default function LettersGenerateTemplatePage() {
  redirect("/letters-printables/generate");
}
