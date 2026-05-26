/**
 * CampaignImpactCards renders visual progress cards for each active campaign,
 * showing giving progress toward the goal with organic design and mission framing.
 */
"use client";

import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  goal: number | string | null;
  totalRaised?: number | string | null;
  endDate?: string | null;
  category?: string | null;
  active: boolean;
}

interface CampaignImpactCardsProps {
  campaigns: Campaign[];
  loading: boolean;
}

function toNumber(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toFixed(0)}`;
}

function daysLeft(endDateStr: string | null | undefined): number | null {
  if (!endDateStr) return null;
  const diff = new Date(endDateStr).getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / 86_400_000);
}

const CATEGORY_LABEL: Record<string, string> = {
  ANNUAL_FUND: "Annual Fund",
  CAPITAL_CAMPAIGN: "Capital Campaign",
  EVENT: "Event",
  EMERGENCY: "Emergency",
  RECURRING: "Recurring",
  ENDOWMENT: "Endowment",
};

/** CampaignImpactCards — visual campaign progress grid with organic design. */
export default function CampaignImpactCards({ campaigns, loading }: CampaignImpactCardsProps) {
  const activeCampaigns = campaigns.filter((c) => c.active);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Campaign Impact</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            {loading ? "Loading…" : `${activeCampaigns.length} active campaign${activeCampaigns.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/campaigns" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition">
          All campaigns
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : activeCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-4" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600">No active campaigns right now</p>
          <p className="mt-1 max-w-xs text-xs text-slate-400">Create a campaign to track giving goals and show impact.</p>
          <Link href="/campaigns?new=1" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
            Create campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeCampaigns.slice(0, 6).map((campaign, idx) => {
            const raised = toNumber(campaign.totalRaised);
            const goal = toNumber(campaign.goal);
            const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null;
            const days = daysLeft(campaign.endDate);

            // Natural gradient palette per card
            const GRADIENTS = [
              "from-emerald-900 to-emerald-700",
              "from-teal-900 to-teal-700",
              "from-slate-800 to-emerald-800",
              "from-emerald-800 to-cyan-700",
              "from-green-900 to-emerald-600",
              "from-stone-800 to-emerald-700",
            ];
            const gradient = GRADIENTS[idx % GRADIENTS.length];

            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 shadow-md transition hover:shadow-lg`}
              >
                {/* Decorative circle */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5" aria-hidden="true" />

                {/* Category badge */}
                {campaign.category ? (
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    {CATEGORY_LABEL[campaign.category] ?? campaign.category}
                  </span>
                ) : <div className="mb-3 h-5" />}

                {/* Campaign name */}
                <h3 className="text-base font-bold leading-tight text-white">{campaign.name}</h3>

                {/* Metrics */}
                <div className="mt-4">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-2xl font-bold text-white">{formatCurrency(raised)}</p>
                    {goal > 0 ? (
                      <p className="text-xs font-semibold text-white/60">of {formatCurrency(goal)}</p>
                    ) : null}
                  </div>

                  {/* Progress bar */}
                  {pct != null ? (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-white/60">
                        <span>{pct}% of goal</span>
                        {days != null ? (
                          <span>{days}d left</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
