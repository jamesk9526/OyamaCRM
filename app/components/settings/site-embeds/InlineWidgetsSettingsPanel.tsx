// Full settings editor for all non-LiveCom public embed widgets.
"use client";

import type { SiteWidgetSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface InlineWidgetsSettingsPanelProps {
  /** Current per-widget settings draft for the selected site connection. */
  settings: SiteWidgetSettings;
  /** Called whenever one non-LiveCom widget settings block changes. */
  onChange: (next: SiteWidgetSettings) => void;
}

function parseNumberList(value: string): number[] {
  return value
    .split(/[\n,]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function InlineWidgetsSettingsPanel({ settings, onChange }: InlineWidgetsSettingsPanelProps) {
  const updateWidget = <K extends Exclude<keyof SiteWidgetSettings, "liveCom">>(key: K, patch: Partial<SiteWidgetSettings[K]>) => {
    onChange({
      ...settings,
      [key]: {
        ...settings[key],
        ...patch,
      },
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Inline Widget Settings</h2>
        <p className="mt-1 text-xs text-gray-500">
          Configure each public widget. Branding defaults (logo, org name, primary/accent color) are applied automatically when widget fields are blank.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Donation Widget</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.donation_widget.enabled}
            onChange={(event) => updateWidget("donation_widget", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Headline
            <input
              value={settings.donation_widget.headline}
              onChange={(event) => updateWidget("donation_widget", { headline: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Supporting Copy
            <textarea
              value={settings.donation_widget.supportingCopy}
              onChange={(event) => updateWidget("donation_widget", { supportingCopy: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Suggested Amounts (comma or newline)
            <textarea
              value={settings.donation_widget.suggestedAmounts.join(", ")}
              onChange={(event) => updateWidget("donation_widget", { suggestedAmounts: parseNumberList(event.target.value) })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Minimum Amount (cents)
            <input
              type="number"
              min={0}
              value={settings.donation_widget.minimumAmountCents}
              onChange={(event) => updateWidget("donation_widget", { minimumAmountCents: Number(event.target.value) || 0 })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Default Designation
            <input
              value={settings.donation_widget.defaultDesignation}
              onChange={(event) => updateWidget("donation_widget", { defaultDesignation: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Allowed Designations (comma or newline)
            <textarea
              value={settings.donation_widget.allowedDesignations.join("\n")}
              onChange={(event) => updateWidget("donation_widget", { allowedDesignations: parseTextList(event.target.value) })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
            <input
              type="checkbox"
              checked={settings.donation_widget.enableMonthlyGiving}
              onChange={(event) => updateWidget("donation_widget", { enableMonthlyGiving: event.target.checked })}
              className="rounded border-gray-300 text-green-600"
            />
            Enable monthly giving
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.donation_widget.accentColor}
              onChange={(event) => updateWidget("donation_widget", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Trust Line
            <input
              value={settings.donation_widget.trustLine}
              onChange={(event) => updateWidget("donation_widget", { trustLine: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Success Message
            <input
              value={settings.donation_widget.successMessage}
              onChange={(event) => updateWidget("donation_widget", { successMessage: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Failure Message
            <input
              value={settings.donation_widget.failureMessage}
              onChange={(event) => updateWidget("donation_widget", { failureMessage: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Campaign Progress Meter</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.campaign_meter.enabled}
            onChange={(event) => updateWidget("campaign_meter", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Campaign ID
            <input
              value={settings.campaign_meter.campaignId}
              onChange={(event) => updateWidget("campaign_meter", { campaignId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.campaign_meter.accentColor}
              onChange={(event) => updateWidget("campaign_meter", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">CTA Label
            <input
              value={settings.campaign_meter.ctaLabel}
              onChange={(event) => updateWidget("campaign_meter", { ctaLabel: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">CTA URL
            <input
              value={settings.campaign_meter.ctaHref}
              onChange={(event) => updateWidget("campaign_meter", { ctaHref: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Event Card</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.event_card.enabled}
            onChange={(event) => updateWidget("event_card", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Event ID
            <input
              value={settings.event_card.eventId}
              onChange={(event) => updateWidget("event_card", { eventId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.event_card.accentColor}
              onChange={(event) => updateWidget("event_card", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 md:col-span-2">
            <input
              type="checkbox"
              checked={settings.event_card.showFundraisingProgress}
              onChange={(event) => updateWidget("event_card", { showFundraisingProgress: event.target.checked })}
              className="rounded border-gray-300 text-green-600"
            />
            Show fundraising progress
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Volunteer Sign-up</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.volunteer_signup.enabled}
            onChange={(event) => updateWidget("volunteer_signup", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Headline
            <input
              value={settings.volunteer_signup.headline}
              onChange={(event) => updateWidget("volunteer_signup", { headline: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.volunteer_signup.accentColor}
              onChange={(event) => updateWidget("volunteer_signup", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Supporting Copy
            <textarea
              value={settings.volunteer_signup.supportingCopy}
              onChange={(event) => updateWidget("volunteer_signup", { supportingCopy: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Interest Areas (comma or newline)
            <textarea
              value={settings.volunteer_signup.interestAreas.join("\n")}
              onChange={(event) => updateWidget("volunteer_signup", { interestAreas: parseTextList(event.target.value) })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Success Message
            <input
              value={settings.volunteer_signup.successMessage}
              onChange={(event) => updateWidget("volunteer_signup", { successMessage: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Newsletter Sign-up</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.newsletter_signup.enabled}
            onChange={(event) => updateWidget("newsletter_signup", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Headline
            <input
              value={settings.newsletter_signup.headline}
              onChange={(event) => updateWidget("newsletter_signup", { headline: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.newsletter_signup.accentColor}
              onChange={(event) => updateWidget("newsletter_signup", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Supporting Copy
            <textarea
              value={settings.newsletter_signup.supportingCopy}
              onChange={(event) => updateWidget("newsletter_signup", { supportingCopy: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Consent Line
            <input
              value={settings.newsletter_signup.consentLine}
              onChange={(event) => updateWidget("newsletter_signup", { consentLine: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Success Message
            <input
              value={settings.newsletter_signup.successMessage}
              onChange={(event) => updateWidget("newsletter_signup", { successMessage: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Impact Counter</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.impact_counter.enabled}
            onChange={(event) => updateWidget("impact_counter", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.impact_counter.accentColor}
              onChange={(event) => updateWidget("impact_counter", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Disclaimer
            <input
              value={settings.impact_counter.disclaimer}
              onChange={(event) => updateWidget("impact_counter", { disclaimer: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Stats JSON
            <textarea
              value={settings.impact_counter.statsJson}
              onChange={(event) => updateWidget("impact_counter", { statsJson: event.target.value })}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Custom CTA Block</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.cta_block.enabled}
            onChange={(event) => updateWidget("cta_block", { enabled: event.target.checked })}
            className="rounded border-gray-300 text-green-600"
          />
          Enabled
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Headline
            <input
              value={settings.cta_block.headline}
              onChange={(event) => updateWidget("cta_block", { headline: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Layout
            <select
              value={settings.cta_block.layout}
              onChange={(event) => updateWidget("cta_block", {
                layout: event.target.value === "banner" ? "banner" : event.target.value === "minimal" ? "minimal" : "card",
              })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="card">Card</option>
              <option value="banner">Banner</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600 md:col-span-2">Body Copy
            <textarea
              value={settings.cta_block.bodyCopy}
              onChange={(event) => updateWidget("cta_block", { bodyCopy: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Primary Label
            <input
              value={settings.cta_block.primaryButtonLabel}
              onChange={(event) => updateWidget("cta_block", { primaryButtonLabel: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Primary URL
            <input
              value={settings.cta_block.primaryButtonHref}
              onChange={(event) => updateWidget("cta_block", { primaryButtonHref: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Secondary Label
            <input
              value={settings.cta_block.secondaryButtonLabel}
              onChange={(event) => updateWidget("cta_block", { secondaryButtonLabel: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Secondary URL
            <input
              value={settings.cta_block.secondaryButtonHref}
              onChange={(event) => updateWidget("cta_block", { secondaryButtonHref: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">Accent Color
            <input
              value={settings.cta_block.accentColor}
              onChange={(event) => updateWidget("cta_block", { accentColor: event.target.value })}
              placeholder="Auto from Branding if blank"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
