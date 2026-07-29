"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  PlugZap,
  RefreshCw,
  Save,
  Settings2,
} from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import type {
  DonationWidgetSettings,
  SiteEmbedsConfigPayload,
  SiteEmbedSiteConfig,
} from "@/app/components/settings/site-embeds/site-embed-types";

type GatewayMode = "sandbox" | "production";
type WorkspaceTab = "overview" | "connection" | "builder" | "install" | "activity";

interface PaymentSettingsPayload {
  currency: string;
  stripe: {
    enabled: boolean;
    mode: GatewayMode;
    publishableKey: string;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
  };
}

interface PaymentHealthPayload {
  stripeReady: boolean;
  stripeCheckoutReady: boolean;
  stripeWebhookReady: boolean;
  currency: string;
  issues: string[];
  webhookUrl: string;
}

interface StripeConnectionResult {
  connected: boolean;
  accountId: string;
  displayName: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string;
  defaultCurrency: string;
  webhookUrl: string;
}

interface StripeEventRow {
  id: string;
  externalEventId: string;
  eventType: string;
  status: string;
  donationId: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof CreditCard }> = [
  { id: "overview", label: "Overview", icon: CreditCard },
  { id: "connection", label: "Connection", icon: PlugZap },
  { id: "builder", label: "Donation form", icon: Settings2 },
  { id: "install", label: "Install", icon: Code2 },
  { id: "activity", label: "Payment activity", icon: Activity },
];

function splitList(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
}

function statusTone(ok: boolean): string {
  return ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-slate-700">{children}</span>;
}

const fieldClass = "min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

