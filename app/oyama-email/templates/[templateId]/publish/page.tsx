/** OyamaEmail template publish and compliance route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

/** Renders publish checks and compliance workflow for one template. */
export default async function OyamaEmailTemplatePublishPage({ params }: PageProps) {
  const resolved = await params;
  return <OyamaEmailWorkspace view="publish" templateId={resolved.templateId} />;
}
