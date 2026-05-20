/** DonationVelocityWidget shows short-horizon giving speed and ticket-size movement. */
"use client";

interface DonationVelocityWidgetProps {
  weekAmount: number;
  weekCount: number;
  monthAmount: number;
  monthCount: number;
  loading?: boolean;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DonationVelocityWidget({
  weekAmount,
  weekCount,
  monthAmount,
  monthCount,
  loading = false,
}: DonationVelocityWidgetProps) {
  const avgWeekGift = weekCount > 0 ? weekAmount / weekCount : 0;
  const avgMonthGift = monthCount > 0 ? monthAmount / monthCount : 0;
  const momentum = avgMonthGift > 0 ? Math.round(((avgWeekGift - avgMonthGift) / avgMonthGift) * 100) : 0;

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This Week</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{fmtCurrency(weekAmount)}</p>
          <p className="text-[11px] text-slate-500">{weekCount.toLocaleString()} gifts</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This Month</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{fmtCurrency(monthAmount)}</p>
          <p className="text-[11px] text-slate-500">{monthCount.toLocaleString()} gifts</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span>Avg gift velocity</span>
          <span className={momentum >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
            {momentum >= 0 ? "▲" : "▼"} {Math.abs(momentum)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full ${momentum >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(100, Math.max(8, Math.abs(momentum)))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Week avg {fmtCurrency(avgWeekGift)} vs month avg {fmtCurrency(avgMonthGift)}
        </p>
      </div>
    </div>
  );
}
