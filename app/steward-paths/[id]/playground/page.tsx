import StewardPathPlaygroundPage from "@/app/components/steward-paths/StewardPathPlaygroundPage";

interface StewardPathScopedPlaygroundPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ constituentId?: string; donorName?: string }>;
}

/** Full-page sandbox Playground for one Steward Path. */
export default async function StewardPathScopedPlaygroundPage({ params, searchParams }: StewardPathScopedPlaygroundPageProps) {
  const { id } = await params;
  const query = await searchParams;
  return <StewardPathPlaygroundPage pathId={id} initialConstituentId={query.constituentId} initialDonorName={query.donorName} />;
}
