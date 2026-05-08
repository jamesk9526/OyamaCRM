// Compassion CRM — Tasks placeholder page.
import ComingSoonBadge from "@/app/components/ui/ComingSoonBadge";

/** Tasks page: manage case worker tasks and assignments. */
export default function CompassionTasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xl">🗂️</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
            <ComingSoonBadge />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Manage case worker tasks and assignments.</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-dashed border-blue-200 p-10 text-center">
        <p className="text-gray-400 text-sm">Task management is coming soon.</p>
      </div>
    </div>
  );
}
