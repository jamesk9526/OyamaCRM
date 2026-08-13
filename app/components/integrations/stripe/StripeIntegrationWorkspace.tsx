"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    environments: Record<GatewayMode, {
      publishableKey: string;
      hasSecretKey: boolean;
      hasWebhookSecret: boolean;
    }>;
  };
}

interface PaymentHealthPayload {
  stripeReady: boolean;
  stripeCheckoutReady: boolean;
  stripeWebhookReady: boolean;
  stripeDelivery: {
    verified: boolean;
    latestStatus: string | null;
    latestReceivedAt: string | null;
    latestProcessedAt: string | null;
  };
  currency: string;
  issues: string[];
  webhookUrl: string;
  stripeEnvironments: Record<GatewayMode, { checkoutReady: boolean; webhookReady: boolean }>;
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
  mode: GatewayMode;
}

interface StripeSandboxCheckout {
  clientSecret: string;
  publishableKey: string;
  sessionId: string;
  amount: number;
  currency: string;
  returnOrigin: string;
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

interface DonationDomainVerification {
  ok: boolean;
  status: "ready" | "awaiting_install" | "blocked";
  domain: string;
  allowed: boolean;
  installed: boolean;
  observedDomain: string;
  lastObservedAt: string | null;
  activeWidgets: string[];
  issues: string[];
  message: string;
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

type StripeEmbeddedCheckoutInstance = { mount: (element: HTMLElement) => void; destroy: () => void };
type StripeBrowserFactory = (publishableKey: string) => { initEmbeddedCheckout: (options: { clientSecret: string }) => Promise<StripeEmbeddedCheckoutInstance> };

function SandboxCheckoutPreview({ checkout, onClose }: { checkout: StripeSandboxCheckout; onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [previewError, setPreviewError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    let instance: StripeEmbeddedCheckoutInstance | null = null;
    const handleReturn = (event: MessageEvent) => {
      if (event.origin === checkout.returnOrigin && event.data?.oyama_stripe_return === true) setCompleted(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("message", handleReturn);
    window.addEventListener("keydown", handleKeyDown);

    void (async () => {
      try {
        const stripeWindow = window as typeof window & { Stripe?: StripeBrowserFactory };
        if (!stripeWindow.Stripe) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Stripe.js could not load.")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://js.stripe.com/v3/";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Stripe.js could not load."));
            document.head.appendChild(script);
          });
        }
        if (!active || !mountRef.current || !stripeWindow.Stripe) return;
        instance = await stripeWindow.Stripe(checkout.publishableKey).initEmbeddedCheckout({ clientSecret: checkout.clientSecret });
        if (!active || !mountRef.current) {
          instance.destroy();
          return;
        }
        instance.mount(mountRef.current);
      } catch (error) {
        if (active) setPreviewError(error instanceof Error ? error.message : "Stripe sandbox checkout could not load.");
      }
    })();

    return () => {
      active = false;
      window.removeEventListener("message", handleReturn);
      window.removeEventListener("keydown", handleKeyDown);
      instance?.destroy();
    };
  }, [checkout, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="stripe-sandbox-title">
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div><h2 id="stripe-sandbox-title" className="font-semibold text-slate-950">Stripe sandbox donation test</h2><p className="mt-1 text-xs text-slate-500">Test mode · {checkout.amount.toFixed(2)} {checkout.currency} · no CRM gift will be created</p></div>
          <button type="button" autoFocus onClick={onClose} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
        {completed ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h3 className="mt-3 font-semibold text-slate-950">Sandbox payment completed</h3><p className="mt-1 text-sm text-slate-600">The test checkout succeeded. Close this preview when you are finished.</p></div> : <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-4 sm:p-6">{previewError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{previewError}</p> : <div ref={mountRef} className="min-h-80" />}</div>}
      </div>
    </div>
  );
}

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
  const [secretKeys, setSecretKeys] = useState<Record<GatewayMode, string>>({ sandbox: "", production: "" });
  const [webhookSecrets, setWebhookSecrets] = useState<Record<GatewayMode, string>>({ sandbox: "", production: "" });
  const [testingMode, setTestingMode] = useState<GatewayMode | null>(null);
  const [sandboxCheckout, setSandboxCheckout] = useState<StripeSandboxCheckout | null>(null);
  const [sandboxAmount, setSandboxAmount] = useState("10.00");
  const [suggestedAmountsText, setSuggestedAmountsText] = useState("");
  const [designationsText, setDesignationsText] = useState("");
  const [copied, setCopied] = useState("");
  const [domainToVerify, setDomainToVerify] = useState("");
  const [domainVerification, setDomainVerification] = useState<DonationDomainVerification | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [publicAppOrigin, setPublicAppOrigin] = useState("");

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
      setDomainToVerify((current) => current || selected?.primaryDomain || "");
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

  useEffect(() => {
    setPublicAppOrigin(window.location.origin);
  }, []);

  const widget = siteDraft?.widgets.donation_widget ?? null;
  const embedSnippet = sitePayload?.snippets.embedBlocks.donation_widget ?? "";
  const hostedGivingUrl = siteDraft && publicAppOrigin ? `${publicAppOrigin}/give/${encodeURIComponent(siteDraft.embedToken)}` : "";
  const embedVariants = siteDraft ? [
    { key: "standard", title: "Standard giving form", description: "Balanced card for most donation pages.", code: '<div data-oyama-embed="donation-widget"></div>' },
    { key: "compact", title: "Compact sidebar form", description: "Narrow layout for sidebars and campaign pages.", code: '<div data-oyama-embed="donation-widget" data-oyama-style="minimal" data-oyama-width="compact"></div>' },
    { key: "spotlight", title: "Campaign spotlight", description: "Wide, higher-emphasis treatment for landing pages.", code: '<div data-oyama-embed="donation-widget" data-oyama-style="bold" data-oyama-width="wide"></div>' },
    { key: "warm", title: "Warm community form", description: "Soft treatment for care, faith, and community programs.", code: '<div data-oyama-embed="donation-widget" data-oyama-style="warm" data-oyama-width="standard"></div>' },
  ] : [];
  const readiness = useMemo(() => [
    { label: "Stripe credentials", ready: Boolean(health?.stripeCheckoutReady), detail: "Publishable and secret keys match the selected mode." },
    { label: "Verified webhook", ready: Boolean(health?.stripeWebhookReady), detail: "Signed events can create CRM donation records." },
    { label: "Donation form", ready: Boolean(widget?.enabled), detail: "The public form is enabled for hosted or embedded checkout." },
    { label: "Public delivery", ready: Boolean(siteDraft?.active && (widget?.hostedPageEnabled || siteDraft.primaryDomain || siteDraft.allowedDomains.length)), detail: "A hosted CRM link is published or an approved embed domain is configured." },
  ], [health, siteDraft, widget]);

  function updateStripe(patch: Partial<PaymentSettingsPayload["stripe"]>) {
    setSettings((current) => current ? { ...current, stripe: { ...current.stripe, ...patch } } : current);
  }

  function updateStripeEnvironment(mode: GatewayMode, patch: Partial<PaymentSettingsPayload["stripe"]["environments"][GatewayMode]>) {
    setSettings((current) => current ? {
      ...current,
      stripe: {
        ...current.stripe,
        environments: {
          ...current.stripe.environments,
          [mode]: { ...current.stripe.environments[mode], ...patch },
        },
      },
    } : current);
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
            environments: {
              sandbox: {
                publishableKey: settings.stripe.environments.sandbox.publishableKey,
                secretKey: secretKeys.sandbox,
                webhookSecret: webhookSecrets.sandbox,
              },
              production: {
                publishableKey: settings.stripe.environments.production.publishableKey,
                secretKey: secretKeys.production,
                webhookSecret: webhookSecrets.production,
              },
            },
          },
        }),
      });
      setSettings(updated);
      setSecretKeys({ sandbox: "", production: "" });
      setWebhookSecrets({ sandbox: "", production: "" });
      const nextHealth = await apiFetch<PaymentHealthPayload>("/api/payments/health");
      setHealth(nextHealth);
      setMessage({ tone: "success", text: "Stripe connection settings saved securely." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe settings could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function saveWidget(showSuccess = true): Promise<boolean> {
    if (!siteDraft || !settings) return false;
    setSaving(true);
    setMessage(null);
    try {
      const allowedDesignations = splitList(designationsText);
      if (siteDraft.widgets.donation_widget.defaultDesignation && !allowedDesignations.some((item) => item.toLowerCase() === siteDraft.widgets.donation_widget.defaultDesignation.toLowerCase())) {
        allowedDesignations.unshift(siteDraft.widgets.donation_widget.defaultDesignation);
      }
      if (siteDraft.widgets.donation_widget.maximumAmountCents < siteDraft.widgets.donation_widget.minimumAmountCents) {
        throw new Error("Maximum gift must be greater than or equal to the minimum gift.");
      }
      const suggestedAmounts = splitList(suggestedAmountsText).map(Number).filter((amount) => {
        const cents = Math.round(amount * 100);
        return Number.isFinite(amount) && cents >= siteDraft.widgets.donation_widget.minimumAmountCents && cents <= siteDraft.widgets.donation_widget.maximumAmountCents;
      }).slice(0, 8);
      if (!siteDraft.widgets.donation_widget.allowCustomAmount && suggestedAmounts.length === 0) {
        throw new Error("Add at least one suggested amount when the “Other” amount option is disabled.");
      }
      const nextWidget: DonationWidgetSettings = {
        ...siteDraft.widgets.donation_widget,
        stripeTestMode: settings.stripe.mode === "sandbox",
        suggestedAmounts,
        allowedDesignations,
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
      if (showSuccess) setMessage({ tone: "success", text: "Donation form saved. Your installed code stays the same." });
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Donation form could not be saved." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function verifyDonationDomain() {
    if (!siteDraft) return;
    setVerifyingDomain(true);
    setDomainVerification(null);
    const domain = domainToVerify.trim() || siteDraft.primaryDomain;
    try {
      const saved = await saveWidget(false);
      if (!saved) return;
      const result = await apiFetch<DonationDomainVerification>("/api/site-embeds/test-donation-domain", {
        method: "POST",
        body: JSON.stringify({ siteId: siteDraft.id, domain }),
      });
      setDomainVerification(result);
      setMessage({ tone: result.ok ? "success" : "error", text: result.message });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Donation domain could not be verified." });
    } finally {
      setVerifyingDomain(false);
    }
  }

  async function testConnection(mode: GatewayMode) {
    setTesting(true);
    setTestingMode(mode);
    setMessage(null);
    try {
      const result = await apiFetch<StripeConnectionResult>("/api/payments/stripe/test", { method: "POST", body: JSON.stringify({ mode }) });
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
      setTestingMode(null);
    }
  }

  async function openSandboxCheckout() {
    const amount = Number(sandboxAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      setMessage({ tone: "error", text: "Enter a sandbox test amount of at least 1.00." });
      return;
    }
    setTesting(true);
    setTestingMode("sandbox");
    setMessage(null);
    try {
      const preview = await apiFetch<StripeSandboxCheckout>("/api/payments/stripe/sandbox-checkout", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setSandboxCheckout(preview);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe sandbox form could not be opened." });
    } finally {
      setTesting(false);
      setTestingMode(null);
    }
  }

  async function disconnectStripe() {
    if (!settings || !window.confirm("Disconnect Stripe? New donation checkouts will stop immediately. Existing CRM donations are not changed.")) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch<PaymentSettingsPayload>("/api/payments/settings", {
        method: "PUT",
        body: JSON.stringify({
          currency: settings.currency,
          stripe: {
            enabled: false,
            mode: settings.stripe.mode,
            clearAllCredentials: true,
          },
        }),
      });
      setSettings(updated);
      setSecretKeys({ sandbox: "", production: "" });
      setWebhookSecrets({ sandbox: "", production: "" });
      setConnectionResult(null);
      setHealth(await apiFetch<PaymentHealthPayload>("/api/payments/health"));
      setMessage({ tone: "success", text: "Stripe disconnected. Existing payment and donation records were preserved." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Stripe could not be disconnected." });
    } finally {
      setSaving(false);
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
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(Boolean(health?.stripeReady && health?.stripeDelivery?.verified))}`}>
                  {health?.stripeReady && health?.stripeDelivery?.verified ? "Delivery verified" : health?.stripeReady ? "Configured — verify delivery" : "Setup required"}
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
        {health?.stripeReady && !health.stripeDelivery?.verified ? (
          <div className="mb-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Stripe credentials are saved, but Donor CRM has not received a verified webhook yet. Complete a donation through the published form, then check the Stripe event delivery and retry it if needed.</p>
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
                  <label><FieldLabel>Active donation environment</FieldLabel><select className={fieldClass} value={settings.stripe.mode} onChange={(event) => updateStripe({ mode: event.target.value === "production" ? "production" : "sandbox" })}><option value="sandbox">Test mode · no real charges</option><option value="production">Live mode · real donations</option></select></label>
                  <label><FieldLabel>Currency</FieldLabel><input className={fieldClass} maxLength={3} value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })} /></label>
                </div>
                <div className="grid gap-4 2xl:grid-cols-2">
                  {(["sandbox", "production"] as const).map((mode) => {
                    const environment = settings.stripe.environments[mode];
                    const environmentHealth = health?.stripeEnvironments?.[mode];
                    const isLive = mode === "production";
                    return <section key={mode} className={`rounded-lg border p-4 ${isLive ? "border-amber-200 bg-amber-50/40" : "border-blue-200 bg-blue-50/40"}`}>
                      <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-950">{isLive ? "Live credentials" : "Test credentials"}</h3><p className="mt-1 text-xs text-slate-500">{isLive ? "Used only when Live mode is active." : "Safe sandbox data; no real card charges."}</p></div><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(Boolean(environmentHealth?.webhookReady))}`}>{environmentHealth?.webhookReady ? "Ready" : environmentHealth?.checkoutReady ? "Webhook needed" : "Keys needed"}</span></div>
                      <div className="mt-4 space-y-3">
                        <label><FieldLabel>Publishable key</FieldLabel><input className={`${fieldClass} font-mono`} value={environment.publishableKey} onChange={(event) => updateStripeEnvironment(mode, { publishableKey: event.target.value.trim() })} placeholder={isLive ? "pk_live_…" : "pk_test_…"} /></label>
                        <label><FieldLabel>Secret or restricted key {environment.hasSecretKey ? <span className="font-normal text-emerald-700">· stored</span> : null}</FieldLabel><input type="password" className={`${fieldClass} font-mono`} value={secretKeys[mode]} onChange={(event) => setSecretKeys((current) => ({ ...current, [mode]: event.target.value }))} placeholder={environment.hasSecretKey ? "Leave blank to keep saved key" : isLive ? "sk_live_… or rk_live_…" : "sk_test_… or rk_test_…"} /></label>
                        <label><FieldLabel>Webhook signing secret {environment.hasWebhookSecret ? <span className="font-normal text-emerald-700">· stored</span> : null}</FieldLabel><input type="password" className={`${fieldClass} font-mono`} value={webhookSecrets[mode]} onChange={(event) => setWebhookSecrets((current) => ({ ...current, [mode]: event.target.value }))} placeholder={environment.hasWebhookSecret ? "Leave blank to keep saved secret" : "whsec_…"} /></label>
                        <button type="button" disabled={testing || !environment.hasSecretKey} onClick={() => void testConnection(mode)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><PlugZap className="size-3.5" />{testingMode === mode ? "Testing…" : `Test ${isLive ? "live" : "sandbox"} connection`}</button>
                      </div>
                    </section>;
                  })}
                </div>
                <section className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                  <div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-sm font-semibold text-violet-950">Test the donation form in Stripe Sandbox</h3><p className="mt-1 max-w-xl text-xs leading-5 text-violet-800">Opens a real Stripe Embedded Checkout using the saved test keys. Use a Stripe test card; the payment cannot charge a real card and will not create a CRM donation.</p></div><div className="flex flex-wrap items-end gap-2"><label className="w-32"><FieldLabel>Test amount</FieldLabel><input type="number" min="1" step="0.01" className={fieldClass} value={sandboxAmount} onChange={(event) => setSandboxAmount(event.target.value)} /></label><button type="button" disabled={testing || !health?.stripeEnvironments?.sandbox.checkoutReady} onClick={() => void openSandboxCheckout()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><CreditCard className="size-4" />{testingMode === "sandbox" ? "Opening…" : "Open sandbox form"}</button></div></div>
                </section>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button type="button" disabled={saving || !(["sandbox", "production"] as const).some((mode) => settings.stripe.environments[mode].hasSecretKey || settings.stripe.environments[mode].publishableKey)} onClick={() => void disconnectStripe()} className="min-h-10 rounded-md px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">Disconnect all Stripe keys</button>
                  <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={saving} onClick={() => void saveConnection()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save className="size-4" />{saving ? "Saving…" : "Save connection"}</button>
                  </div>
                </div>
              </div>
            </section>
            <aside className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-950">Webhook endpoint</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Add this endpoint in Stripe Workbench and subscribe to <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>, <code>checkout.session.async_payment_failed</code>, <code>invoice.paid</code>, and <code>invoice.payment_failed</code>.</p>
                <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-950 p-2.5 text-white"><code className="min-w-0 flex-1 break-all text-[11px]">{health?.webhookUrl}</code><button type="button" onClick={() => void copyCode("webhook", health?.webhookUrl ?? "")} className="shrink-0 rounded p-1 hover:bg-slate-800"><Copy className="size-4" /></button></div>
                {copied === "webhook" ? <p className="mt-2 text-xs text-emerald-700">Copied.</p> : null}
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-950">Set up Stripe test keys</h3>
                <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                  <li><strong className="text-slate-800">1.</strong> In Stripe, open a Sandbox (or turn on test mode), then open Developers → API keys.</li>
                  <li><strong className="text-slate-800">2.</strong> Copy the <code>pk_test_…</code> publishable key and reveal the <code>sk_test_…</code> secret key. A least-privilege <code>rk_test_…</code> restricted key is also supported when it can create Checkout Sessions and read account details. Never paste a server key into website code.</li>
                  <li><strong className="text-slate-800">3.</strong> In Workbench → Webhooks, create a destination for the endpoint above, select the five listed events, then reveal its separate <code>whsec_…</code> signing secret.</li>
                  <li><strong className="text-slate-800">4.</strong> Save both credential panels, test the sandbox connection, then open the sandbox form with Stripe test card <code>4242 4242 4242 4242</code>, any future date, and any CVC.</li>
                  <li><strong className="text-slate-800">5.</strong> Separately publish the public form in Test mode and confirm its event is Processed and its gift reaches the ledger. Then activate Live mode only after testing the saved live connection and live webhook destination.</li>
                </ol>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-blue-700">
                  <a href="https://docs.stripe.com/keys" target="_blank" rel="noopener noreferrer" className="hover:underline">Stripe API key guide ↗</a>
                  <a href="https://docs.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="hover:underline">Stripe webhook guide ↗</a>
                  <a href="https://docs.stripe.com/testing" target="_blank" rel="noopener noreferrer" className="hover:underline">Test cards ↗</a>
                </div>
              </section>
              {connectionResult ? <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">{connectionResult.displayName || connectionResult.accountId}</p><p className="mt-1 text-xs">{connectionResult.mode === "sandbox" ? "Test" : "Live"} connection · Charges {connectionResult.chargesEnabled ? "enabled" : "disabled"} · Payouts {connectionResult.payoutsEnabled ? "enabled" : "disabled"} · {connectionResult.country}</p></section> : null}
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
                    <label><FieldLabel>Primary domain</FieldLabel><input className={fieldClass} value={siteDraft.primaryDomain} onChange={(event) => { setSiteDraft({ ...siteDraft, primaryDomain: event.target.value }); setDomainToVerify(event.target.value); setDomainVerification(null); }} placeholder="give.example.org" /><span className="mt-1 block text-xs leading-5 text-slate-500">Enter only the hostname. A pasted URL is normalized when saved.</span></label>
                    <label className="sm:col-span-2"><FieldLabel>Additional allowed domains (one per line)</FieldLabel><textarea rows={3} className={fieldClass} value={siteDraft.allowedDomains.join("\n")} onChange={(event) => { setSiteDraft({ ...siteDraft, allowedDomains: splitList(event.target.value) }); setDomainVerification(null); }} placeholder={"www.example.org\n*.campaigns.example.org"} /><span className="mt-1 block text-xs leading-5 text-slate-500">Use exact hosts or a scoped wildcard. For donor safety, unrestricted <code>*</code> is rejected.</span></label>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={siteDraft.active} onChange={(event) => setSiteDraft({ ...siteDraft, active: event.target.checked })} className="size-4 rounded border-slate-300 text-blue-600" />Publish giving forms for this connection</label>
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-blue-950">OyamaCRM-hosted giving page</h4><p className="mt-1 max-w-xl text-xs leading-5 text-blue-800">Share a direct public checkout link in email, social media, QR codes, or your website. It works without installing embed HTML and still uses the same verified Stripe-to-CRM workflow.</p></div><label className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900"><input type="checkbox" checked={widget.hostedPageEnabled} onChange={(event) => updateWidget({ hostedPageEnabled: event.target.checked })} className="size-4 rounded border-blue-300 text-blue-600" />Publish hosted page</label></div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><FieldLabel>Hosted page eyebrow</FieldLabel><input className={fieldClass} maxLength={80} value={widget.hostedPageEyebrow} onChange={(event) => updateWidget({ hostedPageEyebrow: event.target.value })} /></label><label><FieldLabel>Hosted page support footer</FieldLabel><textarea rows={2} className={fieldClass} maxLength={240} value={widget.hostedPageFooter} onChange={(event) => updateWidget({ hostedPageFooter: event.target.value })} /></label><label className="sm:col-span-2"><FieldLabel>After payment, redirect to</FieldLabel><input type="url" className={fieldClass} value={widget.checkoutReturnUrl} onChange={(event) => updateWidget({ checkoutReturnUrl: event.target.value })} placeholder="https://www.example.org/thank-you" /><span className="mt-1 block text-xs leading-5 text-slate-500">Optional HTTPS link. After Stripe confirms checkout, donors return here instead of the built-in thank-you message.</span></label></div>
                    {hostedGivingUrl ? <div className="mt-4 flex flex-col gap-2 rounded-md border border-blue-200 bg-white p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs text-slate-700">{hostedGivingUrl}</code><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void copyCode("hosted-url", hostedGivingUrl)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Copy className="size-3.5" />{copied === "hosted-url" ? "Copied" : "Copy link"}</button>{widget.hostedPageEnabled ? <a href={hostedGivingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><ExternalLink className="size-3.5" />Open page</a> : null}</div></div> : null}
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="min-w-0 flex-1"><FieldLabel>Domain to verify</FieldLabel><input className={fieldClass} value={domainToVerify} onChange={(event) => { setDomainToVerify(event.target.value); setDomainVerification(null); }} placeholder="give.example.org" /></label>
                      <button type="button" disabled={saving || verifyingDomain} onClick={() => void verifyDonationDomain()} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-blue-600 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`size-4 ${verifyingDomain ? "animate-spin" : ""}`} />{verifyingDomain ? "Verifying…" : "Save and verify domain"}</button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Only required for embedded forms. Verification checks the saved allow-list and a recent loader check-in from the real website. Hosted CRM links do not require an external-domain installation.</p>
                    {domainVerification ? <div className={`mt-3 rounded-md border p-3 text-sm ${domainVerification.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : domainVerification.allowed ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"}`}><div className="flex items-start gap-2">{domainVerification.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}<div className="min-w-0"><p className="font-semibold">{domainVerification.domain || "Domain"}: {domainVerification.ok ? "verified" : domainVerification.allowed ? "allowed, install not observed" : "blocked"}</p><p className="mt-1 text-xs leading-5">Allow-list {domainVerification.allowed ? "passed" : "failed"} · Donation loader {domainVerification.installed ? "detected" : "not detected recently"}{domainVerification.lastObservedAt ? ` · Last check-in ${new Date(domainVerification.lastObservedAt).toLocaleString()}` : ""}</p>{domainVerification.issues.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">{domainVerification.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</div></div></div> : null}
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
                      <label><FieldLabel>Maximum gift (dollars)</FieldLabel><input type="number" min="1" max="1000000" step="0.01" className={fieldClass} value={(widget.maximumAmountCents / 100).toString()} onChange={(event) => updateWidget({ maximumAmountCents: Math.min(100000000, Math.max(widget.minimumAmountCents, Math.round(Number(event.target.value) * 100))) })} /></label>
                      <label><FieldLabel>“Other” amount label</FieldLabel><input className={fieldClass} maxLength={40} disabled={!widget.allowCustomAmount} value={widget.customAmountLabel} onChange={(event) => updateWidget({ customAmountLabel: event.target.value })} placeholder="Other" /></label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={widget.allowCustomAmount} onChange={(event) => updateWidget({ allowCustomAmount: event.target.checked })} className="size-4 rounded border-slate-300 text-blue-600" />Offer an “Other” amount</label>
                      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={widget.enableMonthlyGiving} onChange={(event) => updateWidget({ enableMonthlyGiving: event.target.checked, defaultGiftType: event.target.checked ? widget.defaultGiftType : "one-time" })} className="size-4 rounded border-slate-300 text-blue-600" />Offer monthly giving</label>
                    </div>
                    <label><FieldLabel>Initially selected gift type</FieldLabel><select className={fieldClass} value={widget.defaultGiftType} onChange={(event) => updateWidget({ defaultGiftType: event.target.value === "monthly" ? "monthly" : "one-time" })}><option value="one-time">One-time gift</option>{widget.enableMonthlyGiving ? <option value="monthly">Monthly gift</option> : null}</select></label>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Form style and donor details</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label><FieldLabel>Style preset</FieldLabel><select className={fieldClass} value={widget.stylePreset} onChange={(event) => updateWidget({ stylePreset: event.target.value as DonationWidgetSettings["stylePreset"] })}><option value="classic">Classic</option><option value="warm">Warm community</option><option value="minimal">Minimal</option><option value="bold">Bold campaign</option></select></label>
                    <label><FieldLabel>Form width</FieldLabel><select className={fieldClass} value={widget.formWidth} onChange={(event) => updateWidget({ formWidth: event.target.value as DonationWidgetSettings["formWidth"] })}><option value="compact">Compact · 440 px</option><option value="standard">Standard · 560 px</option><option value="wide">Wide · 760 px</option></select></label>
                    <label className="sm:col-span-2"><FieldLabel>Checkout button label</FieldLabel><input className={fieldClass} maxLength={80} value={widget.buttonLabel} onChange={(event) => updateWidget({ buttonLabel: event.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={widget.requireDonorName} onChange={(event) => updateWidget({ requireDonorName: event.target.checked })} className="size-4 rounded border-slate-300 text-blue-600" />Require donor name</label>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={widget.collectPhone} onChange={(event) => updateWidget({ collectPhone: event.target.checked })} className="size-4 rounded border-slate-300 text-blue-600" />Offer optional phone field</label>
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
              <div className={`p-6 ${widget.stylePreset === "minimal" ? "bg-transparent" : widget.stylePreset === "warm" ? "rounded-xl border border-amber-200 bg-amber-50" : widget.stylePreset === "bold" ? "rounded-xl border border-slate-200 border-t-[7px] bg-white shadow-xl" : "rounded-xl border border-slate-200 bg-white shadow-lg"}`} style={widget.stylePreset === "bold" ? { borderTopColor: widget.accentColor || "#2563eb" } : undefined}>
                <h3 className="text-2xl font-semibold text-slate-950">{widget.headline || "Support our mission"}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{widget.supportingCopy}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">{splitList(suggestedAmountsText).slice(0, 5).map((amount, index) => <div key={`${amount}-${index}`} className={`rounded-md border px-2 py-2 text-center text-sm font-semibold ${index === 1 ? "text-white" : "border-slate-300 text-slate-700"}`} style={index === 1 ? { backgroundColor: widget.accentColor || "#2563eb", borderColor: widget.accentColor || "#2563eb" } : undefined}>${amount}</div>)}{widget.allowCustomAmount ? <div className="rounded-md border border-slate-300 px-2 py-2 text-center text-sm font-semibold text-slate-700">{widget.customAmountLabel || "Other"}</div> : null}</div>
                <div className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-400">Donor email</div>
                <div className="mt-3 rounded-md px-4 py-3 text-center text-sm font-semibold text-white" style={{ backgroundColor: widget.accentColor || "#2563eb" }}>{widget.buttonLabel || "Continue to secure payment"}</div>
                <p className="mt-3 text-center text-xs text-slate-500">🔒 {widget.trustLine}</p>
                <div className="mt-5 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">Payment fields appear securely from Stripe after donor details are reviewed.</div>
              </div>
            </aside>
          </div>
        ) : null}

        {tab === "install" ? (
          <div className="space-y-5">
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Choose hosted or embedded delivery.</strong> Share the OyamaCRM public link with no website code, or install the loader once and add a form block where it belongs. The token and installed code stay stable when you save form changes; only an explicit token rotation replaces them.</section>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">Public OyamaCRM giving link</h2><p className="mt-1 text-xs leading-5 text-slate-500">Best for email buttons, social posts, text messages, printed QR codes, and organizations without a website editor.</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${widget?.hostedPageEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{widget?.hostedPageEnabled ? "Published" : "Not published"}</span></div>
              <div className="mt-4 flex flex-col gap-2 rounded-md bg-slate-50 p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs text-slate-700">{hostedGivingUrl || "Save the form to generate the public URL."}</code><div className="flex shrink-0 gap-2"><button type="button" disabled={!hostedGivingUrl} onClick={() => void copyCode("install-hosted-url", hostedGivingUrl)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Copy className="size-3.5" />{copied === "install-hosted-url" ? "Copied" : "Copy link"}</button>{widget?.hostedPageEnabled && hostedGivingUrl ? <a href={hostedGivingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><ExternalLink className="size-3.5" />Open</a> : null}</div></div>
            </section>
            <div className="grid gap-5 xl:grid-cols-2">
              {[{ key: "loader", title: "1. Website loader", code: sitePayload?.snippets.headSnippet ?? "" }, { key: "widget", title: "2. Donation form block", code: embedSnippet }].map((item) => (
                <section key={item.key} className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{item.title}</h2><button type="button" onClick={() => void copyCode(item.key, item.code)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy className="size-4" />{copied === item.key ? "Copied" : "Copy"}</button></div>
                  <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{item.code}</code></pre>
                </section>
              ))}
            </div>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">The loader can be requested from any website origin. For donor safety, a live embedded payment form still runs only on domains you approve in <strong>Donation form</strong>. Use the hosted giving link when you need a payment page without an approved website domain.</p>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div><h2 className="font-semibold text-slate-950">Embeddable giving library</h2><p className="mt-1 text-xs text-slate-500">Use any variant after installing the loader once. Each inherits the saved content and payment rules while selecting a presentation suited to its placement.</p></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {embedVariants.map((variant) => <div key={variant.key} className="rounded-md border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{variant.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{variant.description}</p></div><button type="button" onClick={() => void copyCode(`variant-${variant.key}`, variant.code)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Copy className="size-3.5" />{copied === `variant-${variant.key}` ? "Copied" : "Copy"}</button></div><code className="mt-3 block overflow-x-auto rounded bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{variant.code}</code></div>)}
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Verify before launch</h2><ol className="mt-3 space-y-2 text-sm text-slate-600"><li>1. Save test keys and the test webhook signing secret in Connection.</li><li>2. Add the webhook URL in Stripe and enable all five listed payment events.</li><li>3. Add the exact public hostname in Donation form, install both snippets, and open that page once.</li><li>4. Use Save and verify domain. Do not launch until the allow-list passes and the donation loader is detected from that hostname.</li><li>5. Complete one test-mode one-time gift and one monthly gift.</li><li>6. Confirm both appear under Payment activity and in the Donor CRM payment ledger, then repeat with separate live keys and a live webhook.</li></ol></section>
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
      {sandboxCheckout ? <SandboxCheckoutPreview checkout={sandboxCheckout} onClose={() => setSandboxCheckout(null)} /> : null}
    </div>
  );
}
