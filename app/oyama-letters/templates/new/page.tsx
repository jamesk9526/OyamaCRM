/** New OyamaLetters template builder route. */
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";

interface OyamaLettersNewTemplatePageProps {
  searchParams?: Promise<{ fullscreen?: string }>;
}

/** Renders create-template editor for OyamaLetters. */
export default async function OyamaLettersNewTemplatePage({ searchParams }: OyamaLettersNewTemplatePageProps) {
  const query = searchParams ? await searchParams : {};
  return <LetterTemplateEditor fullScreen={query.fullscreen === "1"} />;
}
