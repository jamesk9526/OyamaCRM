import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

function sanitizeCampaignId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase().startsWith("demo_")) return undefined;
  return trimmed;
}

export default async function EmailBuilderRedirectPage({ searchParams }: PageProps) {
  const { campaign } = await searchParams;
  const campaignId = sanitizeCampaignId(campaign);
  redirect(campaignId ? `/oyama-email/templates/${encodeURIComponent(campaignId)}/builder` : "/oyama-email/templates/new");
}
