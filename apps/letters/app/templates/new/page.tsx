/** Standalone Oyama Letters new template builder route. */
import LetterTemplateEditor from "@/components/letters/LetterTemplateEditor";

interface LettersNewTemplatePageProps {
  searchParams?: Promise<{ fullscreen?: string }>;
}

/** Renders the create-template editor. */
export default async function LettersNewTemplatePage({ searchParams }: LettersNewTemplatePageProps) {
  const query = searchParams ? await searchParams : {};
  return <LetterTemplateEditor fullScreen={query.fullscreen === "1"} />;
}
