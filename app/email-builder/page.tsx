/**
 * Email Builder Page
 *
 * Thin server component — reads the `?campaign=ID` search param and
 * passes it to the interactive EmailBuilderApp client component.
 */

import EmailBuilderApp from '@/app/components/email-builder/EmailBuilderApp';

interface PageProps {
  /** Next.js 15+ provides searchParams as a Promise in server components. */
  searchParams: Promise<{ campaign?: string }>;
}

export default async function EmailBuilderPage({ searchParams }: PageProps) {
  const { campaign } = await searchParams;
  return <EmailBuilderApp campaignId={campaign} />;
}
