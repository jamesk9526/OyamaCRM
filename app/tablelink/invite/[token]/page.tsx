import PublicTableLinkInvitePage from "@/app/components/events/public/PublicTableLinkInvitePage";

interface PublicTableLinkInviteRouteProps {
  params: Promise<{ token: string }>;
}

/** Public guest self-entry route for TableLink invite tokens. */
export default async function PublicTableLinkInviteRoute({ params }: PublicTableLinkInviteRouteProps) {
  const resolved = await params;
  return <PublicTableLinkInvitePage token={resolved.token} />;
}
