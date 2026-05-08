/**
 * Campaigns page.
 * Displays fundraising campaigns as cards wired to GET /api/campaigns.
 * Supports filter by active/inactive and creating new campaigns via modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import CampaignCard from "@/app/components/campaigns/CampaignCard";
import NewCampaignModal from "@/app/components/campaigns/NewCampaignModal";
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  /** Load campaigns from API */
  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Campaign[]>("/api/campaigns");
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  /** Delete a campaign after confirmation */
  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete campaign. Please try again.");
    }
  }

  /** Toggle active state when editing */
  async function handleToggleActive(campaign: Campaign) {
    try {
      await apiFetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !campaign.active }),
      });
      setCampaigns((prev) => prev.map((c) => c.id === campaign.id ? { ...c, active: !c.active } : c));
    } catch {
      alert("Failed to update campaign.");
    }
  }

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
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => setEditingCampaign(campaign)}
              onDelete={handleDelete}
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

      {/* Edit campaign: toggle active status inline */}
      {editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Edit Campaign</h2>
              <button onClick={() => setEditingCampaign(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm font-medium text-gray-900">{editingCampaign.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <button
                  onClick={() => { handleToggleActive(editingCampaign); setEditingCampaign(null); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    editingCampaign.active
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {editingCampaign.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setEditingCampaign(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
