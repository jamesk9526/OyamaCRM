/** Printable OyamaLetters route backed by the shared LetterPage renderer. */
import LetterPrintRoute from "@/app/components/letters/LetterPrintRoute";

interface OyamaLettersTemplatePrintPageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders one template as a print-focused portrait letter page. */
export default async function OyamaLettersTemplatePrintPage({ params }: OyamaLettersTemplatePrintPageProps) {
  const resolved = await params;
  return <LetterPrintRoute templateId={resolved.templateId} />;
}
