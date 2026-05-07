import ComingSoonBadge from "@/app/components/ui/ComingSoonBadge";
import PlaceholderStatCard from "@/app/components/ui/PlaceholderStatCard";

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: string;
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
          <span className="text-2xl">{icon}</span>
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
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">{title} is coming soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          This section is in development. Here&apos;s what you&apos;ll be able to do:
        </p>
        <ul className="text-sm text-gray-600 space-y-2 max-w-xs mx-auto text-left">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5 shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
