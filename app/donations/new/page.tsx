import DonationForm from "@/app/components/donations/DonationForm";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getSelectData() {
  try {
    const [constRes, campRes, desigRes] = await Promise.all([
      fetch(`${API}/api/constituents?limit=500`, { cache: "no-store" }),
      fetch(`${API}/api/campaigns?limit=100`,    { cache: "no-store" }),
      fetch(`${API}/api/designations?limit=100`, { cache: "no-store" }),
    ]);
    const constituents = constRes.ok  ? await constRes.json()  : [];
    const campData     = campRes.ok   ? await campRes.json()   : [];
    const desigData    = desigRes.ok  ? await desigRes.json()  : [];
    return {
      constituents: Array.isArray(constituents) ? constituents : (constituents.items ?? []),
      campaigns:    Array.isArray(campData)     ? campData     : (campData.items ?? []),
      designations: Array.isArray(desigData)    ? desigData    : (desigData.items ?? []),
    };
  } catch {
    return { constituents: [], campaigns: [], designations: [] };
  }
}

export default async function NewDonationPage() {
  const { constituents, campaigns, designations } = await getSelectData();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record Gift</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enter a new donation or gift</p>
      </div>

      <DonationForm
        mode="create"
        constituents={constituents}
        campaigns={campaigns}
        designations={designations}
      />
    </div>
  );
}
