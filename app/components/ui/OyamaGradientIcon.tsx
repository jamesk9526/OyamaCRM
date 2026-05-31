// Shared icon renderer for CRM navigation and settings surfaces.
"use client";

import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

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

const ICON_SLUGS: Record<OyamaGradientIconName, string> = {
  "client-profile-sync": "integrations",
  "contact-checklist": "tasks",
  "constituent-search": "constituents",
  "growth-analytics": "donor-dashboard",
  "task-checklist": "tasks",
  "messaging-chat": "communications",
  "client-support-chat": "help",
  "relationship-partnership": "users",
  "momentum-growth": "giving-trends",
  "donor-gift": "donations",
  "reporting-dashboard": "reports",
  "goal-target": "campaign-goal",
};

interface OyamaGradientIconProps {
  name: OyamaGradientIconName;
  size?: number;
  className?: string;
}

/**
 * Renders one of the shared CRM icon aliases from the donor icon pack.
 */
export default function OyamaGradientIcon({
  name,
  size = 18,
  className,
}: OyamaGradientIconProps) {
  const slug = ICON_SLUGS[name];

  return <OyamaDonorPackIcon slug={slug} size={size} className={className} alt="" />;
}