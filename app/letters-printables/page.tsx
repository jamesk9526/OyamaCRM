/** Deprecated Letters & Printables workspace entry. */
import { redirect } from "next/navigation";

/** Redirects old links to the canonical OyamaLetters production center. */
export default function LettersPrintablesPage() {
  redirect("/oyama-letters");
}
