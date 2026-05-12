/** Existing template editor route. */
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";

interface LettersTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders edit-template experience for one existing template record. */
export default async function LettersTemplateDetailPage({ params }: LettersTemplateDetailPageProps) {
  const resolved = await params;
  return <LetterTemplateEditor templateId={resolved.templateId} />;
}
