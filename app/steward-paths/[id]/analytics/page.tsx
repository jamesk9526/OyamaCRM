import { redirect } from "next/navigation";

interface StewardPathScopedAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to analytics workspace scoped to one path id. */
export default async function StewardPathScopedAnalyticsPage({ params }: StewardPathScopedAnalyticsPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/analytics?pathId=${encodeURIComponent(id)}`);
}
