import GuidedEventCreator from "@/app/components/events/creator/GuidedEventCreator";
export default async function CreateEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <GuidedEventCreator eventId={eventId} />;
}
