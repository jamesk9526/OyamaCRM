import CareWorkspace from "@/app/components/compassion/CareWorkspace";
export default async function CarePage({ searchParams }: { searchParams: Promise<{ clientId?: string; kind?: string }> }) { const query = await searchParams; return <CareWorkspace initialClientId={query.clientId} initialKind={query.kind} />; }
