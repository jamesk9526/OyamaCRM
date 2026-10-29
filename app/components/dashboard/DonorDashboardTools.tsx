import Link from "next/link";
import { ArrowUpRight, FileCheck2, Repeat2, SearchCheck, UsersRound } from "lucide-react";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import type { DashboardData } from "@/app/features/donor-dashboard/types";

const tools = [
  { title: "Recurring giving", description: "Review sustaining donors and completed recurring gifts.", href: "/reports?report=recurring-giving", Icon: Repeat2 },
  { title: "Annual statements", description: "Review calendar-year giving and print donor statements.", href: "/reports?report=tax-deductible-giving", Icon: FileCheck2 },
  { title: "Donor research", description: "Review public research and relationship context.", href: "/donor-research", Icon: SearchCheck },
  { title: "Data quality", description: "Review duplicate records and prepare clean imports.", href: "/data-tools", Icon: UsersRound },
];

export default function DonorDashboardTools({ data, loading, unavailable }: { data: DashboardData | null; loading: boolean; unavailable: boolean }) {
  const campaignsUnavailable = unavailable || !data || data.errors.some((error) => error.startsWith("Campaign impact"));
  return <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Donor tools and campaign progress">
    <CRMCard padding="md" className="min-w-0">
      <h2 className="text-lg font-semibold text-slate-900">Donor toolkit</h2>
      <p className="mt-1 text-xs text-slate-500">Useful tools for a complete donor relationship.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{tools.map(({ title, description, href, Icon }) => <Link key={title} href={href} className="donor-tool-link">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--crm-accent)]" aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
      </Link>)}</div>
    </CRMCard>
    <CRMCard padding="md" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-slate-900">Active campaigns</h2><Link href="/campaigns?scope=ALL_YEARS" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">View campaigns →</Link></div>
      <p className="mt-1 text-xs text-slate-500">Up to six active campaigns · completed gifts across all years</p>
      <div className="mt-3" aria-live="polite" aria-busy={loading}>
        {loading ? <p className="py-5 text-sm text-slate-500">Loading campaign progress…</p> : campaignsUnavailable ? <p className="py-5 text-sm text-slate-600">Campaign progress could not be loaded. Open campaigns or retry the dashboard.</p> : !data.campaigns.length ? <p className="py-5 text-sm text-slate-500">No active campaigns. Open campaigns to plan your next appeal.</p> : <ul className="divide-y divide-slate-100">{data.campaigns.map((campaign) => {
          const goal = toDashboardNumber(campaign.goal);
          const raised = toDashboardNumber(campaign.totalRaised);
          const percentage = goal > 0 ? Math.round(raised / goal * 100) : 0;
          return <li key={campaign.id} className="py-3"><Link href={`/campaigns/${encodeURIComponent(campaign.id)}?scope=ALL_YEARS`} className="flex items-start justify-between gap-3 text-sm font-semibold text-slate-800 hover:underline"><span className="break-words">{campaign.name}</span><ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--crm-accent)]" aria-hidden="true" /></Link>
            <p className="mt-1 text-xs text-slate-500">{formatDashboardCurrency(raised)} raised{goal > 0 ? ` · ${percentage}% of ${formatDashboardCurrency(goal)}` : " · No goal set"}</p>
            {goal > 0 ? <progress className="donor-campaign-progress mt-2" max={100} value={Math.max(0, Math.min(100, percentage))} aria-label={`${campaign.name}: ${percentage}% of goal`} /> : null}
          </li>;
        })}</ul>}
      </div>
    </CRMCard>
  </section>;
}
