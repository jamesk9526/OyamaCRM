/**
 * Email Builder Page
 *
 * Thin server component — reads the `?campaign=ID` search param and
 * passes it to the interactive EmailBuilderApp client component.
 */

import EmailBuilderApp from '@/app/components/email-builder/EmailBuilderApp';

interface PageProps {
  /** Next.js 15+ provides searchParams as a Promise in server components. */
  searchParams: Promise<{ campaign?: string; returnTo?: string }>;
}

/** Demo campaign ids are synthetic and should not be passed to the regular builder as editable context. */
function sanitizeCampaignId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase().startsWith('demo_')) return undefined;
  return trimmed;
}

export default async function EmailBuilderPage({ searchParams }: PageProps) {
  const { campaign, returnTo } = await searchParams;
  return <EmailBuilderApp campaignId={sanitizeCampaignId(campaign)} returnTo={returnTo} />;
}
