/** Legacy campaign workspace route redirected to OyamaEmail campaign detail. */
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/** Resolves campaign ID and redirects into redesigned OyamaEmail campaign detail. */
export default async function CampaignWorkspacePage({ params }: PageProps) {
  const { campaignId } = await params;
  redirect(`/oyama-email/campaigns/${campaignId}`);
}
