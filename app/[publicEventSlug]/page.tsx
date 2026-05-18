import PublicEventPage from "@/app/components/events/public/PublicEventPage";

interface PublicEventSlugRouteProps {
  params: Promise<{ publicEventSlug: string }>;
}

/**
 * Public event page route at root slug URLs (for example /community-impact-conference-2029).
 */
export default async function PublicEventSlugRoute({ params }: PublicEventSlugRouteProps) {
  const resolved = await params;
  return <PublicEventPage pageSlug={resolved.publicEventSlug} />;
}
