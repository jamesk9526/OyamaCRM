"use client";
/**
 * AppsDrawer — full-screen overlay "waffle menu" for launching OyamaCRM products.
 * Opened from the TopBar apps-grid icon. Shows tiles for each available product.
 * Tiles with available=false are dimmed with a "Coming Soon" badge.
 */

import { useEffect } from "react";
import Link from "next/link";

interface AppTile {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  available: boolean;
}

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

/** All available + coming-soon products */
const APPS: AppTile[] = [
  {
    id: "donor",
    label: "DonorCRM",
    description: "Donor management & fundraising",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M12 21C12 21 3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12z" />
      </svg>
    ),
    color: "text-green-600",
    bgColor: "bg-green-50",
    available: true,
  },
  {
    id: "compassion",
    label: "Compassion CRM",
    description: "Client & case management",
    href: "/compassion/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    available: true,
  },
  {
    id: "events-crm",
    label: "Events CRM",
    description: "Events, guests & check-in",
    href: "/events",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    available: true,
  },
  {
    id: "watchdog",
    label: "OyamaWatchdog",
    description: "Admin security watch + vault",
    href: "/watchdog",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4z" />
        <path d="M12 9v4m0 4h.01" />
      </svg>
    ),
    color: "text-red-600",
    bgColor: "bg-red-50",
    available: true,
  },
  {
    id: "webmaster",
    label: "OyamaWebMaster",
    description: "Nonprofit website creator",
    href: "/webmaster",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M3 5h18v14H3z" />
        <path d="M3 9h18" />
        <path d="M8 3v4" />
      </svg>
    ),
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    available: true,
  },
  {
    id: "grants",
    label: "Grant Manager",
    description: "Track grants & write proposals",
    href: "/grants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    available: true,
  },
  {
    id: "analytics",
    label: "Analytics Hub",
    description: "Advanced reports & insights",
    href: "/reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    available: true,
  },
  {
    id: "data-tools",
    label: "Data Tools",
    description: "Import, export & dedup",
    href: "/data-tools",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    available: true,
  },
  {
    id: "payments",
    label: "Payment Portal",
    description: "Payment processors & transactions",
    href: "/payments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    color: "text-green-600",
    bgColor: "bg-green-50",
    available: true,
  },
  {
    id: "board",
    label: "Board Portal",
    description: "Board reports & dashboards",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    available: true,
  },
  {
    id: "email",
    label: "Email Builder",
    description: "Campaign email designer",
    href: "/communications",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    available: true,
  },
  {
    id: "fundraising-pages",
    label: "Fundraising Pages",
    description: "Online giving & peer-to-peer",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    available: false,
  },
  {
    id: "volunteer",
    label: "Volunteer Portal",
    description: "Volunteer scheduling & hours",
    href: "/volunteers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    available: false,
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
 * Shows all product tiles; clicking an available tile navigates and closes.
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
          <p className="text-sm font-semibold text-gray-800">OyamaCRM Apps</p>
          <p className="text-xs text-gray-500 mt-0.5">Switch between modules &amp; products</p>
        </div>

        {/* App grid — 3 columns */}
        <div className="p-4 grid grid-cols-3 gap-3">
          {APPS.map((app) => {
            const tile = (
              <div
                key={app.id}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all
                  ${app.available
                    ? "border-gray-100 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5"
                    : "border-gray-100 opacity-50 cursor-not-allowed"
                  }`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${app.bgColor} ${app.color} flex items-center justify-center`}>
                  {app.icon}
                </div>
                {/* Label */}
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {app.label}
                </span>
                {/* Coming Soon badge */}
                {!app.available && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold bg-gray-200 text-gray-500 px-1 py-0.5 rounded">
                    SOON
                  </span>
                )}
              </div>
            );

            return app.available ? (
              <Link key={app.id} href={app.href} onClick={onClose}>
                {tile}
              </Link>
            ) : (
              <div key={app.id}>{tile}</div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">OyamaCRM Platform</p>
        </div>
      </div>
    </div>
  );
}
