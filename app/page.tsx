import RevenueProgress from "./components/dashboard/RevenueProgress";
import DonorRetention from "./components/dashboard/DonorRetention";
import TasksWidget from "./components/dashboard/TasksWidget";
import TotalsByLevel from "./components/dashboard/TotalsByLevel";

export default function DashboardPage() {
  // Sample data - will be replaced with real data from API
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Good morning, James Knox!
          </h1>
          <p className="text-sm text-gray-500">
            What&apos;s happening with Oyama CRM today
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">
            Data last refreshed 05/06/26 8:{currentTime.split(":")[1]}
          </p>
          <button className="text-xs text-green-600 hover:text-green-700 font-medium mt-1">
            Refresh
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Revenue */}
        <div className="space-y-4">
          <RevenueProgress current={14220} goal={200000} />
          <TotalsByLevel weekTotal={735} transactions={4} avgTransaction={183.75} />
        </div>

        {/* Middle Column - Retention */}
        <div>
          <DonorRetention retained={124} total={200} />
        </div>

        {/* Right Column - Tasks */}
        <div className="lg:row-span-2">
          <TasksWidget />
        </div>
      </div>
    </div>
  );
}
