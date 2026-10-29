import Link from "next/link";
import { ArrowUpRight, CalendarCheck, HeartHandshake, MailCheck, UserRoundPlus } from "lucide-react";
import type { DashboardData, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";

/** Each queue owns its availability so a failed chart never hides working donor tools. */
export default function DonorActionCenter({ data, summary, retention, loading, summaryUnavailable, detailsUnavailable }: {
  data: DashboardData | null;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  loading: boolean;
  summaryUnavailable: boolean;
  detailsUnavailable: boolean;
}) {
  const renewalQuery = new URLSearchParams({ report: "lapsed-donors" });
  if (summary?.period) {
    renewalQuery.set("dateBasis", summary.period.basis);
    renewalQuery.set("year", String(summary.period.year));
  }
  const queues = [
    { label: "Thank your donors", count: detailsUnavailable || !data || data.errors.some((error) => error.startsWith("Pending acknowledgments")) ? null : data.pendingAcknowledgmentCount, description: "Completed gifts without a recorded acknowledgment.", href: "/donations?acknowledgment=pending", action: "Review acknowledgments", Icon: MailCheck },
    { label: "Welcome first-time donors", count: summaryUnavailable ? null : summary?.newDonorsThisMonth ?? null, description: "Donors who made their first completed gift this month.", href: "/reports?report=first-time-donors&range=month-to-date", action: "Review new donors", Icon: UserRoundPlus },
    { label: "Renew relationships", count: summaryUnavailable || !retention ? null : Math.max(0, retention.total - retention.retained), description: "Prior-year donors yet to give this reporting year. Review seasonal giving before outreach.", href: `/reports?${renewalQuery}`, action: "Review donor renewals", Icon: HeartHandshake },
    { label: "Keep follow-ups moving", count: summaryUnavailable ? null : summary?.overdueTasks ?? null, description: "Pending constituent tasks past their due date. Your task permissions apply.", href: "/tasks?queue=overdue", action: "Review overdue tasks", Icon: CalendarCheck },
  ];
  return <section aria-labelledby="donor-action-center-title">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div><p className="donor-eyebrow">Your daily priorities</p><h2 id="donor-action-center-title" className="mt-1 text-lg font-semibold text-slate-900">Make the next connection</h2></div>
      <Link href="/tasks?focus=followups" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">All follow-ups →</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading} aria-live="polite">
      {queues.map(({ label, count, description, href, action, Icon }) => <Link key={label} href={href} className="donor-priority-card group">
        <div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5 text-[var(--crm-accent)]" aria-hidden="true" /><span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{loading ? "…" : count === null ? "—" : count.toLocaleString()}</span></div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">{label}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{!loading && count === null ? "This queue could not be loaded. Open the workspace to review it." : description}</p>
        <span className="mt-4 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--crm-accent)]">{action}<ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" /></span>
      </Link>)}
    </div>
  </section>;
}
