/** IntegrationsSettingsPage renders live readiness for finance, messaging, website embed, and AI integrations. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";
import type { SiteEmbedsConfigPayload } from "@/app/components/settings/site-embeds/site-embed-types";
import { apiFetch } from "@/app/lib/auth-client";
import type { FeatureStatus } from "@/app/lib/system-status";

interface QuickBooksStatusPayload {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  realmId: string | null;
  environment: string;
}

interface StewardAiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
  hasApiKey: boolean;
}

interface SettingsPayload {
  smtpHost?: string;
  smtpFromEmail?: string;
}

interface IntegrationCard {
  key: string;
  title: string;
  status: FeatureStatus;
  summary: string;
  detail: string;
  href: string;
  hrefLabel: string;
}

/** Returns a compact message for failed API requests. */
function toErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  return "Request failed while loading integration diagnostics.";
}

/** Builds the QuickBooks readiness card from the live plugin status endpoint. */
function buildQuickBooksCard(payload: QuickBooksStatusPayload | null, error: string | null): IntegrationCard {
  if (error) {
    return {
      key: "quickbooks",
      title: "QuickBooks Online",
      status: "Broken",
      summary: "QuickBooks status could not be loaded.",
      detail: error,
      href: "/settings/integrations#plugins",
      hrefLabel: "Open Plugins",
    };
  }

  if (!payload?.configured) {
    return {
      key: "quickbooks",
      title: "QuickBooks Online",
      status: "Not Implemented",
      summary: "Plugin runtime credentials are missing.",
      detail: "Set QB_CLIENT_ID and QB_CLIENT_SECRET to enable OAuth setup.",
      href: "/settings/integrations#plugins",
      hrefLabel: "Open Plugins",
    };
  }

  if (!payload.enabled) {
    return {
      key: "quickbooks",
      title: "QuickBooks Online",
      status: "Partially Working",
      summary: "Integration is available but currently disabled for this organization.",
      detail: `Environment: ${payload.environment}. Enable plugin access before staff can queue donation syncs.`,
      href: "/settings/integrations#plugins",
      hrefLabel: "Enable QuickBooks",
    };
  }

  if (!payload.connected) {
    return {
      key: "quickbooks",
      title: "QuickBooks Online",
      status: "Partially Working",
      summary: "Plugin is enabled but OAuth is not connected.",
      detail: `Environment: ${payload.environment}. Connect an Intuit realm to unlock manual queue syncing.`,
      href: "/settings/integrations#plugins",
      hrefLabel: "Connect QuickBooks",
    };
  }

  return {
    key: "quickbooks",
    title: "QuickBooks Online",
    status: "Working",
    summary: "Manual donation sync queue is available and connected.",
    detail: `Environment: ${payload.environment}. Realm ID: ${payload.realmId ?? "available"}.`,
    href: "/quickbooks-sync",
    hrefLabel: "Open Sync Queue",
  };
}

/** Builds the Site Embeds card from live website connection settings. */
function buildSiteEmbedsCard(payload: SiteEmbedsConfigPayload | null, error: string | null): IntegrationCard {
  if (error) {
    return {
      key: "site-embeds",
      title: "Website Embeds",
      status: "Broken",
      summary: "Site embed configuration could not be loaded.",
      detail: error,
      href: "/settings/site-embeds",
      hrefLabel: "Open Site Embeds",
    };
  }

  const sites = payload?.sites ?? [];
  const activeSites = sites.filter((site) => site.active).length;
  const configuredSites = sites.filter((site) => site.primaryDomain.trim().length > 0).length;
  const selected = sites.find((site) => site.id === payload?.selectedSiteId) ?? sites[0] ?? null;

  const enabledWidgetCount = selected
    ? Object.values(selected.widgets).filter((widget) => widget.enabled).length
    : 0;

  const implementedRegistryCount = (payload?.registry ?? []).filter((entry) => entry.implemented).length;

  if (sites.length === 0) {
    return {
      key: "site-embeds",
      title: "Website Embeds",
      status: "Not Implemented",
      summary: "No public site connection has been created yet.",
      detail: "Create your first site connection and generated snippets to activate public widgets.",
      href: "/settings/site-embeds",
      hrefLabel: "Create Site Connection",
    };
  }

  if (activeSites > 0 && configuredSites > 0 && enabledWidgetCount > 0) {
    return {
      key: "site-embeds",
      title: "Website Embeds",
      status: "Working",
      summary: "At least one active public site has widget delivery configured.",
      detail: `${activeSites} active site(s), ${configuredSites} domain-configured site(s), ${enabledWidgetCount} enabled widget(s), ${implementedRegistryCount} registry entries.`,
      href: "/settings/site-embeds",
      hrefLabel: "Manage Site Embeds",
    };
  }

  return {
    key: "site-embeds",
    title: "Website Embeds",
    status: "Partially Working",
    summary: "Site embed tooling is live, but installation setup is incomplete.",
    detail: `${activeSites} active site(s), ${configuredSites} domain-configured site(s). Add primary domains and publish snippets to finish setup.`,
    href: "/settings/site-embeds",
    hrefLabel: "Complete Setup",
  };
}

