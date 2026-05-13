// OyamaWatchdog sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildWatchdogSidebarGroups } from "@/app/components/layout/sidebar-configs";

interface WatchdogSidebarProps {
  forceExpanded?: boolean;
}

/** Renders Watchdog sidebar with dark security styling and hash-aware active states. */
export default function WatchdogSidebar({ forceExpanded = false }: WatchdogSidebarProps) {
  const { user } = useAuth();

  return (
    <CrmSidebar
      groups={buildWatchdogSidebarGroups()}
      variant="watchdog"
      storageKey="oyamacrm.sidebar.watchdog.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      expandedWidthClass="w-64"
      collapsedWidthClass="w-20"
      organizationLabel="Security telemetry across Donor, Compassion, Events, WebMaster"
    />
  );
}
