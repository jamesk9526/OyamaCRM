/**
 * DonorRetention — circular gauge showing year-over-year donor retention rate.
 * Uses real data from /api/reports/donor-retention.
 */
"use client";


interface DonorRetentionProps {
  retained: number;
  total: number;
  /** Pre-computed rate (0–100). If undefined, computed from retained/total. */
  rate?: number;
  loading?: boolean;
}

export default function DonorRetention({ retained, total, rate, loading }: DonorRetentionProps) {
  const percentage = rate ?? (total > 0 ? Math.round((retained / total) * 100) : 0);
  const retainedPct = Math.max(0, Math.min(100, percentage));
  const lapsed = Math.max(total - retained, 0);
  const lapsedPct = Math.max(0, 100 - retainedPct);
  const radius = 56;
  const strokeWidth = 14;
  const ringLength = 2 * Math.PI * radius;
  const retainedArc = (retainedPct / 100) * ringLength;
  const lapsedArc = (lapsedPct / 100) * ringLength;

  const summaryText = `${retained} out of ${total} donors retained`;

  return (
    <div className="h-full">
      <div className="grid h-full grid-cols-1 items-center gap-4 md:grid-cols-[180px_1fr]">
        <div className="flex items-center justify-center">
          {loading ? (
            <div className="h-40 w-40 animate-pulse rounded-full bg-slate-100" />
          ) : (
            <div className="relative">
              <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
                <defs>
                  <linearGradient id="retention-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#2dd4bf" /></linearGradient>
                  <filter id="retention-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#059669" floodOpacity="0.18" /></filter>
                </defs>
                <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="url(#retention-ring)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${retainedArc} ${ringLength}`}
                  strokeDashoffset="0"
                  filter="url(#retention-shadow)"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${lapsedArc} ${ringLength}`}
                  strokeDashoffset={-retainedArc}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-4xl font-semibold tracking-tight text-slate-900">{retainedPct}%</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Retained</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {loading ? (
            <>
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">{summaryText}</p>

              <div className="space-y-2.5">
                <div className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span className="text-slate-600">Retained</span>
                  <span className="font-semibold text-slate-800">{retainedPct}% ({retained.toLocaleString()})</span>
                </div>
                <div className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-600">Lapsed</span>
                  <span className="font-semibold text-slate-800">{lapsedPct}% ({lapsed.toLocaleString()})</span>
                </div>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-inner">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-[width] duration-700" style={{ width: `${retainedPct}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
