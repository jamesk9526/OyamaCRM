"use client";

import {
  Activity,
  BarChart2,
  BookOpen,
  CheckSquare,
  FileText,
  Gift,
  HelpCircle,
  Home,
  Layers,
  MessageSquare,
  Settings,
  Shield,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const LUCIDE_BY_ADVANCED_NAME: Record<string, LucideIcon> = {
  dashboard: Home,
  donors: Users,
  donation: Gift,
  campaign: Target,
  files: FileText,
  notes: BookOpen,
  billing: FileText,
  reports: BarChart2,
  tasks: CheckSquare,
  chat: MessageSquare,
  contacts: UserCheck,
  analytics: TrendingUp,
  users: Users,
  integrations: Layers,
  settings: Settings,
  help: HelpCircle,
  security: Shield,
  "path-library": Layers,
  builder: Wrench,
  enrollments: UserCheck,
  activity: Activity,
};

interface OyamaAdvancedIconProps {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}

const SPECIAL_VIEWBOX_NAMES = new Set([
  "steward-paths-special",
  "steward-paths-special-16",
  "steward-paths-special-24",
  "steward-paths-special-32",
  "steward-paths-special-48",
  "steward-paths-special-64",
  "steward-paths-special-128",
  "steward-paths-special-256",
]);

/**
 * Renders icons from the advanced sprite at public/icons/oyama-crm-advanced/sprite/oyama-icons-sprite.svg.
 */
export default function OyamaAdvancedIcon({ name, size = 18, className, title }: OyamaAdvancedIconProps) {
  const LucideIcon = LUCIDE_BY_ADVANCED_NAME[name];

  if (LucideIcon) {
    return (
      <LucideIcon
        width={size}
        height={size}
        className={className}
        aria-label={title || undefined}
        aria-hidden={title ? undefined : true}
        role={title ? "img" : "presentation"}
        focusable="false"
        strokeWidth={1.9}
      />
    );
  }

  const viewBox = SPECIAL_VIEWBOX_NAMES.has(name) ? "0 0 512 512" : "0 0 48 48";

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`/icons/oyama-crm-advanced/sprite/oyama-icons-sprite.svg#oyama-${name}`} />
    </svg>
  );
}
