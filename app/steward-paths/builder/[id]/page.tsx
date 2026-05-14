/** Builder edit route for one saved Steward Path template. */
import StewardPathBuilderPage from "@/app/components/steward-paths/StewardPathBuilderPage";

interface BuilderByIdPageProps {
  params: Promise<{ id: string }>;
}

/** Loads builder in edit mode by passing template id from route params. */
export default async function StewardPathsBuilderByIdPage({ params }: BuilderByIdPageProps) {
  const { id } = await params;
  return <StewardPathBuilderPage templateIdFromRoute={id} />;
}
