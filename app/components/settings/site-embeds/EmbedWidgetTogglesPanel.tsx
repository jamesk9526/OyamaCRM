// Widget toggle controls for enabling/disabling public inline site-embed blocks per connected website.
"use client";

import type { SiteWidgetSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface EmbedWidgetTogglesPanelProps {
  /** Full widget map for the currently selected site connection. */
  widgets: SiteWidgetSettings;
  /** Called when one widget enabled state should be updated. */
  onToggle: (key: Exclude<keyof SiteWidgetSettings, "liveCom">, enabled: boolean) => void;
}

/**
 * EmbedWidgetTogglesPanel exposes enable/disable switches for non-LiveCom embeddables.
 * This keeps rollout controls in one place while preserving LiveCom-specific settings elsewhere.
 */
export default function EmbedWidgetTogglesPanel({ widgets, onToggle }: EmbedWidgetTogglesPanelProps) {
  const items: Array<{ key: Exclude<keyof SiteWidgetSettings, "liveCom">; label: string; description: string }> = [
    {
      key: "campaign_meter",
      label: "Campaign Progress Meter",
      description: "Show a live fundraising progress meter for an active campaign.",
    },
    {
      key: "donation_widget",
      label: "Donation Widget",
      description: "Capture donation interest directly from public website pages.",
    },
    {
      key: "event_card",
      label: "Event & Fundraising Card",
      description: "Display featured event summary and registration call-to-action.",
    },
    {
      key: "volunteer_signup",
      label: "Volunteer Sign-up",
      description: "Collect volunteer interest submissions into DonorCRM activity logs.",
    },
    {
      key: "newsletter_signup",
      label: "Newsletter Sign-up",
      description: "Collect newsletter sign-up submissions from external websites.",
    },
    {
      key: "impact_counter",
      label: "Impact Counter",
      description: "Render public-safe impact metrics to build trust and transparency.",
    },
    {
      key: "cta_block",
      label: "Custom CTA Block",
      description: "Render reusable mission CTA blocks with configurable copy.",
    },
  ];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Inline Widget Controls</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enable the public widgets you want active for this website connection.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-gray-800">{item.label}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">{item.description}</p>
            </div>

            <input
              type="checkbox"
              checked={Boolean(widgets[item.key]?.enabled)}
              onChange={(event) => onToggle(item.key, event.target.checked)}
              className="mt-1 rounded border-gray-300 text-green-600"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
