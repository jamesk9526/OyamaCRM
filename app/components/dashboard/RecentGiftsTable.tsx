import Link from "next/link";
import type { DonationPreview } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { formatDonationDate } from "@/app/components/donations/donation-utils";

export default function RecentGiftsTable({gifts, loading, unavailable}: {gifts: DonationPreview[]; loading: boolean; unavailable: boolean}) {
  if (loading) return <p role="status" className="py-6 text-sm text-slate-500">Loading recent donations…</p>;
  if (unavailable) return <p className="py-6 text-sm text-slate-600">Recent donations unavailable. Use Refresh to retry.</p>;
  if (!gifts.length) return <p className="py-6 text-sm text-slate-500">No recent completed donations.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-xs">
    <caption className="sr-only">Recent completed donations</caption>
    <thead><tr>{["Date", "Donor", "Amount", "Campaign"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{gifts.map(gift => <tr key={gift.id}>
      <td>{formatDonationDate(gift.date)}</td>
      <td>{gift.constituent ? <Link href={`/constituents/${encodeURIComponent(gift.constituent.id)}`}>{gift.constituent.firstName} {gift.constituent.lastName}</Link> : "Unavailable"}</td>
      <td><Link href={`/donations/${encodeURIComponent(gift.id)}`}>{formatDashboardCurrency(toDashboardNumber(gift.amount))}</Link></td>
      <td>{gift.campaign?.name || "—"}</td>
    </tr>)}</tbody>
  </table></div>;
}
