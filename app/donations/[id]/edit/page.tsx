/**
 * Edit Donation page.
 * Client component that loads an existing donation plus the option lists
 * (constituents, campaigns, designations) and hands them to the shared
 * DonationForm in `mode="edit"`.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DonationForm from "@/app/components/donations/DonationForm";
import { notFound } from "next/navigation";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import { apiFetch } from "@/app/lib/auth-client";

interface Constituent { id: string; firstName: string; lastName: string; email?: string }
interface Campaign    { id: string; name: string }
interface Designation { id: string; name: string }

/** Map a stored donation into the flat string-based form values DonationForm expects. */
function toFormDefaults(d: Record<string, unknown>) {
  // Donations always have a `date` in our schema; the today fallback exists only
  // as a defensive safeguard for malformed/legacy rows so the form still mounts
  // instead of crashing. Real edits will overwrite this on save. Log a warning
  // so data-quality issues surface in logs and can be cleaned up.
  let dateStr: string;
  if (typeof d.date === "string") {
    dateStr = d.date.split("T")[0];
  } else {
    console.warn(
      `[donations/edit] donation ${String(d.id ?? "?")} missing a string date; defaulting to today`,
    );
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    dateStr = `${y}-${m}-${day}`;
  }
  return {
    constituentId: (d.constituentId as string) ?? "",
    amount:        d.amount != null ? String(d.amount) : "",
    date:          dateStr,
    paymentMethod: (d.paymentMethod as string) ?? "ONLINE",
    checkNumber:   (d.checkNumber as string) ?? "",
    campaignId:    (d.campaignId as string) ?? "",
    designationId: (d.designationId as string) ?? "",
    status:        (d.status as string) ?? "COMPLETED",
    isRecurring:   Boolean(d.isRecurring),
    frequency:     (d.frequency as string) ?? "",
    taxDeductible: d.taxDeductible !== false,
    notes:         (d.notes as string) ?? "",
  };
}

/**
 * Edit Donation page route.
 * Loads the donation and select-box options, then renders DonationForm.
 */
export default function EditDonationPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [donation, setDonation] = useState<Record<string, unknown> | null>(null);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [donationData, constData, campData, desigData] = await Promise.all([
          apiFetch<Record<string, unknown>>(`/api/donations/${id}`),
          apiFetch<Constituent[] | { items?: Constituent[] }>("/api/constituents?limit=40"),
          apiFetch<Campaign[]    | { items?: Campaign[]    }>("/api/campaigns?limit=100"),
          apiFetch<Designation[] | { items?: Designation[] }>("/api/designations?limit=100"),
        ]);
        setDonation(donationData);
        const baseConstituents = Array.isArray(constData) ? constData : ((constData as { items?: Constituent[] }).items ?? []);
        const selectedConstituentId = typeof donationData.constituentId === "string" ? donationData.constituentId : "";
        const selectedConstituent = donationData.constituent as { firstName?: string; lastName?: string; email?: string } | undefined;

        if (
          selectedConstituentId &&
          selectedConstituent &&
          !baseConstituents.some((c) => c.id === selectedConstituentId)
        ) {
          setConstituents([
            {
              id: selectedConstituentId,
              firstName: selectedConstituent.firstName ?? "",
              lastName: selectedConstituent.lastName ?? "",
              email: selectedConstituent.email,
            },
            ...baseConstituents,
          ]);
        } else {
          setConstituents(baseConstituents);
        }
        setCampaigns(   Array.isArray(campData)  ? campData  : ((campData  as { items?: Campaign[]    }).items ?? []));
        setDesignations(Array.isArray(desigData) ? desigData : ((desigData as { items?: Designation[] }).items ?? []));
      } catch {
        setNotFoundFlag(true);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (notFoundFlag || !donation) {
    notFound();
    return null;
  }

  const donor = donation.constituent as { firstName?: string; lastName?: string } | undefined;
  const donorName = donor ? `${donor.firstName ?? ""} ${donor.lastName ?? ""}`.trim() : "donation";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Donations", href: "/donations" },
          { label: "Edit Donation" },
        ]}
        statusLabel="Edit"
        metadata={`Updating gift details for ${donorName}`}
        primaryAction={<WorkspaceRibbonButton label="Donation Ledger" href="/donations" />}
      />

      <DonationForm
        mode="edit"
        donationId={id}
        defaultValues={toFormDefaults(donation)}
        constituents={constituents}
        campaigns={campaigns}
        designations={designations}
      />
    </div>
  );
}
