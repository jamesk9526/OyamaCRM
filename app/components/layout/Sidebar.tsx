// Donor CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useMemo } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildDonorSidebarGroups } from "@/app/components/layout/sidebar-configs";

interface SidebarProps {
  forceExpanded?: boolean;
}

/** Renders Donor CRM sidebar with grouped navigation, badges, and persisted collapse state. */
export default function Sidebar({ forceExpanded = false }: SidebarProps) {
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
      expandedWidthClass="w-64"
      collapsedWidthClass="w-20"
      organizationLabel="Oyama Organization"
    />
  );
}
