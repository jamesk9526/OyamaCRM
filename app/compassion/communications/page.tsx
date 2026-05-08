// Compassion CRM — Communications placeholder page.
import ComingSoonBadge from "@/app/components/ui/ComingSoonBadge";

/** Communications page: client-facing communications and messages. */
export default function CompassionCommunicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl">✉️</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Communications</h1>
            <ComingSoonBadge />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Client-facing communications and messages.</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-dashed border-blue-200 p-10 text-center">
        <p className="text-gray-400 text-sm">Communications tools are coming soon.</p>
      </div>
    </div>
  );
}
