/**
 * RevenueProgress — circular progress card showing YTD raised vs goal.
 * Shows a skeleton loader while data is loading.
 */
import Card from "@/app/components/ui/Card";
import CircularProgress from "@/app/components/ui/CircularProgress";

interface RevenueProgressProps {
  current: number;
  goal: number;
  loading?: boolean;
}

export default function RevenueProgress({ current, goal, loading }: RevenueProgressProps) {
  const percentage = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Revenue Progress</h3>
        <button className="text-green-600 hover:text-green-700 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col items-center py-4">
        {loading ? (
          <div className="w-36 h-36 rounded-full bg-gray-200 animate-pulse" />
        ) : (
          <CircularProgress percentage={percentage} />
        )}
        
        <div className="mt-4 text-center">
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mx-auto" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              ${current.toLocaleString()}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            of ${goal.toLocaleString()} goal
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">
            Revenue
          </button>
          <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded">
            Raised
          </button>
        </div>
      </div>
    </Card>
  );
}
