/** Standalone Oyama Letters template editor redirects to the canonical CRM workspace. */
import { redirect } from "next/navigation";

interface LettersTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<{ panel?: string }>;
}

/** Keeps the standalone entry compatible without serving duplicate UI. */
export default async function LettersTemplateDetailPage({ params, searchParams }: LettersTemplateDetailPageProps) {
  const resolved = await params;
  const query = searchParams ? await searchParams : {};
  const suffix = query.panel === "publish" ? "/publish" : "";
  redirect(`${process.env.NEXT_PUBLIC_OYAMA_CRM_URL ?? "http://localhost:3000"}/oyama-letters/templates/${encodeURIComponent(resolved.templateId)}${suffix}`);
}
