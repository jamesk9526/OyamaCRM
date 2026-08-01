/** Deprecated path-scoped editor route preserved as a canonical builder redirect. */
import { redirect } from "next/navigation";

interface StewardPathScopedBuilderPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to the single canonical builder route. */
export default async function StewardPathScopedBuilderPage({ params }: StewardPathScopedBuilderPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/builder/${encodeURIComponent(id)}`);
}
