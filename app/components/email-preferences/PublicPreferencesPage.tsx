/** Public preference center component for tokenized donor email category and global subscription updates. */
"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type GlobalStatus = "SUBSCRIBED" | "PARTIALLY_SUBSCRIBED" | "UNSUBSCRIBED" | "UNKNOWN";
type CategoryStatus = "SUBSCRIBED" | "UNSUBSCRIBED";

interface CategoryPreference {
  category: string;
  status: CategoryStatus;
}

interface PreferencePayload {
  organizationName: string;
  emailMasked: string;
  email: string;
  globalStatus: GlobalStatus;
  categoryHint?: string | null;
  categoryPreferences: CategoryPreference[];
  expiresAt?: string | null;
  usedAt?: string | null;
}

/** Renders the public manage-preferences experience for a single email token. */
export default function PublicPreferencesPage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payload, setPayload] = useState<PreferencePayload | null>(null);
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>("UNKNOWN");
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreference[]>([]);

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/email/preferences/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message ?? "Failed to load preference data");
        }
        if (!active) return;
        const typed = data as PreferencePayload;
        setPayload(typed);
        setGlobalStatus(typed.globalStatus ?? "UNKNOWN");
        setCategoryPreferences(Array.isArray(typed.categoryPreferences) ? typed.categoryPreferences : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load preferences");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreferences();
    return () => {
      active = false;
    };
  }, [token]);

  /** Updates one category checkbox state in local UI before save. */
  function setCategoryStatus(category: string, nextStatus: CategoryStatus) {
    setCategoryPreferences((prev) => prev.map((row) => (
      row.category === category ? { ...row, status: nextStatus } : row
    )));
  }

  /** Submits global + category updates back to the public preference API. */
  async function savePreferences() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/email/preferences/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalStatus,
          categoryPreferences,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "Failed to save preferences");
      }
      setSuccess("Your communication preferences were updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  const isExpired = payload?.expiresAt
    ? new Date(payload.expiresAt).getTime() < Date.now()
    : false;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">Loading preference center...</p>
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center space-y-2">
          <h1 className="text-lg font-semibold text-gray-900">Preference link unavailable</h1>
          <p className="text-sm text-red-600">{error ?? "This preference link is invalid."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-gray-900">Manage Email Preferences</h1>
          <p className="text-sm text-gray-600">{payload.organizationName}</p>
          <p className="text-sm text-gray-600">Managing preferences for {payload.emailMasked}</p>
        </header>

        {isExpired && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This link has expired. Contact the organization to request a fresh preference link.
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="global-status">Global subscription status</label>
          <select
            id="global-status"
            value={globalStatus}
            onChange={(event) => setGlobalStatus(event.target.value as GlobalStatus)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            disabled={isExpired}
          >
            <option value="SUBSCRIBED">Subscribed</option>
            <option value="PARTIALLY_SUBSCRIBED">Partially Subscribed</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-700">Email categories</h2>
          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
            {categoryPreferences.map((preference) => (
              <label key={preference.category} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                <span>{preference.category.replace(/_/g, " ")}</span>
                <input
                  type="checkbox"
                  checked={preference.status === "SUBSCRIBED"}
                  onChange={(event) => setCategoryStatus(preference.category, event.target.checked ? "SUBSCRIBED" : "UNSUBSCRIBED")}
                  disabled={isExpired}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void savePreferences()}
            disabled={saving || isExpired}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
          {success && <p className="text-sm text-green-700">{success}</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
