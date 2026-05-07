/**
 * Campaigns page.
 * Displays fundraising campaigns as cards wired to GET /api/campaigns.
 * Supports filter by active/inactive and creating new campaigns via modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import CampaignCard from "@/app/components/campaigns/CampaignCard";
import NewCampaignModal from "@/app/components/campaigns/NewCampaignModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

/** Campaigns page — card grid with filtering and new campaign modal */
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);

  /** Load campaigns from API */
  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/campaigns`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Campaign[] = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const filtered = campaigns.filter((c) => {
    if (filter === "active") return c.active;
    if (filter === "inactive") return !c.active;
    return true;
  });

  const totalGoal = campaigns.reduce((s, c) => s + Number(c.goal ?? 0), 0);
  const totalRaised = campaigns.reduce((s, c) => s + (c.totalRaised ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fundraising campaigns and goal tracking</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          + New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Campaigns", value: campaigns.length },
          { label: "Active", value: campaigns.filter((c) => c.active).length, color: "text-green-600" },
          { label: "Total Goal", value: `$${totalGoal.toLocaleString()}` },
          { label: "Total Raised", value: `$${totalRaised.toLocaleString()}`, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color ?? "text-gray-900"}`}>{loading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
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
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No campaigns found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadCampaigns(); }}
        />
      )}
    </div>
  );
}
