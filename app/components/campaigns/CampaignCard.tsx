/**
 * CampaignCard component.
 * Displays a single fundraising campaign with name, category badge,
 * progress bar, dates, and active/inactive status.
 */

import { Campaign } from "@/app/campaigns/page";

/** Map CampaignCategory enum values to display labels */
function categoryLabel(cat: string) {
  return cat.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tailwind classes for category badge */
function categoryColor(cat: string) {
  switch (cat) {
    case "ANNUAL_FUND": return "bg-blue-50 text-blue-700";
    case "CAPITAL": return "bg-purple-50 text-purple-700";
    case "EVENT": return "bg-orange-50 text-orange-700";
    case "GIVING_DAY": return "bg-pink-50 text-pink-700";
    case "MAJOR_GIFTS": return "bg-amber-50 text-amber-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

/** Format a date string to short month/year */
function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  campaign: Campaign;
}

/** CampaignCard: card view of a single fundraising campaign */
export default function CampaignCard({ campaign }: Props) {
  const goal = Number(campaign.goal ?? 0);
  const raised = campaign.totalRaised ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{campaign.name}</h3>
        <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-xs font-medium ${campaign.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {campaign.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Category badge */}
      <span className={`self-start inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryColor(campaign.category)}`}>
        {categoryLabel(campaign.category)}
      </span>

      {/* Progress bar */}
      {goal > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>${raised.toLocaleString()} raised</span>
            <span>{pct}% of ${goal.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mt-auto">
        <span>Started {fmtDate(campaign.startDate)}</span>
        {campaign.endDate && <><span>·</span><span>Ends {fmtDate(campaign.endDate)}</span></>}
      </div>

      {/* Donation count */}
      {campaign._count && (
        <p className="text-xs text-gray-400">{campaign._count.donations} donation{campaign._count.donations !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
