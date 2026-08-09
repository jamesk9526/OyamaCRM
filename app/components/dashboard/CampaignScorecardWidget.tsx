"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

type Campaign = { id: string; name: string; goal: number | null; totalRaised: number };

export default function CampaignScorecardWidget() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiFetch<Campaign[]>("/api/campaigns?active=true&limit=5")
      .then((data) => { if (!cancelled) setCampaigns(Array.isArray(data) ? data.sort((a, b) => b.totalRaised - a.totalRaised).slice(0, 3) : []); })
      .catch(() => { if (!cancelled) { setError(true); setCampaigns([]); } });
    return () => { cancelled = true; };
  }, []);
  if (!campaigns) return <div className="h-32 animate-pulse rounded-lg bg-gray-50" />;
  if (error || campaigns.length === 0) return <p className="flex h-32 items-center justify-center text-sm text-gray-400">{error ? "Campaign data could not be loaded." : "No active campaigns yet."}</p>;
  return <div className="space-y-3">
    {campaigns.map((campaign) => {
      const goal = Number(campaign.goal ?? 0);
      const progress = goal > 0 ? Math.min((campaign.totalRaised / goal) * 100, 100) : 0;
      return <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-gray-50">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-gray-800">{campaign.name}</span><span className="shrink-0 font-semibold text-gray-700">${campaign.totalRaised.toLocaleString()}</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${progress}%` }} /></div>
        <p className="mt-1 text-[11px] text-gray-400">{goal > 0 ? `${Math.round(progress)}% of $${goal.toLocaleString()} goal` : "No goal set"}</p>
      </Link>;
    })}
    <Link href="/campaigns" className="inline-flex pt-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">View campaigns →</Link>
  </div>;
}
