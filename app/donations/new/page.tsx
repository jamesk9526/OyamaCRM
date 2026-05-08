/**
 * New Donation page.
 * Client component that loads select data (constituents, campaigns, designations)
 * via authenticated apiFetch and renders the shared DonationForm in create mode.
 */
"use client";

import { useEffect, useState } from "react";
import DonationForm from "@/app/components/donations/DonationForm";
import { apiFetch } from "@/app/lib/auth-client";

interface Constituent { id: string; firstName: string; lastName: string }
interface Campaign    { id: string; name: string }
interface Designation { id: string; name: string }

interface SelectData {
  constituents: Constituent[];
  campaigns:    Campaign[];
  designations: Designation[];
}

/** New Donation page — loads form options then renders DonationForm in create mode. */
export default function NewDonationPage() {
  const [selectData, setSelectData] = useState<SelectData>({
    constituents: [],
    campaigns:    [],
    designations: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [constData, campData, desigData] = await Promise.all([
          apiFetch<Constituent[] | { items?: Constituent[] }>("/api/constituents?limit=500"),
          apiFetch<Campaign[]    | { items?: Campaign[]    }>("/api/campaigns?limit=100"),
          apiFetch<Designation[] | { items?: Designation[] }>("/api/designations?limit=100"),
        ]);
        setSelectData({
          constituents: Array.isArray(constData) ? constData : ((constData as { items?: Constituent[] }).items ?? []),
          campaigns:    Array.isArray(campData)  ? campData  : ((campData  as { items?: Campaign[]    }).items ?? []),
          designations: Array.isArray(desigData) ? desigData : ((desigData as { items?: Designation[] }).items ?? []),
        });
      } catch {
        // Silently fail — form renders with empty selects
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record Gift</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enter a new donation or gift</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading form…</div>
      ) : (
        <DonationForm
          mode="create"
          constituents={selectData.constituents}
          campaigns={selectData.campaigns}
          designations={selectData.designations}
        />
      )}
    </div>
  );
}
