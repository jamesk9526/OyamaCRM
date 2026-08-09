import DonorResearchWorkspace from "@/app/components/donor-research/DonorResearchWorkspace";

export const metadata = { title: "Donor Research - Oyama Donor CRM" };

/** Opens the review-first public donor-research workspace. */
export default async function DonorResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ constituentId?: string }>;
}) {
  const params = await searchParams;
  return <DonorResearchWorkspace initialConstituentId={params.constituentId} />;
}
