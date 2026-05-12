/**
 * NewCampaignModal component.
 * Modal form for creating a new fundraising campaign.
 * Submits to POST /api/campaigns.
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

const CATEGORIES = [
  "ANNUAL_FUND", "CAPITAL", "ENDOWMENT", "EVENT", "GIVING_DAY",
  "MAJOR_GIFTS", "PLANNED_GIVING", "GENERAL",
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/** NewCampaignModal: inline modal for creating a new campaign */
export default function NewCampaignModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("ANNUAL_FUND");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Submit new campaign to the API */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category,
          ...(goal && { goal: parseFloat(goal) }),
          startDate: new Date(startDate).toISOString(),
          ...(endDate && { endDate: new Date(endDate).toISOString() }),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title="New Campaign"
      subtitle="Create a fundraising campaign with goals, timeline, and category in one guided flow."
      checklist={["1. Name and categorize campaign", "2. Set goal and dates", "3. Save campaign"]}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900">Campaign Setup</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Campaign Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Annual Fund 2025" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Goal ($)</label>
            <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} min="0" step="0.01"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="50000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving || !name.trim() || !startDate}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
              {saving ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}
