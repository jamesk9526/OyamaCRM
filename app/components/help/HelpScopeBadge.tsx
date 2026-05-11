// Scope badge used across Help App list and article layouts.

import type { HelpCrmScope } from "@/app/help-content";

interface HelpScopeBadgeProps {
  /** Current article or workspace scope value. */
  scope: HelpCrmScope;
}

/**
 * HelpScopeBadge renders a color-coded CRM scope badge for quick context.
 */
export default function HelpScopeBadge({ scope }: HelpScopeBadgeProps) {
  const styles = scope === "compassion"
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : scope === "events"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : scope === "global"
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-green-100 text-green-700 border-green-200";

  const label = scope === "compassion"
    ? "Compassion CRM"
    : scope === "events"
      ? "Events CRM"
      : scope === "global"
        ? "Global"
        : "Donor CRM";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles}`}>
      {label}
    </span>
  );
}
