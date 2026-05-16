/** New letter template builder route. */
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";

interface LettersNewTemplatePageProps {
  searchParams?: Promise<{ fullscreen?: string }>;
}

/** Renders create-template editor for letters workspace. */
export default async function LettersNewTemplatePage({ searchParams }: LettersNewTemplatePageProps) {
  const query = searchParams ? await searchParams : {};
  return <LetterTemplateEditor fullScreen={query.fullscreen === "1"} />;
}