/** Dedicated Donor CRM integration app for Stripe setup, form design, installation, and verified webhook operations. */
export default function StripeIntegrationWorkspace() {
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [settings, setSettings] = useState<PaymentSettingsPayload | null>(null);
  const [health, setHealth] = useState<PaymentHealthPayload | null>(null);
  const [sitePayload, setSitePayload] = useState<SiteEmbedsConfigPayload | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteEmbedSiteConfig | null>(null);
  const [events, setEvents] = useState<StripeEventRow[]>([]);
  const [connectionResult, setConnectionResult] = useState<StripeConnectionResult | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [suggestedAmountsText, setSuggestedAmountsText] = useState("");
  const [designationsText, setDesignationsText] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [paymentSettings, paymentHealth, embeds, eventPayload] = await Promise.all([
        apiFetch<PaymentSettingsPayload>("/api/payments/settings"),
        apiFetch<PaymentHealthPayload>("/api/payments/health"),
        apiFetch<SiteEmbedsConfigPayload>("/api/site-embeds/config"),
        apiFetch<{ items: StripeEventRow[] }>("/api/payments/stripe/events"),
      ]);
      setSettings(paymentSettings);
      setHealth(paymentHealth);
      setSitePayload(embeds);
      const selected = embeds.sites.find((site) => site.id === embeds.selectedSiteId) ?? embeds.sites[0] ?? null;
      setSiteDraft(selected);
      setSuggestedAmountsText(selected?.widgets.donation_widget.suggestedAmounts.join(", ") ?? "");
      setDesignationsText(selected?.widgets.donation_widget.allowedDesignations.join("\n") ?? "");
      setEvents(eventPayload.items);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe integration could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const widget = siteDraft?.widgets.donation_widget ?? null;
  const embedSnippet = sitePayload?.snippets.embedBlocks.donation_widget ?? "";
  const readiness = useMemo(() => [
    { label: "Stripe credentials", ready: Boolean(health?.stripeCheckoutReady), detail: "Publishable and secret keys match the selected mode." },
    { label: "Verified webhook", ready: Boolean(health?.stripeWebhookReady), detail: "Signed events can create CRM donation records." },
    { label: "Donation form", ready: Boolean(widget?.enabled), detail: "The public form is enabled for this website connection." },
    { label: "Allowed website", ready: Boolean(siteDraft?.active && (siteDraft.primaryDomain || siteDraft.allowedDomains.length)), detail: "The embed token is restricted to an active website." },
  ], [health, siteDraft, widget]);

  function updateStripe(patch: Partial<PaymentSettingsPayload["stripe"]>) {
    setSettings((current) => current ? { ...current, stripe: { ...current.stripe, ...patch } } : current);
  }

  function updateWidget(patch: Partial<DonationWidgetSettings>) {
    setSiteDraft((current) => current ? {
      ...current,
      widgets: {
        ...current.widgets,
        donation_widget: { ...current.widgets.donation_widget, ...patch },
      },
    } : current);
  }

  async function saveConnection() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch<PaymentSettingsPayload>("/api/payments/settings", {
        method: "PUT",
        body: JSON.stringify({
          currency: settings.currency,
          stripe: {
            enabled: settings.stripe.enabled,
            mode: settings.stripe.mode,
            publishableKey: settings.stripe.publishableKey,
            secretKey,
            webhookSecret,
          },
        }),
      });
      setSettings(updated);
      setSecretKey("");
      setWebhookSecret("");
      const nextHealth = await apiFetch<PaymentHealthPayload>("/api/payments/health");
      setHealth(nextHealth);
      setMessage({ tone: "success", text: "Stripe connection settings saved securely." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe settings could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function saveWidget() {
    if (!siteDraft || !settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const nextWidget: DonationWidgetSettings = {
        ...siteDraft.widgets.donation_widget,
        stripeTestMode: settings.stripe.mode === "sandbox",
        suggestedAmounts: splitList(suggestedAmountsText).map(Number).filter((amount) => Number.isFinite(amount) && amount > 0),
        allowedDesignations: splitList(designationsText),
      };
      await apiFetch("/api/site-embeds/config", {
        method: "PUT",
        body: JSON.stringify({
          siteId: siteDraft.id,
          name: siteDraft.name,
          publicSiteId: siteDraft.publicSiteId,
          primaryDomain: siteDraft.primaryDomain,
          allowedDomains: siteDraft.allowedDomains,
          active: siteDraft.active,
          appearance: siteDraft.appearance,
          widgets: { ...siteDraft.widgets, donation_widget: nextWidget },
        }),
      });
      await load();
      setMessage({ tone: "success", text: "Donation form saved and install code regenerated." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Donation form could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const result = await apiFetch<StripeConnectionResult>("/api/payments/stripe/test", { method: "POST" });
      setConnectionResult(result);
      setMessage({
        tone: result.chargesEnabled ? "success" : "error",
        text: result.chargesEnabled ? `Connected to ${result.displayName || result.accountId}.` : "Stripe connected, but charges are not enabled on this account.",
      });
    } catch (error) {
      setConnectionResult(null);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  async function copyCode(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  }

  if (loading) {
    return <div className="min-h-[55vh] rounded-lg border border-slate-200 bg-white p-10 text-sm text-slate-500">Loading Stripe integration…</div>;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <header className="border-b border-slate-200 bg-white px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-[#635bff] text-white shadow-sm"><CreditCard className="size-5" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-950">Stripe Giving</h1>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(Boolean(health?.stripeReady))}`}>
                  {health?.stripeReady ? "Ready" : "Setup required"}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Connect Stripe, build an embeddable giving form, and record verified gifts in Donor CRM.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/payments" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Payment ledger <ExternalLink className="size-3.5" />
            </Link>
            <button type="button" onClick={() => void load()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <nav className="flex overflow-x-auto border-b border-slate-200 bg-white px-3 lg:px-6" aria-label="Stripe integration sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950"}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      <main className="p-4 lg:p-7">
        {message ? (
          <div className={`mb-5 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {message.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            {message.text}
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Go-live checklist</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">One workflow from website gift to donor record</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {readiness.map((item) => (
                    <button key={item.label} type="button" onClick={() => setTab(item.label === "Donation form" || item.label === "Allowed website" ? "builder" : "connection")} className="rounded-md border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/40">
                      <div className="flex items-center gap-2">
                        {item.ready ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
                        <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Automatic CRM logging</p>
                <p className="mt-3 text-3xl font-semibold">{events.filter((event) => event.status === "PROCESSED").length}</p>
                <p className="mt-1 text-sm text-slate-300">recent verified Stripe events recorded</p>
                <div className="mt-5 border-t border-slate-700 pt-4 text-xs leading-5 text-slate-300">
                  Signed Stripe events create a completed credit-card donation, link or create the donor, attach an activity, and refresh giving totals. Duplicate webhook deliveries are ignored safely.
                </div>
              </div>
            </section>
            {health?.issues.length ? (
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">Before accepting gifts</h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">{health.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "connection" && settings ? (
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-950">Stripe account connection</h2>
                <p className="mt-1 text-xs text-slate-500">Keys are encrypted at rest. Saved secret values are never returned to the browser.</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div><p className="text-sm font-semibold text-slate-900">Accept Stripe donations</p><p className="text-xs text-slate-500">Disable this switch to stop new checkouts.</p></div>
                  <button type="button" role="switch" aria-checked={settings.stripe.enabled} onClick={() => updateStripe({ enabled: !settings.stripe.enabled })} className={`relative h-6 w-11 rounded-full transition ${settings.stripe.enabled ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${settings.stripe.enabled ? "left-6" : "left-1"}`} /></button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><FieldLabel>Environment</FieldLabel><select className={fieldClass} value={settings.stripe.mode} onChange={(event) => updateStripe({ mode: event.target.value === "production" ? "production" : "sandbox" })}><option value="sandbox">Test mode</option><option value="production">Live mode</option></select></label>
                  <label><FieldLabel>Currency</FieldLabel><input className={fieldClass} maxLength={3} value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })} /></label>
                </div>
                <label><FieldLabel>Publishable key</FieldLabel><input className={`${fieldClass} font-mono`} value={settings.stripe.publishableKey} onChange={(event) => updateStripe({ publishableKey: event.target.value.trim() })} placeholder={settings.stripe.mode === "production" ? "pk_live_…" : "pk_test_…"} /></label>
                <label><FieldLabel>Secret key {settings.stripe.hasSecretKey ? <span className="font-normal text-emerald-700">· securely stored</span> : null}</FieldLabel><input type="password" className={`${fieldClass} font-mono`} value={secretKey} onChange={(event) => setSecretKey(event.target.value)} placeholder={settings.stripe.hasSecretKey ? "Leave blank to keep saved key" : settings.stripe.mode === "production" ? "sk_live_…" : "sk_test_…"} /></label>
                <label><FieldLabel>Webhook signing secret {settings.stripe.hasWebhookSecret ? <span className="font-normal text-emerald-700">· securely stored</span> : null}</FieldLabel><input type="password" className={`${fieldClass} font-mono`} value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder={settings.stripe.hasWebhookSecret ? "Leave blank to keep saved secret" : "whsec_…"} /></label>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" disabled={testing || !health?.stripeCheckoutReady} onClick={() => void testConnection()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><PlugZap className="size-4" />{testing ? "Testing…" : "Test connection"}</button>
                  <button type="button" disabled={saving} onClick={() => void saveConnection()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save className="size-4" />{saving ? "Saving…" : "Save connection"}</button>
                </div>
              </div>
            </section>
            <aside className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-950">Webhook endpoint</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Add this endpoint in Stripe Workbench and subscribe to <code>checkout.session.completed</code> and <code>invoice.paid</code>.</p>
                <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-950 p-2.5 text-white"><code className="min-w-0 flex-1 break-all text-[11px]">{health?.webhookUrl}</code><button type="button" onClick={() => void copyCode("webhook", health?.webhookUrl ?? "")} className="shrink-0 rounded p-1 hover:bg-slate-800"><Copy className="size-4" /></button></div>
                {copied === "webhook" ? <p className="mt-2 text-xs text-emerald-700">Copied.</p> : null}
              </section>
              {connectionResult ? <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">{connectionResult.displayName || connectionResult.accountId}</p><p className="mt-1 text-xs">Charges {connectionResult.chargesEnabled ? "enabled" : "disabled"} · Payouts {connectionResult.payoutsEnabled ? "enabled" : "disabled"} · {connectionResult.country}</p></section> : null}
            </aside>
          </div>
        ) : null}

        {tab === "builder" && widget && siteDraft ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div><h2 className="font-semibold text-slate-950">Donation form builder</h2><p className="mt-1 text-xs text-slate-500">Design the public giving experience without changing checkout security.</p></div>
                <button type="button" role="switch" aria-checked={widget.enabled} onClick={() => updateWidget({ enabled: !widget.enabled })} className={`relative h-6 w-11 rounded-full transition ${widget.enabled ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${widget.enabled ? "left-6" : "left-1"}`} /></button>
              </div>
              <div className="space-y-6 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Website and availability</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label><FieldLabel>Connection name</FieldLabel><input className={fieldClass} value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} /></label>
                    <label><FieldLabel>Primary domain</FieldLabel><input className={fieldClass} value={siteDraft.primaryDomain} onChange={(event) => setSiteDraft({ ...siteDraft, primaryDomain: event.target.value })} placeholder="give.example.org" /></label>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Content</h3>
                  <div className="mt-3 space-y-4">
                    <label><FieldLabel>Headline</FieldLabel><input className={fieldClass} value={widget.headline} onChange={(event) => updateWidget({ headline: event.target.value })} /></label>
                    <label><FieldLabel>Supporting message</FieldLabel><textarea className={fieldClass} rows={3} value={widget.supportingCopy} onChange={(event) => updateWidget({ supportingCopy: event.target.value })} /></label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label><FieldLabel>Suggested amounts</FieldLabel><input className={fieldClass} value={suggestedAmountsText} onChange={(event) => setSuggestedAmountsText(event.target.value)} placeholder="25, 50, 100, 250" /></label>
                      <label><FieldLabel>Minimum gift (dollars)</FieldLabel><input type="number" min="1" step="0.01" className={fieldClass} value={(widget.minimumAmountCents / 100).toString()} onChange={(event) => updateWidget({ minimumAmountCents: Math.max(0, Math.round(Number(event.target.value) * 100)) })} /></label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={widget.enableMonthlyGiving} onChange={(event) => updateWidget({ enableMonthlyGiving: event.target.checked })} className="size-4 rounded border-slate-300 text-blue-600" />Offer monthly giving</label>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Gift designations and trust</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label><FieldLabel>Default designation</FieldLabel><input className={fieldClass} value={widget.defaultDesignation} onChange={(event) => updateWidget({ defaultDesignation: event.target.value })} /></label>
                    <label><FieldLabel>Accent color</FieldLabel><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded-md border border-slate-300 bg-white p-1" value={/^#[0-9a-f]{6}$/i.test(widget.accentColor) ? widget.accentColor : "#2563eb"} onChange={(event) => updateWidget({ accentColor: event.target.value })} /><input className={fieldClass} value={widget.accentColor} onChange={(event) => updateWidget({ accentColor: event.target.value })} placeholder="#2563eb" /></div></label>
                    <label className="sm:col-span-2"><FieldLabel>Allowed designations (one per line)</FieldLabel><textarea rows={4} className={fieldClass} value={designationsText} onChange={(event) => setDesignationsText(event.target.value)} /></label>
                    <label className="sm:col-span-2"><FieldLabel>Security and trust line</FieldLabel><input className={fieldClass} value={widget.trustLine} onChange={(event) => updateWidget({ trustLine: event.target.value })} /></label>
                    <label><FieldLabel>Success message</FieldLabel><textarea rows={2} className={fieldClass} value={widget.successMessage} onChange={(event) => updateWidget({ successMessage: event.target.value })} /></label>
                    <label><FieldLabel>Payment failure message</FieldLabel><textarea rows={2} className={fieldClass} value={widget.failureMessage} onChange={(event) => updateWidget({ failureMessage: event.target.value })} /></label>
                  </div>
                </div>
                <div className="flex justify-end"><button type="button" disabled={saving} onClick={() => void saveWidget()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save className="size-4" />{saving ? "Saving…" : "Save and publish form"}</button></div>
              </div>
            </section>
            <aside className="xl:sticky xl:top-4 xl:self-start">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live form preview</p>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
                <h3 className="text-2xl font-semibold text-slate-950">{widget.headline || "Support our mission"}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{widget.supportingCopy}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">{splitList(suggestedAmountsText).slice(0, 6).map((amount, index) => <div key={`${amount}-${index}`} className={`rounded-md border px-2 py-2 text-center text-sm font-semibold ${index === 1 ? "text-white" : "border-slate-300 text-slate-700"}`} style={index === 1 ? { backgroundColor: widget.accentColor || "#2563eb", borderColor: widget.accentColor || "#2563eb" } : undefined}>${amount}</div>)}</div>
                <div className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-400">Donor email</div>
                <div className="mt-3 rounded-md px-4 py-3 text-center text-sm font-semibold text-white" style={{ backgroundColor: widget.accentColor || "#2563eb" }}>Continue to secure payment</div>
                <p className="mt-3 text-center text-xs text-slate-500">🔒 {widget.trustLine}</p>
                <div className="mt-5 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">Payment fields appear securely from Stripe after donor details are reviewed.</div>
              </div>
            </aside>
          </div>
        ) : null}

        {tab === "install" ? (
          <div className="space-y-5">
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Two small snippets.</strong> Install the loader once on your website, then place the donation block wherever the form should appear. The public token is domain-restricted and contains no CRM credentials.</section>
            <div className="grid gap-5 xl:grid-cols-2">
              {[{ key: "loader", title: "1. Website loader", code: sitePayload?.snippets.headSnippet ?? "" }, { key: "widget", title: "2. Donation form block", code: embedSnippet }].map((item) => (
                <section key={item.key} className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{item.title}</h2><button type="button" onClick={() => void copyCode(item.key, item.code)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy className="size-4" />{copied === item.key ? "Copied" : "Copy"}</button></div>
                  <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{item.code}</code></pre>
                </section>
              ))}
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Verify before launch</h2><ol className="mt-3 space-y-2 text-sm text-slate-600"><li>1. Save the Stripe keys and webhook signing secret in Connection.</li><li>2. Add the webhook URL in Stripe and enable the two required events.</li><li>3. Save and enable the donation form for its exact website domain.</li><li>4. Make one test-mode gift and confirm it appears under Payment activity and the Donor CRM payment ledger.</li></ol></section>
          </div>
        ) : null}

        {tab === "activity" ? (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-950">Verified Stripe events</h2><p className="mt-1 text-xs text-slate-500">Webhook retries are processed once; failures remain visible for diagnosis.</p></div><Link href="/payments" className="text-sm font-semibold text-blue-700 hover:underline">Open donation ledger</Link></div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Received</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">CRM record</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.id}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.createdAt).toLocaleString()}</td><td className="px-4 py-3"><p className="font-medium text-slate-900">{event.eventType}</p><p className="font-mono text-[11px] text-slate-400">{event.externalEventId}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${event.status === "PROCESSED" ? "bg-emerald-100 text-emerald-800" : event.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{event.status}</span></td><td className="px-4 py-3">{event.donationId ? <Link className="font-medium text-blue-700 hover:underline" href={`/donations/${event.donationId}`}>Donation recorded</Link> : <span className="text-slate-400">—</span>}</td><td className="max-w-md px-4 py-3 text-xs text-red-700">{event.errorMessage ?? "—"}</td></tr>)}</tbody></table>
              {events.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No Stripe webhook events yet. Complete a test-mode donation to verify the full workflow.</div> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
