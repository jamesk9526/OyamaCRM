/** Security settings page surfaces auth hardening work plus destructive recovery controls. */
"use client";

import { useEffect, useState } from "react";
import SettingsResetPanel from "@/app/components/settings/SettingsResetPanel";
import SettingsRecoveryPanel from "@/app/components/settings/SettingsRecoveryPanel";
import { apiFetch } from "@/app/lib/auth-client";

interface AuthSecuritySettings {
  emailMfaEnabled: boolean;
  passwordResetEnabled: boolean;
  mfaCodeTtlMinutes: number;
  passwordResetTtlMinutes: number;
}

const DEFAULT_AUTH_SECURITY: AuthSecuritySettings = {
  emailMfaEnabled: false,
  passwordResetEnabled: true,
  mfaCodeTtlMinutes: 10,
  passwordResetTtlMinutes: 30,
};

/** SecuritySettingsPage defines the security tab backlog and the verified reset flow. */
export default function SecuritySettingsPage() {
  const [authSecurity, setAuthSecurity] = useState<AuthSecuritySettings>(DEFAULT_AUTH_SECURITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    /** Loads auth security settings for MFA and password-reset policy controls. */
    async function loadAuthSecurity() {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<AuthSecuritySettings>("/api/settings/security/auth");
        if (active) setAuthSecurity({ ...DEFAULT_AUTH_SECURITY, ...payload });
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load auth security settings.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAuthSecurity();
    return () => {
      active = false;
    };
  }, []);

  /** Updates one auth security field while clearing stale status messages. */
  function setField<K extends keyof AuthSecuritySettings>(key: K, value: AuthSecuritySettings[K]) {
    setAuthSecurity((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  /** Persists auth security settings and surfaces confirmation state. */
  async function saveAuthSecurity() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = await apiFetch<AuthSecuritySettings>("/api/settings/security/auth", {
        method: "PUT",
        body: JSON.stringify(authSecurity),
      });
      setAuthSecurity({ ...DEFAULT_AUTH_SECURITY, ...payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save auth security settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Control authentication policies, destructive recovery behavior, and other high-risk settings.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900">Authentication Policy</h2>
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            Live
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading security policy...</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={authSecurity.emailMfaEnabled}
                onChange={(event) => setField("emailMfaEnabled", event.target.checked)}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>Require email-based MFA (2-step verification) at login.</span>
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={authSecurity.passwordResetEnabled}
                onChange={(event) => setField("passwordResetEnabled", event.target.checked)}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>Allow forgot-password email reset flow.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">MFA code TTL (minutes)</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={authSecurity.mfaCodeTtlMinutes}
                  onChange={(event) => setField("mfaCodeTtlMinutes", Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Reset token TTL (minutes)</span>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={authSecurity.passwordResetTtlMinutes}
                  onChange={(event) => setField("passwordResetTtlMinutes", Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {saved && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Authentication policy saved.</p>}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAuthSecurity()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Auth Policy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <SettingsResetPanel />

      {/* Recovery snapshots — restore from pre-reset backups */}
      <SettingsRecoveryPanel />
    </div>
  );
}

