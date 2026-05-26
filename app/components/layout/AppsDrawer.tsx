"use client";
/**
 * AppsDrawer — TopBar hidden app launcher for specialist tools and standalone apps.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";

interface DrawerApp {
  id: string;
  label: string;
  description: string;
  href: string;
  tone: "green" | "blue" | "slate" | "indigo";
  helper: string;
  adminOnly?: boolean;
  openInNewTab?: boolean;
}

/** Hidden module-apps and standalone apps currently available from the launcher. */
const AVAILABLE_APPS: DrawerApp[] = [
  {
    id: "oyama-watchdog",
    label: "OyamaWatchdog",
    description: "Security operations, feedback ticketing, audit, and incident workflows.",
    href: "/watchdog",
    tone: "slate",
    helper: "Security",
  },
  {
    id: "oyama-webmaster",
    label: "OyamaWebMaster",
    description: "Website command center for site operations and publishing.",
    href: "/webmaster",
    tone: "indigo",
    helper: "Web",
  },
  {
    id: "oyama-password",
    label: "OyamaPASSWORD",
    description: "Shared credential vault app with encrypted password workflows.",
    href: "/apps/password-vault",
    tone: "blue",
    helper: "Vault",
    openInNewTab: true,
  },
  {
    id: "trivia-software",
    label: "Trivia Software",
    description: "Standalone trivia operations workspace.",
    href: "/apps/trivia",
    tone: "green",
    helper: "Standalone",
  },
  {
    id: "admin-reports",
    label: "Oyama Reports",
    description: "Dedicated Donor CRM reporting app for prebuilt reports, exports, and board summaries.",
    href: "/reports",
    tone: "blue",
    helper: "Reports",
    adminOnly: true,
    openInNewTab: true,
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
  const { user } = useAuth();

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const visibleApps = AVAILABLE_APPS.filter((app) => {
    if (!app.adminOnly) return true;
    return user?.role === "admin";
  });

  function toneClasses(tone: DrawerApp["tone"]): string {
    if (tone === "blue") return "border-blue-200 bg-blue-50/70 text-blue-700";
    if (tone === "slate") return "border-slate-300 bg-slate-100 text-slate-700";
    if (tone === "indigo") return "border-indigo-200 bg-indigo-50/70 text-indigo-700";
    return "border-green-200 bg-green-50/70 text-green-700";
  }

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
        className="relative mt-16 mr-3 w-[360px] max-w-[calc(100vw-1rem)] rounded-[22px] bg-white/95 shadow-[0_18px_42px_rgba(15,23,42,0.18)] border border-slate-200/90 overflow-hidden backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/70">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.22em]">Hidden Apps</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">App Launcher</p>
          <p className="text-xs text-slate-600 mt-0.5">Specialized apps and tools that stay out of the primary workspace switcher.</p>
        </div>

        {/* Live app list for hidden modules and standalone apps. */}
        <div className="px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Available apps</p>
          <div className="mt-2 space-y-2">
            {visibleApps.map((app) => (
              <Link
                key={app.id}
                href={app.href}
                onClick={onClose}
                target={app.openInNewTab ? "_blank" : undefined}
                rel={app.openInNewTab ? "noopener noreferrer" : undefined}
                className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-slate-900">{app.label}</p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses(app.tone)}`}>
                    {app.helper}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">{app.description}</p>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            DonorCRM, Compassion CRM, EventSTUDIO, OShareview, and HRM remain in the primary workspace switcher.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500">Launcher keeps specialist apps discoverable without crowding core CRM switcher.</p>
        </div>
      </div>
    </div>
  );
}
