/** Legacy Communications route that opens the canonical OyamaLetters workspace. */
import { redirect } from "next/navigation";

/** Keeps deep links compatible while routing to the canonical printable workspace. */
export default function CommunicationsLettersPrintablesPage() {
  redirect("/oyama-letters");
}