/** Builds the AI runtime card from Steward AI settings API state. */
function buildStewardAiCard(payload: StewardAiConfigPayload | null, error: string | null): IntegrationCard {
  if (error) {
    return {
      key: "steward-ai",
      title: "Steward AI Runtime",
      status: "Broken",
      summary: "Steward AI configuration could not be loaded.",
      detail: error,
      href: "/settings/ai",
      hrefLabel: "Open AI Settings",
    };
  }

  if (!payload) {
    return {
      key: "steward-ai",
      title: "Steward AI Runtime",
      status: "Not Implemented",
      summary: "AI runtime configuration has not been initialized.",
      detail: "Open AI Settings to configure local or remote Ollama mode.",
      href: "/settings/ai",
      hrefLabel: "Configure AI",
    };
  }

  if (!payload.enabled) {
    return {
      key: "steward-ai",
      title: "Steward AI Runtime",
      status: "Partially Working",
      summary: "AI runtime controls are implemented but currently disabled.",
      detail: `Configured mode: ${payload.mode}. Model: ${payload.model}. Enable AI in settings to activate chat workflows.`,
      href: "/settings/ai",
      hrefLabel: "Enable AI",
    };
  }

  if (payload.mode === "remote" && !payload.hasApiKey) {
    return {
      key: "steward-ai",
      title: "Steward AI Runtime",
      status: "Partially Working",
      summary: "Remote mode is enabled without an API key.",
      detail: `Endpoint: ${payload.endpointUrl || "not set"}. Add credentials to harden production usage.`,
      href: "/settings/ai",
      hrefLabel: "Review AI Credentials",
    };
  }

  return {
    key: "steward-ai",
    title: "Steward AI Runtime",
    status: "Partially Working",
    summary: "Runtime settings are configured and enabled.",
    detail: `Mode: ${payload.mode}. Model: ${payload.model}. Use the AI settings page test action before production cutover.`,
    href: "/settings/ai",
    hrefLabel: "Open AI Settings",
  };
}

/** Builds the SMTP email integration card from organization settings. */
function buildSmtpCard(payload: SettingsPayload | null, error: string | null): IntegrationCard {
  if (error) {
    return {
      key: "smtp",
      title: "SMTP Email Delivery",
      status: "Broken",
      summary: "Organization SMTP settings could not be loaded.",
      detail: error,
      href: "/settings/organization",
      hrefLabel: "Open Organization Settings",
    };
  }

  const host = payload?.smtpHost?.trim() ?? "";
  const fromEmail = payload?.smtpFromEmail?.trim() ?? "";

  if (host && fromEmail) {
    return {
      key: "smtp",
      title: "SMTP Email Delivery",
      status: "Working",
      summary: "SMTP host and sender identity are configured.",
      detail: `Host: ${host}. From: ${fromEmail}.`,
      href: "/settings/organization",
      hrefLabel: "Review SMTP Settings",
    };
  }

  return {
    key: "smtp",
    title: "SMTP Email Delivery",
    status: "Partially Working",
    summary: "Email campaign features are present but SMTP setup is incomplete.",
    detail: "Set SMTP host and from-email values in settings to support delivery workflows.",
    href: "/settings/organization",
    hrefLabel: "Configure SMTP",
  };
}

