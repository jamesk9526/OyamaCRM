/** Shared campaign action shell for communications review/schedule routes. */
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

interface CommunicationCampaignActionPageProps {
  title: string;
  helper: string;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Renders a campaign-scoped action page while campaign-specific routes are consolidated.
 */
export default function CommunicationCampaignActionPage({ title, helper, ctaLabel, ctaHref }: CommunicationCampaignActionPageProps) {
  const params = useParams<{ id?: string; campaignId?: string }>();
  const campaignId = params?.campaignId ?? params?.id ?? "";

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{helper}</p>
      </header>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        Campaign ID: <span className="font-semibold text-gray-900">{campaignId || "Unknown"}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/communications?view=email-campaigns" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Back To Campaigns
        </Link>
        <Link href={ctaHref} className="rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
