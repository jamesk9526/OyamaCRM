/** Legacy Communications route that opens OyamaLetters Generate Center. */
import { redirect } from "next/navigation";

/** Keeps Communications deep links compatible with the canonical generator route. */
export default function CommunicationsGeneratePrintablesPage() {
  redirect("/oyama-letters/generate");
}
