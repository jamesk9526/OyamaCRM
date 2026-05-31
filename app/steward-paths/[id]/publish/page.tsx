import { redirect } from "next/navigation";

interface StewardPathScopedPublishPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to publish stage anchored in review workspace. */
export default async function StewardPathScopedPublishPage({ params }: StewardPathScopedPublishPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/review?pathId=${encodeURIComponent(id)}&mode=publish`);
}
