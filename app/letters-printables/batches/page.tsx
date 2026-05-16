/** Deprecated batch route redirected to the unified generation workspace. */
import { redirect } from "next/navigation";

interface LettersBatchGenerationPageProps {
  searchParams?: Promise<{ templateId?: string }>;
}

/** Preserves old batch links while removing the legacy batch exporter UI. */
export default async function LettersBatchGenerationPage({ searchParams }: LettersBatchGenerationPageProps) {
  const query = searchParams ? await searchParams : {};
  const params = new URLSearchParams({ mode: "batch" });
  if (query.templateId) params.set("templateId", query.templateId);
  redirect(`/letters-printables/generate?${params.toString()}`);
}
