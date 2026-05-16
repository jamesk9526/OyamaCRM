/** Existing template editor route. */
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";

interface LettersTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<{ fullscreen?: string; panel?: string }>;
}

/** Renders edit-template experience for one existing template record. */
export default async function LettersTemplateDetailPage({ params, searchParams }: LettersTemplateDetailPageProps) {
  const resolved = await params;
  const query = searchParams ? await searchParams : {};
  const panel = query.panel === "publish" ? "publish" : query.panel === "preview" ? "preview" : "document";
  return <LetterTemplateEditor templateId={resolved.templateId} fullScreen={query.fullscreen === "1"} initialPanel={panel} />;
}
