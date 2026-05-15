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
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-gray-900 min-[1440px]:text-xl">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-gray-500">{description}</p>}
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        {mobileControlButton}
        {actions}
      </div>
    </header>
  );
}
