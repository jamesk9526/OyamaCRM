interface PlaceholderStatCardProps {
  label: string;
  description?: string;
}

export default function PlaceholderStatCard({ label, description }: PlaceholderStatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 opacity-60">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="h-7 w-24 bg-gray-200 rounded animate-pulse mb-1" />
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
