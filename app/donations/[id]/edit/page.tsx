/**
 * Edit Donation page.
 * Server component that loads an existing donation plus the option lists
 * (constituents, campaigns, designations) and hands them to the shared
 * DonationForm in `mode="edit"`.
 */
import DonationForm from "@/app/components/donations/DonationForm";
import Link from "next/link";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Fetch a single donation; returns null on any error. */
async function getDonation(id: string) {
  try {
    const res = await fetch(`${API}/api/donations/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Fetch select-box options (constituents/campaigns/designations) for the form. */
async function getSelectData() {
  try {
    const [constRes, campRes, desigRes] = await Promise.all([
      fetch(`${API}/api/constituents?limit=500`, { cache: "no-store" }),
      fetch(`${API}/api/campaigns?limit=100`, { cache: "no-store" }),
      fetch(`${API}/api/designations?limit=100`, { cache: "no-store" }),
    ]);
    const constituents = constRes.ok ? await constRes.json() : [];
    const campData = campRes.ok ? await campRes.json() : [];
    const desigData = desigRes.ok ? await desigRes.json() : [];
    return {
      constituents: Array.isArray(constituents) ? constituents : (constituents.items ?? []),
      campaigns: Array.isArray(campData) ? campData : (campData.items ?? []),
      designations: Array.isArray(desigData) ? desigData : (desigData.items ?? []),
    };
  } catch {
    return { constituents: [], campaigns: [], designations: [] };
  }
}

/** Map a stored donation into the flat string-based form values DonationForm expects. */
function toFormDefaults(d: Record<string, unknown>) {
  const dateStr = typeof d.date === "string"
    ? d.date.split("T")[0]
    : new Date().toISOString().split("T")[0];
  return {
    constituentId: (d.constituentId as string) ?? "",
    amount: d.amount != null ? String(d.amount) : "",
    date: dateStr,
    paymentMethod: (d.paymentMethod as string) ?? "ONLINE",
    checkNumber: (d.checkNumber as string) ?? "",
    campaignId: (d.campaignId as string) ?? "",
    designationId: (d.designationId as string) ?? "",
    status: (d.status as string) ?? "COMPLETED",
    isRecurring: Boolean(d.isRecurring),
    frequency: (d.frequency as string) ?? "",
    taxDeductible: d.taxDeductible !== false,
    notes: (d.notes as string) ?? "",
  };
}

/**
 * Edit Donation page route.
 * @param params.id - donation ID being edited
 */
export default async function EditDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [donation, selects] = await Promise.all([getDonation(id), getSelectData()]);
  if (!donation) notFound();

  const donor = donation.constituent;
  const donorName = donor ? `${donor.firstName ?? ""} ${donor.lastName ?? ""}`.trim() : "donation";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/donations" className="hover:text-green-600 transition-colors">Donations</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Donation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update gift details for {donorName}.</p>
      </div>

      <DonationForm
        mode="edit"
        donationId={id}
        defaultValues={toFormDefaults(donation)}
        constituents={selects.constituents}
        campaigns={selects.campaigns}
        designations={selects.designations}
      />
    </div>
  );
}
