/** Payments settings page for configuring Stripe and PayPal donation gateways. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type GatewayMode = "sandbox" | "production";

interface PaymentSettingsPayload {
  currency: string;
  stripe: {
    enabled: boolean;
    mode: GatewayMode;
    publishableKey: string;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
  };
  paypal: {
    enabled: boolean;
    mode: GatewayMode;
    clientId: string;
    hasClientSecret: boolean;
    webhookId: string;
  };
}

interface PaymentHealthPayload {
  stripeReady: boolean;
  paypalReady: boolean;
  activeProvider: "stripe" | "paypal" | null;
  currency: string;
  issues: string[];
}

/** Renders admin-only payment provider settings with encrypted-secret save behavior. */
export default function PaymentsGatewaySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [currency, setCurrency] = useState("USD");

  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeMode, setStripeMode] = useState<GatewayMode>("sandbox");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [stripeHasSecretKey, setStripeHasSecretKey] = useState(false);
  const [stripeHasWebhookSecret, setStripeHasWebhookSecret] = useState(false);

  const [paypalEnabled, setPayPalEnabled] = useState(false);
  const [paypalMode, setPayPalMode] = useState<GatewayMode>("sandbox");
  const [paypalClientId, setPayPalClientId] = useState("");
  const [paypalClientSecret, setPayPalClientSecret] = useState("");
  const [paypalWebhookId, setPayPalWebhookId] = useState("");
  const [paypalHasClientSecret, setPayPalHasClientSecret] = useState(false);

  const [health, setHealth] = useState<PaymentHealthPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setSaved(false);
      try {
        const [settings, healthPayload] = await Promise.all([
          apiFetch<PaymentSettingsPayload>("/api/payments/settings"),
          apiFetch<PaymentHealthPayload>("/api/payments/health"),
        ]);

        if (!active) return;

        setCurrency(settings.currency);

        setStripeEnabled(settings.stripe.enabled);
        setStripeMode(settings.stripe.mode);
        setStripePublishableKey(settings.stripe.publishableKey);
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setStripeHasSecretKey(settings.stripe.hasSecretKey);
        setStripeHasWebhookSecret(settings.stripe.hasWebhookSecret);

        setPayPalEnabled(settings.paypal.enabled);
        setPayPalMode(settings.paypal.mode);
        setPayPalClientId(settings.paypal.clientId);
        setPayPalClientSecret("");
        setPayPalWebhookId(settings.paypal.webhookId);
        setPayPalHasClientSecret(settings.paypal.hasClientSecret);

        setHealth(healthPayload);
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load payment settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const updated = await apiFetch<PaymentSettingsPayload>("/api/payments/settings", {
        method: "PUT",
        body: JSON.stringify({
          currency,
          stripe: {
            enabled: stripeEnabled,
            mode: stripeMode,
            publishableKey: stripePublishableKey,
            secretKey: stripeSecretKey,
            webhookSecret: stripeWebhookSecret,
          },
          paypal: {
            enabled: paypalEnabled,
            mode: paypalMode,
            clientId: paypalClientId,
            clientSecret: paypalClientSecret,
            webhookId: paypalWebhookId,
          },
        }),
      });

      const refreshedHealth = await apiFetch<PaymentHealthPayload>("/api/payments/health");

      setStripeHasSecretKey(updated.stripe.hasSecretKey);
      setStripeHasWebhookSecret(updated.stripe.hasWebhookSecret);
      setPayPalHasClientSecret(updated.paypal.hasClientSecret);

      setStripeSecretKey("");
      setStripeWebhookSecret("");
      setPayPalClientSecret("");

      setHealth(refreshedHealth);
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save payment settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading payment settings...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Configure Stripe and PayPal for secure donation checkout in DonorCRM and public site embeds.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Payment settings saved.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Global</h2>
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-gray-700">Default Currency</span>
          <input
            type="text"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="USD"
            maxLength={3}
          />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Stripe</h2>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={stripeEnabled} onChange={(event) => setStripeEnabled(event.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Mode</span>
            <select
              value={stripeMode}
              onChange={(event) => setStripeMode(event.target.value === "production" ? "production" : "sandbox")}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Publishable Key</span>
            <input
              type="text"
              value={stripePublishableKey}
              onChange={(event) => setStripePublishableKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="pk_test_..."
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Secret Key</span>
            <input
              type="password"
              value={stripeSecretKey}
              onChange={(event) => setStripeSecretKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder={stripeHasSecretKey ? "Stored - enter only to rotate" : "sk_test_..."}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Webhook Secret</span>
            <input
              type="password"
              value={stripeWebhookSecret}
              onChange={(event) => setStripeWebhookSecret(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder={stripeHasWebhookSecret ? "Stored - enter only to rotate" : "whsec_..."}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">PayPal</h2>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={paypalEnabled} onChange={(event) => setPayPalEnabled(event.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Mode</span>
            <select
              value={paypalMode}
              onChange={(event) => setPayPalMode(event.target.value === "production" ? "production" : "sandbox")}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Client ID</span>
            <input
              type="text"
              value={paypalClientId}
              onChange={(event) => setPayPalClientId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="PayPal app client ID"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Client Secret</span>
            <input
              type="password"
              value={paypalClientSecret}
              onChange={(event) => setPayPalClientSecret(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder={paypalHasClientSecret ? "Stored - enter only to rotate" : "PayPal app client secret"}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Webhook ID</span>
            <input
              type="text"
              value={paypalWebhookId}
              onChange={(event) => setPayPalWebhookId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional webhook id for verification"
            />
          </label>
        </div>
      </section>

      {health && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Diagnostics</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Stripe Ready</p>
              <p className={`text-sm font-semibold ${health.stripeReady ? "text-green-700" : "text-amber-700"}`}>
                {health.stripeReady ? "Ready" : "Not Ready"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">PayPal Ready</p>
              <p className={`text-sm font-semibold ${health.paypalReady ? "text-green-700" : "text-amber-700"}`}>
                {health.paypalReady ? "Ready" : "Not Ready"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Active Provider</p>
              <p className="text-sm font-semibold text-gray-900">{health.activeProvider ?? "None"}</p>
            </div>
          </div>

          {health.issues.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-700 space-y-1">
              {health.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Payment Settings"}
        </button>
      </div>
    </div>
  );
}
