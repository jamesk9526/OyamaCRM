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
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
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

          <CRMActionBar
            context={{
              flags: {
                campaignFilter: filter,
                campaignAllYears: allYears,
              },
            }}
            commandHandlers={{
              "new-campaign": () => setShowModal(true),
              "open-campaign": () => router.push("/campaigns"),
              "all-campaigns": () => setFilter("all"),
              "active-campaigns": () => setFilter("active"),
              "inactive-campaigns": () => setFilter("inactive"),
              "this-year-campaigns": () => setAllYears(false),
              "all-years-campaigns": () => setAllYears(true),
              "refresh-campaigns": () => {
                void loadCampaigns();
              },
            }}
          />
        </div>
      )}
    >
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-emerald-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.22),_transparent_42%),linear-gradient(135deg,_#f0fdf4,_#ffffff_52%,_#f8fafc)] shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] lg:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Fundraising portfolio</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Campaign command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review campaign health, focus stewardship attention, and move from a goal signal into the right donor action without losing the current reporting scope.
            </p>
          </div>
          <div className="rounded-2xl border border-white/90 bg-white/80 p-4 shadow-sm backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Portfolio signal</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{loading ? "—" : `${filtered.filter((campaign) => campaign.active).length} active`}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{scopeLabel} view · {loading ? "Loading campaigns" : `${filtered.length.toLocaleString()} campaign${filtered.length === 1 ? "" : "s"} in the working view`}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all"
                style={{ width: `${campaigns.length > 0 ? Math.max(8, Math.round((campaigns.filter((campaign) => campaign.active).length / campaigns.length) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "Campaigns", value: campaigns.length, helper: `${scopeLabel} portfolio` },
          { label: "Active", value: campaigns.filter((c) => c.active).length, helper: "Currently fundraising", color: "text-emerald-700" },
          { label: "Portfolio Goal", value: `$${totalGoal.toLocaleString()}`, helper: "Configured targets" },
          { label: "Raised", value: `$${totalRaised.toLocaleString()}`, helper: "Completed giving", color: "text-emerald-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${s.color ?? "text-slate-950"}`}>{loading ? "—" : s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.helper}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Campaign view</p>
          <div className="mt-2 flex flex-wrap gap-2">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                filter === f ? "bg-emerald-700 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
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
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm disabled:opacity-50"
          >
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
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
