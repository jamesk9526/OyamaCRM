/** Constituent email preference panel for viewing and updating compliance subscription settings. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type GlobalStatus = "SUBSCRIBED" | "PARTIALLY_SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED" | "SUPPRESSED" | "PENDING_CONFIRMATION" | "UNKNOWN";
type CategoryStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

interface CategoryPreference {
  category: string;
  status: CategoryStatus;
}

interface SuppressionRow {
  id: string;
  reason: string;
  source?: string | null;
  createdAt: string;
}

interface SubscriptionPayload {
  subscription: {
    id: string;
    email: string;
    globalStatus: GlobalStatus;
  } | null;
  categoryPreferences: CategoryPreference[];
  suppressions: SuppressionRow[];
}

/** Renders donor profile controls for global and category-level email consent state. */
export default function EmailPreferencePanel({ constituentId, email }: { constituentId: string; email?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>("UNKNOWN");
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreference[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionRow[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<{ unsubscribeUrl: string; preferencesUrl: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<SubscriptionPayload>(`/api/email/subscriptions/by-constituent/${constituentId}`);
        if (!active) return;
        setGlobalStatus(data.subscription?.globalStatus ?? "UNKNOWN");
        setCategoryPreferences(data.categoryPreferences ?? []);
        setSuppressions(data.suppressions ?? []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load email preferences");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [constituentId, email]);

  /** Updates one category status in local panel state before persisting. */
  function updateCategory(category: string, checked: boolean) {
    setCategoryPreferences((prev) => prev.map((row) => (
      row.category === category
        ? { ...row, status: checked ? "SUBSCRIBED" : "UNSUBSCRIBED" }
        : row
    )));
  }

  /** Persists global and category preference updates for this constituent. */
  async function savePreferences() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/email/subscriptions/by-constituent/${constituentId}`, {
        method: "PUT",
        body: JSON.stringify({
          globalStatus,
          categoryPreferences,
        }),
      });
      setSuccess("Email preferences updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  /** Creates fresh tokenized unsubscribe and preferences URLs for sharing with the donor. */
  async function generatePreferenceLinks() {
    if (!email) return;
    setError(null);
    try {
      const data = await apiFetch<{ unsubscribeUrl: string; preferencesUrl: string }>("/api/email/subscriptions/token", {
        method: "POST",
        body: JSON.stringify({
          email,
          purpose: "MARKETING",
          expiresDays: 90,
        }),
      });
      setGeneratedLinks({
        unsubscribeUrl: data.unsubscribeUrl,
        preferencesUrl: data.preferencesUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preference links");
    }
  }

  if (!email) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Add an email address to enable subscription and preference management.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Loading email preferences...
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Email Subscription Compliance</h3>
        <p className="text-xs text-gray-500">Manage consent and suppression settings for this constituent.</p>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500" htmlFor="global-status">
        Global Status
      </label>
      <select
        id="global-status"
        value={globalStatus}
        onChange={(event) => setGlobalStatus(event.target.value as GlobalStatus)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        <option value="SUBSCRIBED">Subscribed</option>
        <option value="PARTIALLY_SUBSCRIBED">Partially Subscribed</option>
        <option value="UNSUBSCRIBED">Unsubscribed</option>
        <option value="BOUNCED">Bounced</option>
        <option value="SUPPRESSED">Suppressed</option>
        <option value="PENDING_CONFIRMATION">Pending Confirmation</option>
        <option value="UNKNOWN">Unknown</option>
      </select>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Category Preferences</p>
        <div className="grid grid-cols-1 gap-1 rounded-lg border border-gray-200 p-2">
          {categoryPreferences.map((preference) => (
            <label key={preference.category} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span>{preference.category.replace(/_/g, " ")}</span>
              <input
                type="checkbox"
                checked={preference.status === "SUBSCRIBED"}
                onChange={(event) => updateCategory(preference.category, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>

      {suppressions.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          <p className="font-semibold">Active Suppressions</p>
          {suppressions.map((suppression) => (
            <p key={suppression.id}>{suppression.reason.replace(/_/g, " ")} ({new Date(suppression.createdAt).toLocaleDateString()})</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void savePreferences()}
          disabled={saving}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        <button
          type="button"
          onClick={() => void generatePreferenceLinks()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Generate Public Links
        </button>
      </div>

      {generatedLinks && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700 space-y-1">
          <p>Unsubscribe: {generatedLinks.unsubscribeUrl}</p>
          <p>Preferences: {generatedLinks.preferencesUrl}</p>
        </div>
      )}

      {success && <p className="text-xs text-green-700">{success}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
