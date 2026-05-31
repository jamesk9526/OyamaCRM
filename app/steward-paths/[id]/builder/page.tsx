/** Path-scoped builder route wrapper. */
import StewardPathBuilderPage from "@/app/components/steward-paths/StewardPathBuilderPage";

interface StewardPathScopedBuilderPageProps {
  params: Promise<{ id: string }>;
}

/** Loads builder for one path id. */
export default async function StewardPathScopedBuilderPage({ params }: StewardPathScopedBuilderPageProps) {
  const { id } = await params;
  return <StewardPathBuilderPage templateIdFromRoute={id} />;
}
