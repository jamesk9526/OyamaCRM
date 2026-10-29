import Link from "next/link";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import type { StewardSuggestion } from "@/app/features/donor-dashboard/types";

/** Recommendations complement the canonical performance charts above. */
export function DonorDashboardOverviewSections({ suggestions }: { suggestions: StewardSuggestion[] }) {
  return <section aria-label="Steward recommendations" className="grid gap-3 md:grid-cols-2">
    {!suggestions.length ? <p className="text-sm text-slate-500">No recommendations for this reporting period.</p> : suggestions.slice(0, 4).map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3"><HeartHandshake className="h-5 w-5 text-[var(--crm-accent)]" aria-hidden="true" /><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.urgency === "high" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}>{item.urgency === "high" ? "High priority" : item.urgency === "medium" ? "Review next" : "Opportunity"}</span></div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
      <Link href={item.action.href} className="donor-text-link mt-3 inline-flex items-center gap-2">{item.action.label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
    </article>)}
  </section>;
}
