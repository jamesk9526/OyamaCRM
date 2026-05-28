/** Standalone Oyama Letters template library redirects to the canonical CRM workspace. */
import { redirect } from "next/navigation";

/** Keeps the standalone entry compatible without serving duplicate UI. */
export default function LettersTemplatesPage() {
  redirect(`${process.env.NEXT_PUBLIC_OYAMA_CRM_URL ?? "http://localhost:3000"}/oyama-letters/templates`);
}
