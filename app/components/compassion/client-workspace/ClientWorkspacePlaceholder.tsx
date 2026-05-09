// Reusable client-workspace placeholder panel for Compassion CRM tabs that are still in development.

interface ClientWorkspacePlaceholderProps {
  title: string;
  description: string;
  criteria: string[];
}

/**
 * ClientWorkspacePlaceholder shows a clear in-development warning with removal criteria.
 * This keeps client-scoped tabs visible while making implementation status explicit.
 */
export default function ClientWorkspacePlaceholder({
  title,
  description,
  criteria,
}: ClientWorkspacePlaceholderProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">Feature in development: {title}</p>
        <p className="text-sm text-amber-700 mt-1">{description}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900">What must be completed before this warning is removed</h3>
        <ul className="mt-3 space-y-2">
          {criteria.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
