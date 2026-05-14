/**
 * WorkspaceHeader renders reusable title, description, and action controls for workspace pages.
 */
import type { ReactNode } from "react";

interface WorkspaceHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  mobileControlButton?: ReactNode;
}

/** Top header for one workspace screen inside the global app shell content region. */
export default function WorkspaceHeader({ title, description, actions, mobileControlButton }: WorkspaceHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>

      <div className="flex items-center gap-2">
        {mobileControlButton}
        {actions}
      </div>
    </header>
  );
}
