/** Printable OyamaLetters route backed by the shared LetterPage renderer. */
import LetterPrintRoute from "@/app/components/letters/LetterPrintRoute";

interface OyamaLettersTemplatePrintPageProps {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ constituentId?: string }>;
}

/** Renders one template as a print-focused portrait letter page. */
export default async function OyamaLettersTemplatePrintPage({ params, searchParams }: OyamaLettersTemplatePrintPageProps) {
  const [resolved, query] = await Promise.all([params, searchParams]);
  return <LetterPrintRoute templateId={resolved.templateId} constituentId={query.constituentId} />;
}
