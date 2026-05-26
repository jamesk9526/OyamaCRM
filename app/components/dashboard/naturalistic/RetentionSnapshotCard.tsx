/**
 * RetentionSnapshotCard — compact circular gauge showing year-over-year donor retention.
 * Used in the right column of the naturalistic donor dashboard.
 */
"use client";

interface RetentionData {
  retained: number;
  total: number;
  rate: number;
}

interface RetentionSnapshotCardProps {
  retention: RetentionData | null;
  loading: boolean;
}

/** SVG circle gauge (0–100%). y-axis correction applied via rotate(-90deg). */
function CircleGauge({ pct, size = 108 }: { pct: number; size?: number }) {
  const strokeWidth = 9;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - Math.max(0, Math.min(100, pct) / 100) * circumference;
  const cx = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#059669"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

function RatingLabel({ rate }: { rate: number }) {
  if (rate >= 75) return <span className="text-xs font-semibold text-emerald-600">Excellent</span>;
  if (rate >= 55) return <span className="text-xs font-semibold text-blue-600">Good</span>;
  if (rate >= 40) return <span className="text-xs font-semibold text-amber-600">Needs Attention</span>;
  return <span className="text-xs font-semibold text-rose-600">At Risk</span>;
}

export default function RetentionSnapshotCard({ retention, loading }: RetentionSnapshotCardProps) {
  const rate = retention?.rate ?? 0;
  const retained = retention?.retained ?? 0;
  const total = retention?.total ?? 0;
  const lapsed = total - retained;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Retention Snapshot</h3>
          <p className="text-xs text-slate-400">Donors who gave again this year</p>
        </div>
        {!loading && retention && <RatingLabel rate={rate} />}
      </div>

      {loading ? (
        <div className="flex items-center gap-6 py-3">
          <div className="h-[108px] w-[108px] animate-pulse rounded-full bg-slate-100" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ) : retention ? (
        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative shrink-0">
            <CircleGauge pct={rate} />
            {/* Center label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              aria-label={`${Math.round(rate)}% retention rate`}
            >
              <span className="text-2xl font-extrabold text-slate-900">{Math.round(rate)}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-bold text-emerald-700">{retained.toLocaleString()}</span>
              <span className="ml-1 text-slate-500">retained</span>
            </div>
            <div>
              <span className="font-bold text-rose-500">{lapsed.toLocaleString()}</span>
              <span className="ml-1 text-slate-500">lapsed</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">{total.toLocaleString()}</span>
              <span className="ml-1 text-slate-400">total</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 text-center">
          <p className="text-sm text-slate-400">No retention data yet.</p>
          <p className="mt-1 text-xs text-slate-300">Add donors to see retention stats.</p>
        </div>
      )}
    </div>
  );
}
