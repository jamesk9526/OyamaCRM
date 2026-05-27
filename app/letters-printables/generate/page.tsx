/** Deprecated Letters & Printables generation route. */
import { redirect } from "next/navigation";

interface LettersGeneratePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Preserves deep-link query values while opening the canonical OyamaLetters Generate Center. */
export default async function LettersGeneratePage({ searchParams }: LettersGeneratePageProps) {
  const params = toSearchParams(searchParams ? await searchParams : {});
  redirect(`/oyama-letters/generate${params.size > 0 ? `?${params.toString()}` : ""}`);
}

function toSearchParams(query: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
      continue;
    }
    if (value) params.set(key, value);
  }
  return params;
}
