/**
 * New Donation page.
 * Client component that loads select data (constituents, campaigns, designations)
 * via authenticated apiFetch and renders the shared DonationForm in create mode.
 */
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DonationForm from "@/app/components/donations/DonationForm";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
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
  const searchParams = useSearchParams();
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

  const source = searchParams.get("source") ?? "";
  const grantTitle = searchParams.get("grantTitle") ?? "";
  const funderName = searchParams.get("funderName") ?? "";
  const suggestedAmount = searchParams.get("suggestedAmount") ?? "";

  const grantPrefill = source === "grant-award"
    ? {
        amount: suggestedAmount && !Number.isNaN(Number(suggestedAmount)) ? String(Number(suggestedAmount)) : "",
        notes: [
          grantTitle ? `Grant opportunity: ${grantTitle}` : "",
          funderName ? `Funder: ${funderName}` : "",
          "Recorded from Grants workspace. Financial ledger source-of-truth remains Donations.",
        ].filter(Boolean).join("\n"),
      }
    : undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Donations", href: "/donations" },
          { label: "Record Gift" },
        ]}
        statusLabel={source === "grant-award" ? "Grant Handoff" : "New Entry"}
        metadata={source === "grant-award" ? "Recording awarded grant revenue in Donations ledger" : "Enter donation details and stewardship data"}
        primaryAction={<WorkspaceRibbonButton label="Donation Ledger" href="/donations" />}
      />

      {source === "grant-award" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Recording a received grant in Donations. This does not convert the grant workspace record into revenue automatically.
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading form…</div>
      ) : (
        <DonationForm
          mode="create"
          defaultValues={grantPrefill}
          constituents={selectData.constituents}
          campaigns={selectData.campaigns}
          designations={selectData.designations}
        />
      )}
    </div>
  );
}
