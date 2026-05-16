/** Existing template editor route. */
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";

interface LettersTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<{ fullscreen?: string }>;
}

/** Renders edit-template experience for one existing template record. */
export default async function LettersTemplateDetailPage({ params, searchParams }: LettersTemplateDetailPageProps) {
  const resolved = await params;
  const query = searchParams ? await searchParams : {};
  return <LetterTemplateEditor templateId={resolved.templateId} fullScreen={query.fullscreen === "1"} />;
}
