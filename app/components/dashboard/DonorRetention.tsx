/**
 * DonorRetention — circular gauge showing year-over-year donor retention rate.
 * Uses real data from /api/reports/donor-retention.
 */
import Card from "@/app/components/ui/Card";
import CircularProgress from "@/app/components/ui/CircularProgress";

interface DonorRetentionProps {
  retained: number;
  total: number;
  /** Pre-computed rate (0–100). If undefined, computed from retained/total. */
  rate?: number;
  loading?: boolean;
}

export default function DonorRetention({ retained, total, rate, loading }: DonorRetentionProps) {
  const percentage = rate ?? (total > 0 ? Math.round((retained / total) * 100) : 0);

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Donor Retention</h3>
        <button className="text-gray-400 hover:text-gray-600 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center py-4">
        {loading ? (
          <div className="w-44 h-44 rounded-full bg-gray-200 animate-pulse" />
        ) : (
          <CircularProgress percentage={percentage} size={180} strokeWidth={14} />
        )}
        
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Year-over-Year</p>
        
        <div className="mt-4 text-center">
          {loading ? (
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="text-sm text-gray-600">
              {retained} out of {total} donors retained
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
