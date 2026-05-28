/** OyamaLetters canvas builder route. */
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";

interface OyamaLettersTemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders the dedicated page-canvas builder for one template. */
export default async function OyamaLettersTemplateDetailPage({ params }: OyamaLettersTemplateDetailPageProps) {
  const resolved = await params;
  return <OyamaLettersWorkspace view="builder" templateId={resolved.templateId} />;
}
