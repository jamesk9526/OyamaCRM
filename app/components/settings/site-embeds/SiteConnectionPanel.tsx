// Site-connection controls for configuring external website identity, domains, and token lifecycle.
"use client";

import type { SiteEmbedSiteConfig } from "@/app/components/settings/site-embeds/site-embed-types";

interface SiteConnectionPanelProps {
  /** All configured websites for this organization. */
  sites: SiteEmbedSiteConfig[];
  /** Currently selected website connection ID. */
  selectedSiteId: string;
  /** Current editable draft for the selected site. */
  draftSite: SiteEmbedSiteConfig;
  /** Textarea value representing allowed domains as lines. */
  allowedDomainsText: string;
  /** True while save operations are in flight. */
  saving: boolean;
  /** True while a new site connection is being created. */
  creatingSite: boolean;
  /** True while token rotation is in progress. */
  regeneratingToken: boolean;
  /** Called when admin selects a different site connection. */
  onSelectSite: (siteId: string) => void;
  /** Called when one top-level site field changes. */
  onUpdateSite: (patch: Partial<SiteEmbedSiteConfig>) => void;
  /** Called when allowed-domain textarea text changes. */
  onAllowedDomainsChange: (value: string) => void;
  /** Persists current site draft changes. */
  onSave: () => void;
  /** Creates a new site-connection entry. */
  onCreateSite: () => void;
  /** Rotates token for the selected site. */
  onRegenerateToken: () => void;
}

/**
 * SiteConnectionPanel renders editable website-connection metadata and token lifecycle controls.
 * This is the primary place where admins bind their public website domain to DonorCRM embeds.
 */
export default function SiteConnectionPanel({
  sites,
  selectedSiteId,
  draftSite,
  allowedDomainsText,
  saving,
  creatingSite,
  regeneratingToken,
  onSelectSite,
  onUpdateSite,
  onAllowedDomainsChange,
  onSave,
  onCreateSite,
  onRegenerateToken,
}: SiteConnectionPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Website Connection</h2>
          <p className="mt-1 text-xs text-gray-500">
            Configure domains, public site identity, and embed token mapping for external website installs.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateSite}
          disabled={creatingSite}
          className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
        >
          {creatingSite ? "Creating..." : "Add Website"}
        </button>
      </div>

      <label className="block text-xs font-semibold text-gray-600">
        Connected Website
        <select
          value={selectedSiteId}
          onChange={(event) => onSelectSite(event.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name} ({site.publicSiteId})
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-600">
          Website Name
          <input
            value={draftSite.name}
            onChange={(event) => onUpdateSite({ name: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Public Site ID
          <input
            value={draftSite.publicSiteId}
            onChange={(event) => onUpdateSite({ publicSiteId: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>

        <label className="block text-xs font-semibold text-gray-600 sm:col-span-2">
          Primary Domain
          <input
            value={draftSite.primaryDomain}
            onChange={(event) => onUpdateSite({ primaryDomain: event.target.value })}
            placeholder="example.org"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>

        <label className="block text-xs font-semibold text-gray-600 sm:col-span-2">
          Allowed Domains (one per line)
          <textarea
            rows={3}
            value={allowedDomainsText}
            onChange={(event) => onAllowedDomainsChange(event.target.value)}
            placeholder="example.org\nwww.example.org\n*.support.example.org\n* (allow any domain)"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>
      </div>

      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        Tip: Use <span className="font-mono">*</span> in Allowed Domains for multi-website testing. For production security, prefer explicit domains.
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <p className="font-semibold text-gray-700">Embed Token</p>
        <p className="mt-1 break-all font-mono text-[11px] text-gray-600">{draftSite.embedToken}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draftSite.active}
            onChange={(event) => onUpdateSite({ active: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Active site connection
        </label>

        <button
          type="button"
          onClick={onRegenerateToken}
          disabled={regeneratingToken}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
        >
          {regeneratingToken ? "Regenerating..." : "Regenerate Token"}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Connection"}
        </button>
      </div>
    </section>
  );
}
