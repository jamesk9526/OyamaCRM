"use client";
/**
 * AppsDrawer — TopBar app-drawer shell for launching standalone apps.
 * This drawer intentionally starts empty so CRM module links stay in the
 * module switcher while future apps (for example Trivia Night tools) can be
 * added here without reworking navigation structure.
 */

import { useEffect } from "react";
import Link from "next/link";

interface DrawerAvailableApp {
  id: string;
  label: string;
  description: string;
  href: string;
}

interface DrawerPlannedApp {
  id: string;
  label: string;
  description: string;
}

/** Live standalone apps currently available from the app drawer. */
const AVAILABLE_APPS: DrawerAvailableApp[] = [
  {
    id: "trivia-software",
    label: "Trivia Software",
    description: "Standalone trivia operations workspace.",
    href: "/apps/trivia",
  },
];

/** Visual grid icon (3×3 dots) used as the trigger button */
export function AppsGridIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="5" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
    </svg>
  );
}

/** Planned standalone apps to appear in the drawer once routes are ready. */
const PLANNED_APPS: DrawerPlannedApp[] = [
  {
    id: "trivia-night",
    label: "Trivia Night",
    description: "Event mini-app for team trivia registration and live rounds.",
  },
  {
    id: "community-portal",
    label: "Community Portal",
    description: "Future self-service workspace for supporters and volunteers.",
  },
];

interface AppsDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Called when user dismisses the drawer */
  onClose: () => void;
}

/**
 * AppsDrawer — overlay that slides open from the TopBar waffle icon.
 * Holds future standalone apps while CRM workspace switching stays in the TopBar module switcher.
 */
export default function AppsDrawer({ open, onClose }: AppsDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={onClose}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Drawer panel — anchored to top-right */}
      <div
        className="relative mt-16 mr-3 w-80 rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">App Drawer</p>
          <p className="text-xs text-gray-500 mt-0.5">Standalone apps launch here as they are built.</p>
        </div>

        {/* Live app list — CRM modules are intentionally excluded from this drawer. */}
        <div className="px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Available apps</p>
          <div className="mt-2 space-y-2">
            {AVAILABLE_APPS.map((app) => (
              <Link
                key={app.id}
                href={app.href}
                onClick={onClose}
                className="block rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <p className="text-xs font-semibold text-gray-800">{app.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{app.description}</p>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            CRM modules were removed from this menu. Use the module switcher in the top bar to change CRM workspaces.
          </p>
        </div>

        {/* Planned app queue so teams can see what this drawer is for. */}
        <div className="px-5 pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Planned apps</p>
          <div className="mt-2 space-y-2">
            {PLANNED_APPS.map((app) => (
              <div key={app.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-gray-800">{app.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{app.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">App launcher foundation for future tools</p>
        </div>
      </div>
    </div>
  );
}
