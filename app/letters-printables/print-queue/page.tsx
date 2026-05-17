/** Compatibility route that forwards print-queue links to the unified queues workspace. */
import { redirect } from "next/navigation";

interface LettersPrintQueuePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Preserves query params while opening the print queue view. */
export default async function LettersPrintQueuePage({ searchParams }: LettersPrintQueuePageProps) {
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

  params.set("view", "print");
  redirect(`/letters-printables/queues?${params.toString()}`);
}
