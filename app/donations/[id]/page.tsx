import { redirect } from "next/navigation";

/** Compatibility deep link for integrations until the donation-detail pane has its own route. */
export default async function DonationRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/donations?donationId=${encodeURIComponent(id)}`);
}
