// Shared icon renderer for the uploaded Oyama gradient PNG icon set.
"use client";

import Image from "next/image";

import clientProfileSync from "@/app/icons/01-client-profile-sync.png";
import contactChecklist from "@/app/icons/02-contact-record-checklist.png";
import constituentSearch from "@/app/icons/03-constituent-search.png";
import growthAnalytics from "@/app/icons/04-growth-analytics.png";
import taskChecklist from "@/app/icons/05-task-checklist.png";
import messagingChat from "@/app/icons/06-messaging-chat.png";
import clientSupportChat from "@/app/icons/07-client-support-chat.png";
import relationshipPartnership from "@/app/icons/08-relationship-partnership.png";
import momentumGrowth from "@/app/icons/09-momentum-growth.png";
import donorGift from "@/app/icons/10-donor-gift.png";
import reportingDashboard from "@/app/icons/11-reporting-dashboard.png";
import goalTarget from "@/app/icons/12-goal-target.png";

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

const ICON_MAP: Record<OyamaGradientIconName, StaticImageData> = {
  "client-profile-sync": clientProfileSync,
  "contact-checklist": contactChecklist,
  "constituent-search": constituentSearch,
  "growth-analytics": growthAnalytics,
  "task-checklist": taskChecklist,
  "messaging-chat": messagingChat,
  "client-support-chat": clientSupportChat,
  "relationship-partnership": relationshipPartnership,
  "momentum-growth": momentumGrowth,
  "donor-gift": donorGift,
  "reporting-dashboard": reportingDashboard,
  "goal-target": goalTarget,
};

type StaticImageData = {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
};

interface OyamaGradientIconProps {
  name: OyamaGradientIconName;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders one of the uploaded Oyama gradient icons at a consistent size.
 */
export default function OyamaGradientIcon({
  name,
  size = 18,
  className,
  alt = "",
}: OyamaGradientIconProps) {
  return (
    <Image
      src={ICON_MAP[name]}
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}