// Full DonorCRM admin workspace for configuring website embeds, snippets, diagnostics, and LiveCom rollout.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import ConnectionStatusPanel from "@/app/components/settings/site-embeds/ConnectionStatusPanel";
import EmbedRegistryPanel from "@/app/components/settings/site-embeds/EmbedRegistryPanel";
import EmbedSnippetCard from "@/app/components/settings/site-embeds/EmbedSnippetCard";
import EmbedWidgetTogglesPanel from "@/app/components/settings/site-embeds/EmbedWidgetTogglesPanel";
import InlineWidgetsSettingsPanel from "@/app/components/settings/site-embeds/InlineWidgetsSettingsPanel";
import LiveComPreviewPanel from "@/app/components/settings/site-embeds/LiveComPreviewPanel";
import LiveComWidgetPanel from "@/app/components/settings/site-embeds/LiveComWidgetPanel";
import SiteAppearancePanel from "@/app/components/settings/site-embeds/SiteAppearancePanel";
import SiteConnectionPanel from "@/app/components/settings/site-embeds/SiteConnectionPanel";
import {
  domainsToTextareaValue,
  parseDomainsFromTextarea,
  type SiteEmbedsConfigPayload,
  type SiteEmbedSiteConfig,
} from "@/app/components/settings/site-embeds/site-embed-types";

interface SiteCreateResponse {
  /** Newly created site connection returned by the backend. */
  site: SiteEmbedSiteConfig;
}

/**
 * SiteEmbedsSettingsPage orchestrates the full site-embed admin flow:
 * load config, edit one selected site, generate snippets, and run connection diagnostics.
 */
