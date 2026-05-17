/** Compatibility route that forwards generated-media links to the unified queues workspace. */
import { redirect } from "next/navigation";

interface LettersGeneratedPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Preserves query filters while opening the production queue view. */
export default async function LettersGeneratedPage({ searchParams }: LettersGeneratedPageProps) {
  const query = searchParams ? await searchParams : {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    if (value) {
      params.set(key, value);
    }
  }

  params.set("view", "production");
  redirect(`/letters-printables/queues?${params.toString()}`);
}
