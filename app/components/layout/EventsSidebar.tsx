// Events CRM sidebar wrapper using shared CRM sidebar architecture.
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import CrmSidebar from "@/app/components/layout/CrmSidebar";
import { apiFetch } from "@/app/lib/auth-client";
import { buildEventsSidebarGroups, resolveActiveEventId, type EventsSidebarContext } from "@/app/components/layout/sidebar-configs";

interface EventsSidebarProps {
  forceExpanded?: boolean;
}

interface EventSidebarApiResponse {
  id: string;
  name?: string;
  status?: string;
  startDate?: string;
  location?: string;
  active?: boolean;
}

/** Renders Events CRM sidebar with event-scoped groups when an active event is selected. */
export default function EventsSidebar({ forceExpanded = false }: EventsSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState<EventsSidebarContext | null>(null);

  const activeEventId = useMemo(() => {
    return resolveActiveEventId(pathname, searchParams);
  }, [pathname, searchParams]);

  useEffect(() => {
    const scopedEventId = activeEventId;

    if (!scopedEventId) {
      setActiveEvent(null);
      return;
    }
    const resolvedEventId: string = scopedEventId;

    setActiveEvent((previous) => {
      if (previous?.id === resolvedEventId) {
        return previous;
      }

      return { id: resolvedEventId };
    });

    let cancelled = false;

    async function loadActiveEventContext() {
      try {
        const eventData = await apiFetch<EventSidebarApiResponse>(`/api/events/${resolvedEventId}`);
        if (cancelled) return;
        setActiveEvent({
          id: eventData.id || resolvedEventId,
          name: eventData.name,
          status: eventData.status,
          startDate: eventData.startDate,
          location: eventData.location,
          active: eventData.active,
        });
      } catch {
        if (cancelled) return;
        setActiveEvent({ id: resolvedEventId });
      }
    }

    void loadActiveEventContext();

    return () => {
      cancelled = true;
    };
  }, [activeEventId]);

  const groups = useMemo(() => {
    return buildEventsSidebarGroups(activeEvent);
  }, [activeEvent]);

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
