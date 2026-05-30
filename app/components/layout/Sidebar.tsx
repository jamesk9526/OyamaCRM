// Donor CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildDonorSidebarGroups } from "@/app/components/layout/sidebar-configs";
import { OYAMA_PRODUCT_ICON, OYAMA_PRODUCT_LOGO } from "@/app/lib/product-branding";
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
      brandHeader={(
        <div className="flex items-center">
          <Image
            src={OYAMA_PRODUCT_LOGO}
            alt="Oyama Donor CRM"
            width={204}
            height={54}
            className="h-11 w-[178px] object-contain object-left"
            priority
          />
        </div>
      )}
      brandHeaderCollapsed={(
        <div className="flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center">
            <Image
              src={OYAMA_PRODUCT_ICON}
              alt="OyamaCRM"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>
      )}
      expandedWidthClass="w-[216px]"
      collapsedWidthClass="w-[68px]"
      organizationLabel="Oyama Organization"
    />
  );
}
