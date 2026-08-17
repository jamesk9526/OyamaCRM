import { redirect } from "next/navigation";

export const metadata = { title: "OYAMADonorPROFILE - Oyama Donor CRM" };

/** Retains the former route while OYAMADonorPROFILE becomes canonical. */
export default async function DonorResearchCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ constituentId?: string }>;
}) {
  const params = await searchParams;
  const constituent = params.constituentId ? `?constituentId=${encodeURIComponent(params.constituentId)}` : "";
  redirect(`/donor-profile${constituent}`);
}
