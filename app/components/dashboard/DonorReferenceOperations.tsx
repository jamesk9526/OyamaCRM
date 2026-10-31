"use client";
import Link from "next/link";
import { CalendarDays, CheckSquare, Gift } from "lucide-react";
import type { DashboardData } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import TasksWidget from "./TasksWidget";
import MeetingsWidget from "./MeetingsWidget";
export default function DonorReferenceOperations({ data, loading, unavailable, revision }: { data: DashboardData | null; loading: boolean; unavailable: boolean; revision: number }) {
  const gifts = data?.recentDonations.slice(0, 5) ?? [];
  return <section className="donor-reference-operations" aria-label="Daily donor work">
    <article className="donor-reference-widget"><header><h2><Gift size={18} />Recent Donations</h2><Link href="/donations">View All</Link></header><div className="overflow-x-auto">{loading ? <p role="status" className="p-4 text-sm">Loading recent donations…</p> : unavailable ? <p className="p-4 text-sm">Recent donations unavailable. Use Refresh to retry.</p> : !gifts.length ? <p className="p-4 text-sm">No recent completed donations.</p> : <table className="w-full text-xs"><thead><tr><th>Date</th><th>Donor</th><th>Amount</th><th>Campaign</th></tr></thead><tbody>{gifts.map(gift => <tr key={gift.id}><td>{new Date(gift.date).toLocaleDateString()}</td><td>{gift.constituent ? <Link href={`/constituents/${gift.constituent.id}`}>{gift.constituent.firstName} {gift.constituent.lastName}</Link> : "Unavailable"}</td><td><Link href={`/donations/${gift.id}`}>{formatDashboardCurrency(toDashboardNumber(gift.amount))}</Link></td><td>{gift.campaign?.name || "—"}</td></tr>)}</tbody></table>}</div></article>
    <article className="donor-reference-widget"><header><h2><CheckSquare size={18} />Tasks & Next Steps</h2><Link href="/tasks">View All</Link></header><div className="donor-reference-task-content"><TasksWidget key={revision} /></div></article>
    <article className="donor-reference-widget"><header><h2><CalendarDays size={18} />Upcoming Meetings</h2><Link href="/meetings">View All</Link></header><div className="donor-reference-meeting-content"><MeetingsWidget key={revision} /></div></article>
  </section>;
}
