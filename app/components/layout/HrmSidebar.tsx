// OyamaHRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildHrmSidebarGroups } from "@/app/components/layout/sidebar-configs";

interface HrmSidebarProps {
  forceExpanded?: boolean;
}

/** Renders HRM sidebar with shared grouping, accessibility, and persisted collapse preference. */
export default function HrmSidebar({ forceExpanded = false }: HrmSidebarProps) {
  const { user } = useAuth();

  return (
    <CrmSidebar
      groups={buildHrmSidebarGroups()}
      variant="hrm"
      storageKey="oyamacrm.sidebar.hrm.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      expandedWidthClass="w-60"
      collapsedWidthClass="w-20"
      organizationLabel="HRM Workspace"
    />
  );
}
