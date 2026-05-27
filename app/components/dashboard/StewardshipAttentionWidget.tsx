/** StewardshipAttentionWidget shows donor follow-up counts that need action today. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardshipAttentionWidgetProps {
  newDonorsThisMonth: number;
  loading?: boolean;
}

interface DonationRow {
  id: string;
  amount: number | string;
  date: string;
  acknowledgmentSentAt?: string | null;
}

interface DonationListResponse {
  items?: DonationRow[];
}

interface ConstituentRow {
  id: string;
}

/** StewardshipAttentionWidget renders actionable donor stewardship counts and links. */
export default function StewardshipAttentionWidget({
  newDonorsThisMonth,
  loading = false,
}: StewardshipAttentionWidgetProps) {
  const [unthankedGiftCount, setUnthankedGiftCount] = useState(0);
  const [unthankedGiftTotal, setUnthankedGiftTotal] = useState(0);
  const [majorFollowUpCount, setMajorFollowUpCount] = useState(0);
  const [lapsedDonorCount, setLapsedDonorCount] = useState(0);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load high-priority stewardship counts from existing donor APIs without adding new endpoints.
  useEffect(() => {
    let active = true;

    async function loadStewardshipAttention() {
      setWidgetLoading(true);
      setError(null);
      try {
        const [donationsResult, lapsedResult] = await Promise.all([
          apiFetch<DonationListResponse>("/api/donations?status=COMPLETED&limit=200&page=1"),
          apiFetch<ConstituentRow[]>("/api/constituents?status=LAPSED&limit=200"),
        ]);

        if (!active) return;

        const completedDonations = donationsResult.items ?? [];
        const unthanked = completedDonations.filter((donation) => !donation.acknowledgmentSentAt);
        const majorUnthanked = unthanked.filter((donation) => Number(donation.amount ?? 0) >= 1000);
        const totalUnthanked = unthanked.reduce((sum, donation) => sum + Number(donation.amount ?? 0), 0);

        setUnthankedGiftCount(unthanked.length);
        setUnthankedGiftTotal(totalUnthanked);
        setMajorFollowUpCount(majorUnthanked.length);
        setLapsedDonorCount(Array.isArray(lapsedResult) ? lapsedResult.length : 0);
      } catch {
        if (!active) return;
        setUnthankedGiftCount(0);
        setUnthankedGiftTotal(0);
        setMajorFollowUpCount(0);
        setLapsedDonorCount(0);
        setError("Stewardship attention counts could not be loaded.");
      } finally {
        if (active) {
          setWidgetLoading(false);
        }
      }
    }

    void loadStewardshipAttention();

    return () => {
      active = false;
    };
  }, []);

  if (loading || widgetLoading) {
    return <div className="h-28 rounded-lg bg-gray-100 animate-pulse" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">Stewardship attention unavailable</p>
        <p className="mt-1 text-xs text-amber-700">{error}</p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Unthanked Gifts",
      value: unthankedGiftCount.toLocaleString(),
      tone: unthankedGiftCount > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200",
      href: "/donations",
    },
    {
      label: "Unthanked Value",
      value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(unthankedGiftTotal),
      tone: unthankedGiftTotal > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200",
      href: "/oyama-letters/generate",
    },
    {
      label: "Major Follow-Up",
      value: majorFollowUpCount.toLocaleString(),
      tone: majorFollowUpCount > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200",
      href: "/tasks",
    },
    {
      label: "Lapsed Donors",
      value: lapsedDonorCount.toLocaleString(),
      tone: lapsedDonorCount > 0 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-green-700 bg-green-50 border-green-200",
      href: "/constituents?status=LAPSED",
    },
    {
      label: "New Donors",
      value: newDonorsThisMonth.toLocaleString(),
      tone: newDonorsThisMonth > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-gray-700 bg-gray-50 border-gray-200",
      href: "/constituents",
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {metrics.slice(0, 4).map((metric) => (
          <Link key={metric.label} href={metric.href} className={`rounded-lg border px-3 py-2 ${metric.tone} hover:opacity-90 transition-opacity`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{metric.label}</p>
            <p className="text-lg font-semibold mt-0.5">{metric.value}</p>
          </Link>
        ))}
      </div>
      <Link
        href={metrics[4].href}
        className={`block rounded-lg border px-3 py-2 ${metrics[4].tone} hover:opacity-90 transition-opacity`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{metrics[4].label}</p>
        <p className="text-lg font-semibold mt-0.5">{metrics[4].value}</p>
      </Link>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/oyama-letters/generate" className="px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          Generate Thank-You Letter
        </Link>
        <Link href="/tasks" className="px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          Create Follow-Up Task
        </Link>
        <Link href="/communications" className="px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          Draft Re-engagement Email
        </Link>
      </div>
    </div>
  );
}
