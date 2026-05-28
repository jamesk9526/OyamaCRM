/** Explicit OyamaLetters publish workspace route. */
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";

interface OyamaLettersTemplatePublishPageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders merge-field validation and publish readiness for one template. */
export default async function OyamaLettersTemplatePublishPage({ params }: OyamaLettersTemplatePublishPageProps) {
  const resolved = await params;
  return <OyamaLettersWorkspace view="publish" templateId={resolved.templateId} />;
}
