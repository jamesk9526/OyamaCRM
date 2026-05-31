/** Dedicated Path Library route for Steward Paths V2. */
import StewardPathsWorkspaceV2Page from "@/app/components/steward-paths/StewardPathsWorkspaceV2Page";

interface StewardPathsLibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Renders the canonical Path Library command center. */
export default async function StewardPathsLibraryPage({ searchParams }: StewardPathsLibraryPageProps) {
  const query = await searchParams;
  const createValue = query.create;
  const initialOpenCreate = Array.isArray(createValue) ? createValue.includes("1") : createValue === "1";

  return <StewardPathsWorkspaceV2Page initialOpenCreate={initialOpenCreate} />;
}
