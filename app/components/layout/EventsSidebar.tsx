// Events CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { buildEventsSidebarGroups, resolveActiveEventId } from "@/app/components/layout/sidebar-configs";

interface EventsSidebarProps {
  forceExpanded?: boolean;
}

/** Renders Events CRM sidebar with event-scoped groups when an active event is selected. */
export default function EventsSidebar({ forceExpanded = false }: EventsSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const activeEventId = useMemo(() => {
    return resolveActiveEventId(pathname, searchParams);
  }, [pathname, searchParams]);

  const groups = useMemo(() => {
    return buildEventsSidebarGroups(activeEventId);
  }, [activeEventId]);

  return (
    <CrmSidebar
      groups={groups}
      variant="events"
      storageKey="oyamacrm.sidebar.events.collapsed"
      userRole={user?.role}
      forceExpanded={forceExpanded}
      expandedWidthClass="w-64"
      collapsedWidthClass="w-20"
      organizationLabel="Events Command Center"
    />
  );
}
