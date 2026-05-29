/** OyamaEmail template builder route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders the redesigned email builder for one template. */
export default async function OyamaEmailTemplateBuilderPage({ params }: PageProps) {
  const resolved = await params;
  return <OyamaEmailWorkspace view="builder" templateId={resolved.templateId} />;
}
