/**
 * TotalsByLevel — weekly giving summary card with a simple bar chart.
 * Accepts loading prop for skeleton state.
 */
import Card from "@/app/components/ui/Card";

interface TotalsByLevelProps {
  weekTotal: number;
  transactions: number;
  avgTransaction: number;
  loading?: boolean;
}

export default function TotalsByLevel({ weekTotal, transactions, avgTransaction, loading }: TotalsByLevelProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Totals by Level</h3>
        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">
            Revenue
          </button>
          <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded">
            Raised
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">This week</p>
          <div className="flex items-baseline gap-4">
            {loading ? (
              <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">${weekTotal.toLocaleString()}</p>
            )}
            {!loading && (
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>{transactions} transactions</p>
                <p>${avgTransaction.toFixed(2)} avg</p>
              </div>
            )}
          </div>
        </div>

        {/* Mini bar chart — decorative */}
        <div className="h-20 bg-gradient-to-r from-green-50 to-green-100 rounded flex items-end px-2 pb-2 gap-1">
          <div className="w-8 bg-green-500 rounded-t" style={{ height: "30%" }}></div>
          <div className="w-8 bg-green-600 rounded-t" style={{ height: "60%" }}></div>
          <div className="w-8 bg-green-400 rounded-t" style={{ height: "45%" }}></div>
          <div className="w-8 bg-green-500 rounded-t" style={{ height: "80%" }}></div>
          <div className="w-8 bg-green-600 rounded-t" style={{ height: "55%" }}></div>
        </div>

        <div className="flex justify-between text-xs text-gray-400">
          <span>$0K</span>
          <span>${Math.max(10, Math.ceil(weekTotal / 1000))}K</span>
        </div>
      </div>
    </Card>
  );
}
