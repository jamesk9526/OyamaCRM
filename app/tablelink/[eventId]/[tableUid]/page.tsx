import PublicTableLinkPortal from "@/app/components/events/public/PublicTableLinkPortal";

interface PublicTableLinkPortalRouteProps {
  params: Promise<{ eventId: string; tableUid: string }>;
}

/** Public table host workspace route scoped by event and stable table UID. */
export default async function PublicTableLinkPortalRoute({ params }: PublicTableLinkPortalRouteProps) {
  const resolved = await params;
  return <PublicTableLinkPortal eventId={resolved.eventId} tableUid={resolved.tableUid} />;
}
