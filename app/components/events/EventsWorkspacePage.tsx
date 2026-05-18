/** EventsWorkspacePage renders a reusable workspace scaffold for non-dashboard Events CRM pages. */

import EventsMetricCard from "@/app/components/events/EventsMetricCard";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface Metric {
  label: string;
  value: string | number;
  helper?: string;
}

interface DetailSection {
  title: string;
  description: string;
  bullets: string[];
}

interface EventsWorkspacePageProps {
  /** Page title. */
  title: string;
  /** Short page description. */
  description: string;
  /** Primary button label. */
  primaryAction: string;
  /** Secondary button label. */
  secondaryAction: string;
  /** Header summary metrics. */
  metrics: Metric[];
  /** Page content cards. */
  sections: DetailSection[];
}

/**
 * EventsWorkspacePage provides a consistent Events CRM page shell for section pages
 * while deeper workflows are being wired behind dedicated APIs.
 */
export default function EventsWorkspacePage({
  title,
  description,
  primaryAction,
  secondaryAction,
  metrics,
  sections,
}: EventsWorkspacePageProps) {
  return (
    <div className="space-y-6">
      <FeatureStatusWarning
        status="In Development"
        title="This Events tool is still being wired"
        description="Core layout and context are in place, but this tool still uses scaffold metrics or placeholder actions. Use it for workflow orientation until backend persistence is fully connected."
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm font-medium border border-violet-200 text-violet-700 rounded-lg bg-white hover:bg-violet-50 transition-colors">
            {secondaryAction}
          </button>
          <button className="px-3 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            {primaryAction}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {/* TODO: Replace scaffold metrics with API-backed values for each Events submodule before production. */}
        {metrics.map((metric) => (
          <EventsMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{section.description}</p>
            <ul className="mt-4 space-y-2">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 text-violet-600">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
