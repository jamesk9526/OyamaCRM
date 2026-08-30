import { redirect } from "next/navigation";

/** Retired scaffold: event planning remains in the canonical overview until persisted tasks ship. */
export default async function RetiredEventTasksPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/overview`);
}
