import OyamaDonorProfileWorkspace from "@/app/components/donor-profile/OyamaDonorProfileWorkspace";

export const metadata = { title: "OYAMADonorPROFILE - Oyama Donor CRM" };

/** Opens the first-party, evidence-first OYAMADonorPROFILE workspace. */
export default async function OyamaDonorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ constituentId?: string }>;
}) {
  const params = await searchParams;
  return <OyamaDonorProfileWorkspace initialConstituentId={params.constituentId} />;
}