export default function SiteEmbedsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [payload, setPayload] = useState<SiteEmbedsConfigPayload | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [draftSite, setDraftSite] = useState<SiteEmbedSiteConfig | null>(null);
  const [allowedDomainsText, setAllowedDomainsText] = useState("");

  const [saving, setSaving] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const selectedSite = useMemo(() => {
    if (!payload) return null;
    return payload.sites.find((site) => site.id === selectedSiteId) ?? payload.sites[0] ?? null;
  }, [payload, selectedSiteId]);

  /** Shows one short-lived toast to confirm save/test/create outcomes. */
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  /** Loads org-scoped site-embed config and optionally targets one site ID after mutations. */
  const loadConfig = useCallback(async (targetSiteId?: string) => {
    if (!targetSiteId) {
      setLoading(true);
    }

    setError(null);

    try {
      const query = targetSiteId ? `?siteId=${encodeURIComponent(targetSiteId)}` : "";
      const nextPayload = await apiFetch<SiteEmbedsConfigPayload>(`/api/site-embeds/config${query}`);
      setPayload(nextPayload);
      setSelectedSiteId(nextPayload.selectedSiteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site embed settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Watches initial mount and fetches the first site-embed settings payload. */
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  /** Watches selected site changes and refreshes local draft form state for controlled editing. */
  useEffect(() => {
    if (!selectedSite) {
      setDraftSite(null);
      setAllowedDomainsText("");
      return;
    }

    setDraftSite(selectedSite);
    setAllowedDomainsText(domainsToTextareaValue(selectedSite.allowedDomains));
  }, [selectedSite]);

  /** Persists selected-site form updates to backend config storage. */
  async function handleSaveConnection() {
    if (!draftSite) return;

    setSaving(true);
    try {
      await apiFetch("/api/site-embeds/config", {
        method: "PUT",
        body: JSON.stringify({
          siteId: draftSite.id,
          name: draftSite.name,
          publicSiteId: draftSite.publicSiteId,
          primaryDomain: draftSite.primaryDomain,
          allowedDomains: parseDomainsFromTextarea(allowedDomainsText),
          active: draftSite.active,
          appearance: draftSite.appearance,
          widgets: draftSite.widgets,
        }),
      });

      await loadConfig(draftSite.id);
      showToast("success", "Site connection saved.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save site connection.");
    } finally {
      setSaving(false);
    }
  }

  /** Creates one additional site connection record for multi-site organizations. */
  async function handleCreateSite() {
    setCreatingSite(true);
    try {
      const data = await apiFetch<SiteCreateResponse>("/api/site-embeds/sites", {
        method: "POST",
        body: JSON.stringify({}),
      });

      await loadConfig(data.site.id);
      showToast("success", "Website connection created.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to create website connection.");
    } finally {
      setCreatingSite(false);
    }
  }

  /** Rotates the embed token so previous public installs can be invalidated safely. */
  async function handleRegenerateToken() {
    if (!draftSite) return;

    if (!window.confirm("Regenerate this embed token? Existing installed snippets will stop working until updated.")) {
      return;
    }

    setRegeneratingToken(true);
    try {
      await apiFetch("/api/site-embeds/regenerate-token", {
        method: "POST",
        body: JSON.stringify({ siteId: draftSite.id }),
      });

      await loadConfig(draftSite.id);
      showToast("success", "Embed token regenerated.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to regenerate token.");
    } finally {
      setRegeneratingToken(false);
    }
  }

  /** Runs backend diagnostics and refreshes connection status metadata for the selected site. */
  async function handleTestConnection() {
    if (!draftSite) return;

    setTestingConnection(true);
    try {
      await apiFetch("/api/site-embeds/test-connection", {
        method: "POST",
        body: JSON.stringify({ siteId: draftSite.id }),
      });

      await loadConfig(draftSite.id);
      showToast("success", "Connection test completed.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to run connection test.");
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading site embed settings...
      </div>
    );
  }

  if (error || !payload || !draftSite || !selectedSite) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Site embed settings are unavailable for this organization."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Website Embed Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate copy-ready snippets, secure your public domain allow-list, and manage LiveCom plus inline public widgets.
        </p>
        <Link
          href="/help?scope=donor&scopePath=/settings/site-embeds"
          className="mt-2 inline-flex rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
        >
          Need help with site embeds?
        </Link>
      </div>

      {toast ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SiteConnectionPanel
          sites={payload.sites}
          selectedSiteId={selectedSite.id}
          draftSite={draftSite}
          allowedDomainsText={allowedDomainsText}
          saving={saving}
          creatingSite={creatingSite}
          regeneratingToken={regeneratingToken}
          onSelectSite={(siteId) => setSelectedSiteId(siteId)}
          onUpdateSite={(patch) => setDraftSite((prev) => (prev ? { ...prev, ...patch } : prev))}
          onAllowedDomainsChange={setAllowedDomainsText}
          onSave={() => void handleSaveConnection()}
          onCreateSite={() => void handleCreateSite()}
          onRegenerateToken={() => void handleRegenerateToken()}
        />

        <ConnectionStatusPanel
          site={selectedSite}
          testingConnection={testingConnection}
          onTestConnection={() => void handleTestConnection()}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SiteAppearancePanel
          appearance={draftSite.appearance}
          onChange={(nextAppearance) => {
            setDraftSite((prev) => (prev ? { ...prev, appearance: nextAppearance } : prev));
          }}
        />

        <LiveComWidgetPanel
          settings={draftSite.widgets.liveCom}
          onChange={(nextLiveCom) => {
            setDraftSite((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                widgets: {
                  ...prev.widgets,
                  liveCom: nextLiveCom,
                },
              };
            });
          }}
        />

        <EmbedWidgetTogglesPanel
          widgets={draftSite.widgets}
          onToggle={(key, enabled) => {
            setDraftSite((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                widgets: {
                  ...prev.widgets,
                  [key]: {
                    ...(prev.widgets[key] as object),
                    enabled,
                  },
                },
              };
            });
          }}
        />
      </div>

      <LiveComPreviewPanel settings={draftSite.widgets.liveCom} appearance={draftSite.appearance} />

      <InlineWidgetsSettingsPanel
        settings={draftSite.widgets}
        onChange={(nextWidgets) => {
          setDraftSite((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              widgets: nextWidgets,
            };
          });
        }}
      />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Install Snippets</h2>
        <p className="text-xs text-gray-500">
          Place either the head snippet in your website head section or the footer snippet before closing body. Both load the same public tokenized loader.
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          <EmbedSnippetCard
            title="Head Snippet"
            description="Recommended for global website install in the HTML head."
            code={payload.snippets.headSnippet}
          />
          <EmbedSnippetCard
            title="Footer Snippet"
            description="Alternative install path for body-end placement."
            code={payload.snippets.footerSnippet}
          />
        </div>

        {Object.entries(payload.snippets.embedBlocks).length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {Object.entries(payload.snippets.embedBlocks).map(([key, snippet]) => (
              <EmbedSnippetCard
                key={key}
                title={`${key} Embed Block`}
                description="Inline embed-block snippet for manual placement on specific pages."
                code={snippet}
              />
            ))}
          </div>
        ) : null}
      </div>

      <EmbedRegistryPanel registry={payload.registry} />
    </div>
  );
}
