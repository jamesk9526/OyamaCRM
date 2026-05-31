"use client";

import {
  Activity,
  BarChart2,
  BookOpen,
  Calendar,
  CheckSquare,
  Database,
  FileText,
  Gift,
  HelpCircle,
  Home,
  Layers,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  Sliders,
  Tag,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const LUCIDE_BY_SLUG: Record<string, LucideIcon> = {
  "donor-dashboard": Home,
  constituents: Users,
  donations: Gift,
  campaigns: Target,
  grants: FileText,
  "fund-designation": Tag,
  "quickbooks-queue": FileText,
  reports: BarChart2,
  tasks: CheckSquare,
  calendar: Calendar,
  communications: MessageSquare,
  "contacts-manager": UserCheck,
  letters: Mail,
  "steward-signals": Activity,
  "steward-ai": MessageSquare,
  volunteer: Users,
  "event-fundraising": Calendar,
  "workflow-automation": Sliders,
  database: Database,
  "field-mapping": Sliders,
  settings: Settings,
  help: HelpCircle,
  "system-status": Shield,
  documentation: BookOpen,
  integrations: Layers,
  "giving-trends": TrendingUp,
  users: Users,
  "campaign-goal": Target,
};

interface OyamaDonorPackIconProps {
  slug: string;
  size?: number;
  className?: string;
  alt?: string;
  title?: string;
}

/**
 * Renders one icon from the donor CRM icon pack copied to public/icons/oyama-donor-crm/svg.
 */
export default function OyamaDonorPackIcon({
  slug,
  size = 18,
  className,
  alt = "",
  title,
}: OyamaDonorPackIconProps) {
  const LucideIcon = LUCIDE_BY_SLUG[slug];

  if (LucideIcon) {
    return (
      <LucideIcon
        width={size}
        height={size}
        className={className}
        aria-label={alt || title || undefined}
        aria-hidden={alt || title ? undefined : true}
        role={alt || title ? "img" : "presentation"}
        focusable="false"
        strokeWidth={1.9}
      />
    );
  }

  return (
    <img
      src={`/icons/oyama-donor-crm/svg/${slug}.svg`}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
      aria-hidden={alt ? undefined : true}
    />
  );
}
