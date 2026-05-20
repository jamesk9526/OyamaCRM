/**
 * Campaigns page.
 * Displays fundraising campaigns as cards wired to GET /api/campaigns.
 * Supports filter by active/inactive and creating new campaigns via modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CampaignCard from "@/app/components/campaigns/CampaignCard";
import NewCampaignModal from "@/app/components/campaigns/NewCampaignModal";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import EmptyStateCard from "@/app/components/ui/EmptyStateCard";
import ActionButton from "@/app/components/ui/ActionButton";
import StewardContextButton from "@/app/components/ai/StewardContextButton";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import FirstRunCard from "@/app/components/ui/FirstRunCard";
import { apiFetch } from "@/app/lib/auth-client";

/** Campaign as returned from the API */
export interface Campaign {
  id: string;
  name: string;
  category: string;
  goal?: number | string | null;
  totalRaised: number;
  startDate: string;
  endDate?: string | null;
  active: boolean;
  _count?: { donations: number };
}

/** Campaigns page — card grid with filtering, new campaign modal, edit and delete */
export default function CampaignsPage() {
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const requestedYear = Number.parseInt(searchParams.get("year") ?? `${currentYear}`, 10);
  const initialYear = Number.isFinite(requestedYear) ? requestedYear : currentYear;
  const initialAllYears = searchParams.get("scope")?.toUpperCase() === "ALL_YEARS";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [year, setYear] = useState<number>(initialYear);
  const [allYears, setAllYears] = useState(initialAllYears);
  const [showModal, setShowModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Campaign | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  /** Load campaigns from API */
  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (allYears) {
        params.set("scope", "ALL_YEARS");
      } else {
        params.set("year", String(year));
      }
      const data = await apiFetch<Campaign[]>(`/api/campaigns?${params.toString()}`);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [allYears, year]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Sync scope controls when route query changes via deep links/back navigation.
  useEffect(() => {
    setAllYears(initialAllYears);
    setYear(initialYear);
  }, [initialAllYears, initialYear]);

  function openDeleteModal(id: string) {
    const candidate = campaigns.find((campaign) => campaign.id === id);
    if (!candidate) return;
    setDeleteCandidate(candidate);
    setDeleteError(null);
  }

  /** Delete a campaign after explicit modal confirmation. */
  async function confirmDeleteCampaign() {
    if (!deleteCandidate) return;

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/campaigns/${deleteCandidate.id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete campaign. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = campaigns.filter((c) => {
    if (filter === "active") return c.active;
    if (filter === "inactive") return !c.active;
    return true;
  });

  const totalGoal = campaigns.reduce((s, c) => s + Number(c.goal ?? 0), 0);
  const totalRaised = campaigns.reduce((s, c) => s + (c.totalRaised ?? 0), 0);

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const scopeLabel = allYears ? "All years" : `${year}`;

  function campaignDetailHref(id: string): string {
    return allYears ? `/campaigns/${id}?scope=ALL_YEARS` : `/campaigns/${id}?year=${year}`;
  }

  return (
    <EnterprisePageShell
      ribbon={(
        <div className="space-y-3">
          <WorkspaceBreadcrumbBar
            items={[
              { label: "Donor CRM", href: "/" },
              { label: "Campaigns" },
            ]}
            statusLabel={loading ? "Loading" : "Working"}
            metadata={`${filtered.length.toLocaleString()} visible · ${campaigns.length.toLocaleString()} total (${scopeLabel})`}
            primaryAction={<WorkspaceRibbonButton label="New Campaign" onClick={() => setShowModal(true)} variant="primary" />}
          />

          <WorkspaceRibbon>
            <WorkspaceRibbonGroup label="Create">
              <WorkspaceRibbonButton label="New Campaign" onClick={() => setShowModal(true)} variant="primary" />
            </WorkspaceRibbonGroup>

            <WorkspaceRibbonGroup label="View">
              <WorkspaceRibbonButton label="All" onClick={() => setFilter("all")} active={filter === "all"} />
              <WorkspaceRibbonButton label="Active" onClick={() => setFilter("active")} active={filter === "active"} />
              <WorkspaceRibbonButton label="Inactive" onClick={() => setFilter("inactive")} active={filter === "inactive"} />
            </WorkspaceRibbonGroup>

            <WorkspaceRibbonGroup label="Scope">
              <WorkspaceRibbonButton label="This Year" onClick={() => setAllYears(false)} active={!allYears} />
              <WorkspaceRibbonButton label="All Years" onClick={() => setAllYears(true)} active={allYears} />
              <WorkspaceRibbonButton label="Refresh" onClick={() => void loadCampaigns()} />
            </WorkspaceRibbonGroup>
          </WorkspaceRibbon>
        </div>
      )}
    >
    <div className="space-y-5">
      <FirstRunCard
        storageKey="howto:campaigns"
        title="Getting started with Campaigns"
        steps={["Create a campaign with a goal, date range, and fund designation", "Link donations to a campaign when recording gifts", "Track progress toward the goal on the campaign card", "Archive a campaign when it ends — history is always preserved"]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: `Total Campaigns (${scopeLabel})`, value: campaigns.length },
          { label: "Active", value: campaigns.filter((c) => c.active).length, color: "text-green-600" },
          { label: `Total Goal (${scopeLabel})`, value: `$${totalGoal.toLocaleString()}` },
          { label: `Total Raised (${scopeLabel})`, value: `$${totalRaised.toLocaleString()}`, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color ?? "text-gray-900"}`}>{loading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-gray-600">
            <input
              type="checkbox"
              checked={allYears}
              onChange={(e) => setAllYears(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include all years
          </label>

          <select
            value={year}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
            disabled={allYears}
            className="rounded-lg border border-gray-200 px-3 py-2 bg-white text-gray-700 disabled:opacity-50"
          >
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500 -mt-1">
        {!allYears
          ? `Campaign totals and raised amounts are scoped to ${year}.`
          : "Campaign totals and raised amounts include all years."}
      </p>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {/* Campaign cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-2 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyStateCard
          title="No campaigns yet"
          description="Create a campaign to organize fundraising goals, donor outreach, and performance tracking for your team."
          icon={(
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 18V6l11-2v12L5 18zM16 7h3v8h-3" />
            </svg>
          )}
          actions={(
            <>
              <ActionButton label="Create Campaign" variant="primary" onClick={() => setShowModal(true)} />
              <ActionButton label="Import Donors" variant="secondary" href="/data-tools/import" />
              <StewardContextButton
                label="Ask Steward"
                prompt="We do not have campaigns yet. Recommend the best first fundraising campaign setup for our nonprofit, with timeline and success metrics."
                moduleKey="donor"
                mode="ask"
                variant="mini"
              />
            </>
          )}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              scopeLabel={scopeLabel}
              onInfo={() => router.push(campaignDetailHref(campaign.id))}
              onEdit={() => router.push(campaignDetailHref(campaign.id))}
              onDelete={openDeleteModal}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadCampaigns(); }}
        />
      )}

      {deleteCandidate && (
        <WorkspaceSetupModal
          title="Delete Campaign"
          subtitle="This action permanently deletes the campaign and cannot be undone."
          checklist={["1. Verify campaign", "2. Confirm permanent deletion"]}
          onClose={() => {
            if (deleteBusy) return;
            setDeleteCandidate(null);
            setDeleteError(null);
          }}
          maxWidthClassName="max-w-3xl"
        >
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Destructive action</p>
              <p className="mt-1 text-sm text-red-800">
                Delete <span className="font-semibold">{deleteCandidate.name}</span> and remove all campaign-level metadata from this workspace.
              </p>
            </div>

            {deleteError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (deleteBusy) return;
                  setDeleteCandidate(null);
                  setDeleteError(null);
                }}
                disabled={deleteBusy}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteCampaign()}
                disabled={deleteBusy}
                className="inline-flex h-9 items-center justify-center rounded-md border border-red-600 bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteBusy ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
    </EnterprisePageShell>
  );
}
