/** Compatibility route for the new OyamaLetters workspace. */
import { redirect } from "next/navigation";

/** Redirects short `/letters` links to the canonical OyamaLetters app space. */
export default function LettersCompatibilityPage() {
  redirect("/oyama-letters");
}
