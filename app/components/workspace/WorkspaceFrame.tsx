/**
 * WorkspaceFrame composes a consistent center workspace and right control rail layout.
 */
"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import WorkspaceHeader from "./WorkspaceHeader";
import WorkspaceMain from "./WorkspaceMain";

interface WorkspaceFrameProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  controlRail?: ReactNode;
  children: ReactNode;
}

/**
 * Page-level layout wrapper used inside AppShell content.
 * Left global sidebar remains unchanged; this handles center + right rail only.
 */
export default function WorkspaceFrame({
  title,
  description,
  actions,
  controlRail,
  children,
}: WorkspaceFrameProps) {
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title={title}
        description={description}
        actions={actions}
        mobileControlButton={controlRail ? (
          <button
            type="button"
            onClick={() => setMobileControlsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            Controls
          </button>
        ) : undefined}
      />

      <div className="flex min-h-[60vh] gap-4">
        <WorkspaceMain>{children}</WorkspaceMain>

        {controlRail && (
          <div className="hidden w-[280px] shrink-0 lg:block">{controlRail}</div>
        )}
      </div>

      {controlRail && mobileControlsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-3 lg:hidden">
          <div className="ml-auto h-full w-[290px] overflow-y-auto rounded-xl bg-white p-2 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Workspace Controls</p>
              <button
                type="button"
                onClick={() => setMobileControlsOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700"
              >
                Close
              </button>
            </div>
            {controlRail}
          </div>
        </div>
      )}
    </div>
  );
}
