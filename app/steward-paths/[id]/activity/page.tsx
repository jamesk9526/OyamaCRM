import { redirect } from "next/navigation";

interface StewardPathScopedActivityPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects to canonical path history activity timeline. */
export default async function StewardPathScopedActivityPage({ params }: StewardPathScopedActivityPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/${encodeURIComponent(id)}/history`);
}
