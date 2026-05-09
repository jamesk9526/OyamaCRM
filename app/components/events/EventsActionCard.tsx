/** EventsActionCard renders an actionable task card for the Events dashboard operational queue. */

interface EventsActionCardProps {
  /** Card title. */
  title: string;
  /** Short description of the action area. */
  description: string;
  /** Badge text (e.g., "3 pending"). */
  badge?: string;
  /** Badge accent color. */
  badgeColor?: "amber" | "red" | "blue" | "green";
  /** Primary action label. */
  actionLabel: string;
  /** Click handler for the primary action. */
  onAction?: () => void;
  /** Optional icon element. */
  icon?: React.ReactNode;
}

/**
 * EventsActionCard is used in operational queues on the dashboard to surface
 * immediate work like pending check-ins, incomplete seating, or unsent thank-yous.
 */
export default function EventsActionCard({
  title,
  description,
  badge,
  badgeColor = "amber",
  actionLabel,
  onAction,
  icon,
}: EventsActionCardProps) {
  const badgeStyles = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-amber-200 transition-all">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {badge && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyles[badgeColor]}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
          <button
            onClick={onAction}
            className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            {actionLabel} →
          </button>
        </div>
      </div>
    </div>
  );
}
