/** Optional right-side drawer for selected-item details in ribbon-first workspaces. */
import type { ReactNode } from "react";

interface WorkspaceInspectorDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Temporary details drawer for preview/inspector patterns.
 */
export default function WorkspaceInspectorDrawer({ open, title, onClose, children }: WorkspaceInspectorDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3">
      <div className="ml-auto flex h-full w-[min(420px,100%)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
