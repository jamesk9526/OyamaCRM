// Shared icon renderer for CRM navigation and settings surfaces.
"use client";

type OyamaGradientIconName =
  | "client-profile-sync"
  | "contact-checklist"
  | "constituent-search"
  | "growth-analytics"
  | "task-checklist"
  | "messaging-chat"
  | "client-support-chat"
  | "relationship-partnership"
  | "momentum-growth"
  | "donor-gift"
  | "reporting-dashboard"
  | "goal-target";

const ICON_PATHS: Record<OyamaGradientIconName, string> = {
  "client-profile-sync": "M4 6h16M4 10h10M4 14h16M4 18h8m8-8a2 2 0 100-4 2 2 0 000 4zM14 18a2 2 0 100-4 2 2 0 000 4z",
  "contact-checklist": "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  "constituent-search": "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
  "growth-analytics": "M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z",
  "task-checklist": "M9 11l3 3L22 4M3 5h4M3 12h4M3 19h4",
  "messaging-chat": "M4 6h16v10H7l-3 3V6z",
  "client-support-chat": "M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-3v-6h5M4 13h5v6H6a2 2 0 01-2-2v-4z",
  "relationship-partnership": "M16 11c1.7 0 3-1.6 3-3.5S17.7 4 16 4s-3 1.6-3 3.5 1.3 3.5 3 3.5zM8 11c1.7 0 3-1.6 3-3.5S9.7 4 8 4 5 5.6 5 7.5 6.3 11 8 11zm0 2c-2.8 0-5 1.8-5 4v3h10v-3c0-2.2-2.2-4-5-4zm8 0c-.9 0-1.8.2-2.6.6 1 .9 1.6 2.1 1.6 3.4v3h6v-3c0-2.2-2.2-4-5-4z",
  "momentum-growth": "M3 12h4l2 5 4-10 2 5h6",
  "donor-gift": "M20 12v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8m16 0H4m16 0l-2-4a2 2 0 00-1.8-1.1H7.8A2 2 0 006 8l-2 4m6 0v10m4-10v10",
  "reporting-dashboard": "M4 19h16M7 15V9m5 6V5m5 10v-3",
  "goal-target": "M12 3v18m9-9H3m14.5-4.5l-11 11",
};

interface OyamaGradientIconProps {
  name: OyamaGradientIconName;
  size?: number;
  className?: string;
}

/**
 * Renders one of the shared inline SVG icons at a consistent size.
 */
export default function OyamaGradientIcon({
  name,
  size = 18,
  className,
}: OyamaGradientIconProps) {
  const path = ICON_PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}