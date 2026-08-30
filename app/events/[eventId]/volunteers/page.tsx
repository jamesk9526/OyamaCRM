import { redirect } from "next/navigation";

/** Retired scaffold: event-day staffing is coordinated from the canonical Event Day workspace. */
export default async function RetiredEventVolunteersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/day`);
}
