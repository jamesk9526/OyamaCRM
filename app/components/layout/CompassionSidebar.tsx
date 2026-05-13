// Compassion CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildCompassionSidebarGroups } from "@/app/components/layout/sidebar-configs";

interface CompassionSidebarProps {
  forceExpanded?: boolean;
}

/** Renders the Compassion CRM sidebar with shared collapsible behavior and role-aware visibility. */
export default function CompassionSidebar({ forceExpanded = false }: CompassionSidebarProps) {
  const { user } = useAuth();

  return (
    <CrmSidebar
      groups={buildCompassionSidebarGroups()}
      variant="compassion"
      storageKey="oyamacrm.sidebar.compassion.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      expandedWidthClass="w-64"
      collapsedWidthClass="w-20"
      organizationLabel="Oyama Organization"
    />
  );
}
