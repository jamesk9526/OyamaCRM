import { redirect } from "next/navigation";

interface StewardPathScopedEnrollmentsPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to enrollments workspace scoped to one path id. */
export default async function StewardPathScopedEnrollmentsPage({ params }: StewardPathScopedEnrollmentsPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/enrollments?pathId=${encodeURIComponent(id)}`);
}
