/** Campaign detail page provides full campaign info, edit, and delete workflow. */
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { apiFetch } from "@/app/lib/auth-client";

interface CampaignDetailDonation {
  id: string;
  amount: number | string;
  date: string;
  status: string;
  paymentMethod?: string | null;
}

/** Formats money for dashboard cards with up to two decimals. */
function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface CampaignDetail {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  goal?: number | string | null;
  totalRaised: number;
  startDate: string;
  endDate?: string | null;
  active: boolean;
  donations: CampaignDetailDonation[];
  _count?: { donations: number; pledges: number };
  performanceSnapshot?: {
    completedRaised: number;
    completedCount: number;
    averageCompletedGift: number;
    largestCompletedGift: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
    totalDonationRecords: number;
  };
  performanceScope?: {
    allYears: boolean;
    year: number | null;
  };
}

const CATEGORIES = [
  "ANNUAL_FUND", "CAPITAL", "ENDOWMENT", "EVENT", "GIVING_DAY", "MAJOR_GIFTS", "PLANNED_GIVING", "GENERAL",
];

/** CampaignDetailPage loads one campaign and exposes full edit/remove controls. */
export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignId = params?.id;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number.parseInt(searchParams.get("year") ?? `${currentYear}`, 10);
  const initialYear = Number.isFinite(requestedYear) ? requestedYear : currentYear;
  const [allYears, setAllYears] = useState(searchParams.get("scope")?.toUpperCase() === "ALL_YEARS");
  const [snapshotYear, setSnapshotYear] = useState(initialYear);
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "ANNUAL_FUND",
    goal: "",
    startDate: "",
    endDate: "",
    active: true,
  });

  /** Formats API category enums into readable labels. */
  function categoryLabel(category: string): string {
    return category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  }

  /** Loads campaign details and syncs edit form state. */
  const loadCampaign = useCallback(async () => {
    if (!campaignId || typeof campaignId !== "string") return;
    setLoading(true);
    setError(null);
    try {
      const scopeParams = new URLSearchParams();
      if (allYears) {
        scopeParams.set("scope", "ALL_YEARS");
      } else {
        scopeParams.set("year", String(snapshotYear));
      }

      const data = await apiFetch<CampaignDetail>(`/api/campaigns/${campaignId}?${scopeParams.toString()}`);
      setCampaign(data);
      setForm({
        name: data.name,
        description: data.description ?? "",
        category: data.category,
        goal: data.goal == null ? "" : String(data.goal),
        startDate: data.startDate ? new Date(data.startDate).toISOString().slice(0, 10) : "",
        endDate: data.endDate ? new Date(data.endDate).toISOString().slice(0, 10) : "",
        active: data.active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }, [allYears, campaignId, snapshotYear]);

  const backHref = allYears ? "/campaigns?scope=ALL_YEARS" : `/campaigns?year=${snapshotYear}`;
  const scopeLabel = allYears ? "All years" : `${snapshotYear}`;

  function updateScope(nextAllYears: boolean, nextYear: number) {
    setAllYears(nextAllYears);
    setSnapshotYear(nextYear);
    if (!campaignId || typeof campaignId !== "string") return;
    const nextParams = new URLSearchParams();
    if (nextAllYears) {
      nextParams.set("scope", "ALL_YEARS");
    } else {
      nextParams.set("year", String(nextYear));
    }
    router.replace(`/campaigns/${campaignId}?${nextParams.toString()}`);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaign();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadCampaign]);

  /** Saves campaign edits through PATCH /api/campaigns/:id. */
  async function saveCampaign() {
    if (!campaignId || typeof campaignId !== "string") return;
    if (!form.name.trim() || !form.startDate) {
      setError("Campaign name and start date are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category,
          goal: form.goal.trim() === "" ? null : Number(form.goal),
          startDate: new Date(form.startDate).toISOString(),
          endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
          active: form.active,
        }),
      });
      await loadCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign.");
    } finally {
      setSaving(false);
    }
  }

  /** Deletes the campaign and navigates back to campaigns list. */
  async function deleteCampaign() {
    if (!campaignId || typeof campaignId !== "string") return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      setShowDeleteModal(false);
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign.");
      setSaving(false);
    }
  }

  const performance = useMemo(() => {
    const goalAmount = Number(campaign?.goal ?? 0);
    const snapshot = campaign?.performanceSnapshot;
    const raised = snapshot?.completedRaised ?? campaign?.totalRaised ?? 0;
    const actualProgress = goalAmount > 0 ? Math.round((raised / goalAmount) * 100) : 0;
    const progressBarPercent = Math.max(0, Math.min(100, actualProgress));
    const remainingToGoal = goalAmount > 0 ? Math.max(0, goalAmount - raised) : 0;
    const overGoal = goalAmount > 0 ? Math.max(0, raised - goalAmount) : 0;

    return {
      goalAmount,
      raised,
      actualProgress,
      progressBarPercent,
      remainingToGoal,
      overGoal,
      completedCount: snapshot?.completedCount ?? 0,
      pendingCount: snapshot?.pendingCount ?? 0,
      failedCount: snapshot?.failedCount ?? 0,
      refundedCount: snapshot?.refundedCount ?? 0,
      totalDonationRecords: snapshot?.totalDonationRecords ?? campaign?._count?.donations ?? 0,
      averageCompletedGift: snapshot?.averageCompletedGift ?? 0,
      largestCompletedGift: snapshot?.largestCompletedGift ?? 0,
    };
  }, [campaign]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "Campaign not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Campaign Info</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{campaign.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review campaign performance, edit campaign settings, or remove campaign.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Back to Campaigns</Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            Delete
          </button>
          <button
            onClick={() => void saveCampaign()}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-green-600 text-sm text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Snapshot Scope</p>
            <p className="text-sm text-gray-700 mt-1">Metrics and recent donations are scoped to <span className="font-semibold">{scopeLabel}</span>.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateScope(false, snapshotYear)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${!allYears ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={() => updateScope(true, snapshotYear)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${allYears ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
            >
              All Years
            </button>
            <select
              value={snapshotYear}
              onChange={(event) => updateScope(false, Number.parseInt(event.target.value, 10))}
              disabled={allYears}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 bg-white disabled:opacity-50"
            >
              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>{optionYear}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Campaign Follow-Up Workflow</p>
        <p className="mt-1 text-sm text-emerald-900">
          Launch communication and stewardship work directly from this campaign so outbound touchpoints, tasks, and path activity stay connected.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/donations/new?source=campaign&campaignId=${campaign.id}&campaignName=${encodeURIComponent(campaign.name)}`}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-md hover:bg-emerald-50"
          >
            Record Donation
          </Link>
          <Link
            href={`/donations?campaignId=${campaign.id}&campaignName=${encodeURIComponent(campaign.name)}`}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-md hover:bg-emerald-50"
          >
            View Campaign Donations
          </Link>
          <Link
            href={`/communications?new=1&source=campaign&campaignId=${campaign.id}`}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50"
          >
            Create Email Campaign
          </Link>
          <Link
            href={`/oyama-letters/generate?campaignId=${campaign.id}`}
            className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-white border border-green-200 rounded-md hover:bg-green-50"
          >
            Generate Appeal Letter
          </Link>
          <Link
            href={`/automations?source=campaign&campaignId=${campaign.id}`}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50"
          >
            Start Follow-Up Path
          </Link>
          <Link
            href={`/email-builder?campaign=${campaign.id}&returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}`}
            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50"
          >
            Open Campaign Email Builder
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Campaign Settings</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">Campaign Name *</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{categoryLabel(category)}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">Goal ($)</span>
              <input
                value={form.goal}
                onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">Status</span>
              <div className="flex items-center gap-2 mt-2">
                <input
                  id="campaign-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="campaign-active" className="text-sm text-gray-700">Campaign is active</label>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">Start Date *</span>
              <input
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-600 font-medium">End Date</span>
              <input
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs text-gray-600 font-medium">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Campaign purpose, audience, and stewardship notes"
            />
          </label>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Performance Snapshot</h2>
          <p className="text-xs text-gray-500">Snapshot uses donation records linked to this campaign in scope: {scopeLabel}.</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Raised (Completed)</p>
            <p className="text-2xl font-semibold text-gray-900">${formatMoney(performance.raised)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Goal</p>
            <p className="text-lg font-semibold text-gray-800">${formatMoney(performance.goalAmount)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Average Gift (Completed)</p>
              <p className="text-sm font-semibold text-gray-800">${formatMoney(performance.averageCompletedGift)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Largest Gift (Completed)</p>
              <p className="text-sm font-semibold text-gray-800">${formatMoney(performance.largestCompletedGift)}</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{performance.actualProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-2 rounded-full bg-green-500" style={{ width: `${performance.progressBarPercent}%` }} />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {performance.goalAmount > 0 ? (
              <p>
                {performance.overGoal > 0
                  ? `$${formatMoney(performance.overGoal)} above goal`
                  : `$${formatMoney(performance.remainingToGoal)} remaining to goal`}
              </p>
            ) : (
              <p>Add a goal to enable target tracking.</p>
            )}
            <p>{performance.totalDonationRecords} donation records tracked</p>
            <p>{performance.completedCount} completed · {performance.pendingCount} pending · {performance.failedCount} failed · {performance.refundedCount} refunded</p>
            <p>{campaign._count?.pledges ?? 0} pledges tracked</p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Recent Donations ({scopeLabel})</h2>
        <div className="mt-3 overflow-x-auto">
          {campaign.donations.length === 0 ? (
            <p className="text-sm text-gray-500">No donations linked to this campaign yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {campaign.donations.map((donation) => (
                  <tr key={donation.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 text-gray-700">{new Date(donation.date).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-gray-900 font-medium">${Number(donation.amount).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-600">{donation.status}</td>
                    <td className="py-2 text-gray-600">{donation.paymentMethod ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showDeleteModal && (
        <WorkspaceSetupModal
          title="Delete Campaign"
          subtitle="This action permanently deletes the campaign and cannot be undone."
          checklist={["1. Verify campaign name", "2. Confirm deletion"]}
          onClose={() => {
            if (saving) return;
            setShowDeleteModal(false);
          }}
          maxWidthClassName="max-w-3xl"
        >
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Destructive action</p>
              <p className="mt-1 text-sm text-red-800">
                Delete <span className="font-semibold">{campaign.name}</span> and remove the campaign record from this workspace.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteCampaign()}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}
