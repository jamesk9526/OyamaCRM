import { redirect } from "next/navigation";

/** Retired scaffold: no file controls are exposed until event-scoped storage is production ready. */
export default async function RetiredEventFilesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/overview`);
}
