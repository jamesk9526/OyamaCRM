/** Steward Path detail route wrapper. */
import { redirect } from "next/navigation";

interface StewardPathDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Redirects detail route to canonical history surface until dedicated detail UI lands. */
export default async function StewardPathDetailPage({ params }: StewardPathDetailPageProps) {
  const { id } = await params;
  redirect(`/steward-paths/${encodeURIComponent(id)}/builder`);
}
