// OyamaWatchdog sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildWatchdogSidebarGroups } from "@/app/components/layout/sidebar-configs";

interface WatchdogSidebarProps {
  forceExpanded?: boolean;
}

/** Renders Watchdog sidebar with route-based operations navigation. */
export default function WatchdogSidebar({ forceExpanded = false }: WatchdogSidebarProps) {
  const { user } = useAuth();

  return (
    <CrmSidebar
      groups={buildWatchdogSidebarGroups()}
      variant="watchdog"
      storageKey="oyamacrm.sidebar.watchdog.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      brandHeader={<CrmBrandLockup moduleLabel="Watchdog CRM" className="w-full" />}
      brandHeaderCollapsed={<CrmBrandLockup moduleLabel="Watchdog CRM" compact />}
      expandedWidthClass="w-64"
      collapsedWidthClass="w-20"
      organizationLabel="Security telemetry across Donor, Compassion, Events, WebMaster"
    />
  );
}
