import ComingSoonBadge from "@/app/components/ui/ComingSoonBadge";
import PlaceholderStatCard from "@/app/components/ui/PlaceholderStatCard";
import type React from "react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** SVG ReactNode — prefer SVG over emoji strings */
  icon: React.ReactNode;
  stats: Array<{ label: string; description?: string }>;
  features: string[];
}

export default function PagePlaceholder({
  title,
  description,
  icon,
  stats,
  features,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
            {icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              <ComingSoonBadge />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Placeholder stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <PlaceholderStatCard key={stat.label} label={stat.label} description={stat.description} />
        ))}
      </div>

      {/* Coming soon content box */}
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <span className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">{title} is coming soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          This section is in development. Here&apos;s what you&apos;ll be able to do:
        </p>
        <ul className="text-sm text-gray-600 space-y-2 max-w-xs mx-auto text-left">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
