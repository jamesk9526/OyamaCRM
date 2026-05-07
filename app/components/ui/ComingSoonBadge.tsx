interface ComingSoonBadgeProps {
  label?: string;
  size?: "sm" | "md";
}

export default function ComingSoonBadge({ label = "Coming Soon", size = "sm" }: ComingSoonBadgeProps) {
  const sizeClasses = size === "sm"
    ? "text-xs px-2 py-0.5"
    : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200 ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
      {label}
    </span>
  );
}
