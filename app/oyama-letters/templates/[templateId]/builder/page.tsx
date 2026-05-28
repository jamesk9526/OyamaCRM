/** Explicit OyamaLetters canvas builder route. */
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";

interface OyamaLettersTemplateBuilderPageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders the Microsoft Word-like canvas builder for one template. */
export default async function OyamaLettersTemplateBuilderPage({ params }: OyamaLettersTemplateBuilderPageProps) {
  const resolved = await params;
  return <OyamaLettersWorkspace view="builder" templateId={resolved.templateId} />;
}
