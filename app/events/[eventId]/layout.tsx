// Event-scoped layout — all event-specific tools inherit the sidebar navigation.
"use client";

import { useParams } from "next/navigation";

/** EventWorkspaceLayout extracts the eventId for sidebar context. */
export default function EventWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const eventId = typeof params.eventId === "string" ? params.eventId : "";

  // EventsShell (parent layout) will use the eventId from the URL automatically
  // This layout just passes children through with the eventId available in context
  return children;
}
