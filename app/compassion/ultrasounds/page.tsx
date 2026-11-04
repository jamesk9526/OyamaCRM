import UltrasoundWorkspace from "@/app/components/compassion/ultrasounds/UltrasoundWorkspace";

export default async function UltrasoundsPage({ searchParams }: { searchParams: Promise<{ clientId?: string; examId?: string; status?: string; new?: string }> }) {
  const query = await searchParams;
  return <UltrasoundWorkspace key={query.clientId || "all"} initialClientId={query.clientId} initialExamId={query.examId} initialStatus={query.status} startNew={query.new === "1"} />;
}
