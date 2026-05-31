import StewardPathPlaygroundPage from "@/app/components/steward-paths/StewardPathPlaygroundPage";

interface StewardPathScopedPlaygroundPageProps {
  params: Promise<{ id: string }>;
}

/** Full-page sandbox Playground for one Steward Path. */
export default async function StewardPathScopedPlaygroundPage({ params }: StewardPathScopedPlaygroundPageProps) {
  const { id } = await params;
  return <StewardPathPlaygroundPage pathId={id} />;
}