/** IntegrationsSettingsPage shows live, audit-friendly integration readiness and quick links to each setup flow. */
export default function IntegrationsSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const [quickBooksPayload, setQuickBooksPayload] = useState<QuickBooksStatusPayload | null>(null);
  const [siteEmbedsPayload, setSiteEmbedsPayload] = useState<SiteEmbedsConfigPayload | null>(null);
  const [stewardAiPayload, setStewardAiPayload] = useState<StewardAiConfigPayload | null>(null);
  const [settingsPayload, setSettingsPayload] = useState<SettingsPayload | null>(null);

  const [quickBooksError, setQuickBooksError] = useState<string | null>(null);
  const [siteEmbedsError, setSiteEmbedsError] = useState<string | null>(null);
  const [stewardAiError, setStewardAiError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadIntegrationState() {
      setLoading(true);

      const [quickBooksResult, siteEmbedsResult, stewardAiResult, settingsResult] = await Promise.allSettled([
        apiFetch<QuickBooksStatusPayload>("/api/quickbooks/status"),
        apiFetch<SiteEmbedsConfigPayload>("/api/site-embeds/config"),
        apiFetch<StewardAiConfigPayload>("/api/steward-ai/config"),
        apiFetch<SettingsPayload>("/api/settings"),
      ]);

      if (!active) return;

      if (quickBooksResult.status === "fulfilled") {
        setQuickBooksPayload(quickBooksResult.value);
        setQuickBooksError(null);
      } else {
        setQuickBooksPayload(null);
        setQuickBooksError(toErrorMessage(quickBooksResult.reason));
      }

      if (siteEmbedsResult.status === "fulfilled") {
        setSiteEmbedsPayload(siteEmbedsResult.value);
        setSiteEmbedsError(null);
      } else {
        setSiteEmbedsPayload(null);
        setSiteEmbedsError(toErrorMessage(siteEmbedsResult.reason));
      }

      if (stewardAiResult.status === "fulfilled") {
        setStewardAiPayload(stewardAiResult.value);
        setStewardAiError(null);
      } else {
        setStewardAiPayload(null);
        setStewardAiError(toErrorMessage(stewardAiResult.reason));
      }

      if (settingsResult.status === "fulfilled") {
        setSettingsPayload(settingsResult.value);
        setSettingsError(null);
      } else {
        setSettingsPayload(null);
        setSettingsError(toErrorMessage(settingsResult.reason));
      }

      setLastCheckedAt(new Date().toISOString());
      setLoading(false);
    }

    const timer = window.setTimeout(() => {
      void loadIntegrationState();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const cards = useMemo<IntegrationCard[]>(
    () => [
      buildQuickBooksCard(quickBooksPayload, quickBooksError),
      buildSiteEmbedsCard(siteEmbedsPayload, siteEmbedsError),
      buildStewardAiCard(stewardAiPayload, stewardAiError),
      buildSmtpCard(settingsPayload, settingsError),
      {
        key: "payments",
        title: "Payments and Webhooks",
        status: "Not Implemented",
        summary: "Provider-level payment/webhook integrations are still pending implementation.",
        detail: "No Stripe/ACH webhook provider is currently wired in the integrations workspace.",
        href: "/payments",
        hrefLabel: "Open Payments Workspace",
      },
    ],
    [
      quickBooksPayload,
      quickBooksError,
      siteEmbedsPayload,
      siteEmbedsError,
      stewardAiPayload,
      stewardAiError,
      settingsPayload,
      settingsError,
    ]
  );

  const workingCount = cards.filter((card) => card.status === "Working").length;
  const partialCount = cards.filter((card) => card.status === "Partially Working").length;
  const blockedCount = cards.filter((card) => card.status === "Broken" || card.status === "Not Implemented").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Live readiness for finance, public website widgets, AI runtime, and delivery providers.
            </p>
          </div>
        ) : <div />}
        <div className="text-xs text-gray-500">
          Last checked: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : "Not yet loaded"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Working</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{workingCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Partially Working</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{partialCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Blocked</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{blockedCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          Loading integration diagnostics...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <article key={card.key} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">{card.title}</h2>
                <SystemStatusBadge status={card.status} />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-800">{card.summary}</p>
              <p className="mt-1 text-sm text-gray-600">{card.detail}</p>
              <Link href={card.href} className="mt-4 inline-flex text-sm font-semibold text-green-700 hover:underline">
                {card.hrefLabel}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
