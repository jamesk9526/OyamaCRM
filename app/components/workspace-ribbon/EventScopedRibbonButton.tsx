import type { ComponentProps } from "react";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";

type WorkspaceRibbonButtonProps = ComponentProps<typeof WorkspaceRibbonButton>;

interface EventScopedRibbonButtonProps extends Omit<WorkspaceRibbonButtonProps, "href" | "disabled"> {
  eventId?: string;
  /** Relative path under /events/:eventId, e.g. "guests" or "reports". */
  eventPath?: string;
  /** Fallback absolute href for non-event scoped actions. */
  href?: string;
  /** When true (default), button is disabled if no eventId is present. */
  requireEvent?: boolean;
  disabled?: boolean;
}

function normalizeEventPath(eventPath: string): string {
  return eventPath.replace(/^\/+/, "");
}

/**
 * Wraps WorkspaceRibbonButton with event-aware href and disabled behavior.
 * This removes repeated selectedEventId checks across event workspace ribbons.
 */
export default function EventScopedRibbonButton({
  eventId,
  eventPath,
  href,
  requireEvent = true,
  disabled,
  ...rest
}: EventScopedRibbonButtonProps) {
  const hasEventId = typeof eventId === "string" && eventId.length > 0;
  const eventHref = eventPath
    ? hasEventId
      ? `/events/${eventId}/${normalizeEventPath(eventPath)}`
      : undefined
    : href;

  const resolvedDisabled = Boolean(disabled || (requireEvent && !hasEventId));

  return <WorkspaceRibbonButton {...rest} href={eventHref} disabled={resolvedDisabled} />;
}
