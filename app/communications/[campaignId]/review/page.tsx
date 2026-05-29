/** Legacy campaign review route redirected to OyamaEmail campaign detail. */
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/** Resolves campaign ID and redirects to redesigned campaign page. */
export default async function CommunicationReviewPage({ params }: PageProps) {
  const { campaignId } = await params;
  redirect(`/oyama-email/campaigns/${campaignId}`);
}
