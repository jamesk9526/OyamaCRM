/** Campaign workspace page route for one communications mailing. */
import CampaignWorkspace from "@/app/components/communications/CampaignWorkspace";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/** CampaignWorkspacePage resolves the route campaign ID and renders the client workspace. */
export default async function CampaignWorkspacePage({ params }: PageProps) {
  const { campaignId } = await params;
  return <CampaignWorkspace campaignId={campaignId} />;
}
