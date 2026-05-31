import { redirect } from "next/navigation";

interface StewardPathScopedReviewPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to review queue scoped to one path id. */
export default async function StewardPathScopedReviewPage({ params }: StewardPathScopedReviewPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/review?pathId=${encodeURIComponent(id)}`);
}
