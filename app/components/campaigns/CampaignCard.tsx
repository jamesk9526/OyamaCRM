/**
 * CampaignCard component.
 * Displays a single fundraising campaign with name, category badge,
 * progress bar, dates, active/inactive status, and Edit/Delete actions.
 */

import Link from "next/link";
import StewardContextButton from "@/app/components/ai/StewardContextButton";
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
  scopeLabel?: string;
  onInfo?: () => void;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (id: string) => void;
}

/** CampaignCard: card view of a single fundraising campaign with actions */
export default function CampaignCard({ campaign, scopeLabel, onInfo, onEdit, onDelete }: Props) {
  const goal = Number(campaign.goal ?? 0);
  const raised = campaign.totalRaised ?? 0;
  // pct is capped at 100 for the progress bar; actualPct is the true percentage for prompts/text
  const actualPct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
  const pct = Math.min(100, actualPct);

  return (
    <article className="group flex min-h-[248px] flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)]">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-950">{campaign.name}</h3>
        <span className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${campaign.active ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
          {campaign.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Category badge */}
      <span className={`self-start inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryColor(campaign.category)}`}>
        {categoryLabel(campaign.category)}
      </span>

      {/* Progress bar */}
      {goal > 0 && (
        <div>
          <div className="mb-1.5 flex justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">${raised.toLocaleString()} raised</span>
            <span className={actualPct > 100 ? "font-semibold text-emerald-700" : undefined}>{actualPct}% of ${goal.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">{actualPct >= 100 ? "Goal reached — review next stewardship move." : `$${Math.max(0, goal - raised).toLocaleString()} remaining to goal`}</p>
        </div>
      )}

      {/* Dates */}
      <div className="mt-auto flex items-center gap-2 text-xs text-slate-500">
        <span>Started {fmtDate(campaign.startDate)}</span>
        {campaign.endDate && <><span>·</span><span>Ends {fmtDate(campaign.endDate)}</span></>}
      </div>

      {scopeLabel && <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Snapshot scope: {scopeLabel}</p>}

      {/* Donation count + actions row */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        {campaign._count ? (
          <p className="text-xs text-slate-500">{campaign._count.donations} completed donation{campaign._count.donations !== 1 ? "s" : ""}</p>
        ) : <span />}
        <div className="flex items-center gap-1.5">
          <Link
            href={`/campaigns/${campaign.id}`}
            onClick={(event) => {
              if (!onInfo) return;
              event.preventDefault();
              onInfo();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            Info
          </Link>
          {onEdit && (
            <button
              onClick={() => onEdit(campaign)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(campaign.id)}
              className="inline-flex items-center rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
              title="Delete campaign"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <StewardContextButton
            label="Analyze"
            prompt={`Analyze the "${campaign.name}" campaign using ${scopeLabel ?? "current workspace"} snapshot metrics. It has raised $${raised.toLocaleString()} of a $${goal.toLocaleString()} goal (${actualPct}% of goal${actualPct > 100 ? ` — ${(actualPct - 100).toLocaleString()}% over goal` : ""}). Category: ${categoryLabel(campaign.category)}. Status: ${campaign.active ? "Active" : "Inactive"}. Suggest donor segments to target, messaging improvements, and concrete next steps to reach the goal.`}
            moduleKey="donor"
            mode="analyze"
            variant="mini"
          />
        </div>
      </div>
    </article>
  );
}
