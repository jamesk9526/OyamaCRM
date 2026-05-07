/** SettingsPlaceholderPage renders a consistent "planned section" card. */
import Link from "next/link";

interface SettingsPlaceholderPageProps {
  title: string;
  description: string;
  plannedItems: string[];
}

/** SettingsPlaceholderPage keeps foundation tabs present while deeper features are in progress. */
export default function SettingsPlaceholderPage({
  title,
  description,
  plannedItems,
}: SettingsPlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Foundation Ready</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            Planned Next
          </span>
        </div>
        <ul className="space-y-2 text-sm text-gray-600">
          {plannedItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-gray-500">
        Need immediate updates? Start in{" "}
        <Link href="/settings/organization" className="text-green-700 font-medium hover:underline">
          Organization Settings
        </Link>
        .
      </div>
    </div>
  );
}
