/** OyamaEmail single campaign route. */
import OyamaEmailWorkspace from "@/app/components/oyama-email/OyamaEmailWorkspace";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/** Opens campaign detail context inside redesigned campaigns workspace. */
export default async function OyamaEmailCampaignDetailPage({ params }: PageProps) {
  const resolved = await params;
  return <OyamaEmailWorkspace view="campaigns" campaignId={resolved.campaignId} />;
}
