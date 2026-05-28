/** Standalone Oyama Letters Generate route redirects to the canonical CRM workspace. */
import { redirect } from "next/navigation";

/** Keeps the standalone entry compatible without serving duplicate UI. */
export default function LettersGeneratePage() {
  redirect(`${process.env.NEXT_PUBLIC_OYAMA_CRM_URL ?? "http://localhost:3000"}/oyama-letters/generate`);
}
