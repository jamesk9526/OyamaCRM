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
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <FeatureStatusWarning
        status="In Development"
        title="This Events tool is still being wired"
        description="Core layout and context are in place, but this tool still uses scaffold metrics or placeholder actions. Use it for workflow orientation until backend persistence is fully connected."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">EventSTUDIO</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50">
            {secondaryAction}
          </button>
          <button className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/10 transition-colors hover:bg-violet-700">
            {primaryAction}
          </button>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{section.description}</p>
            <ul className="mt-4 space-y-2">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
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
