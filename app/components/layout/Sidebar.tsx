// Donor CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildDonorSidebarGroups } from "@/app/components/layout/sidebar-configs";
import type { DonorAccentTone } from "@/app/lib/workspace-settings";
import type { DashboardChromeTint } from "@/app/lib/dashboard-image-tint";

interface SidebarProps {
  forceExpanded?: boolean;
  donorAccentTone?: DonorAccentTone;
  donorChromeTint?: DashboardChromeTint;
  onSwitchToMegaMenu?: () => void;
}

/** Renders Donor CRM sidebar with grouped navigation, badges, and persisted collapse state. */
export default function Sidebar({ forceExpanded = false, donorAccentTone = "green", donorChromeTint, onSwitchToMegaMenu }: SidebarProps) {
  const { qbEnabled } = usePlugins();
  const { user } = useAuth();

  const groups = useMemo(() => buildDonorSidebarGroups({ qbEnabled }), [qbEnabled]);

  return (
    <CrmSidebar
      groups={groups}
      variant="donor"
      storageKey="oyamacrm.sidebar.donor.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      donorAccentTone={donorAccentTone}
      donorChromeTint={donorChromeTint}
      footerAction={!forceExpanded && onSwitchToMegaMenu ? {
        label: "Use Top Navigation",
        ariaLabel: "Switch navigation to top navigation",
        onClick: onSwitchToMegaMenu,
      } : undefined}
      expandedWidthClass="w-[280px]"
      collapsedWidthClass="w-[84px]"
      organizationLabel="Oyama Organization"
    />
  );
}
