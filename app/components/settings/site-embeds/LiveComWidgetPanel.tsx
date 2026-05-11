// LiveCom-specific widget controls for button behavior and public chat launcher presentation.
"use client";

import type { LiveComWidgetSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface LiveComWidgetPanelProps {
  /** Current LiveCom widget settings for the selected site connection. */
  settings: LiveComWidgetSettings;
  /** Called when one or more LiveCom settings fields change. */
  onChange: (next: LiveComWidgetSettings) => void;
}

/**
 * LiveComWidgetPanel provides the first fully working embeddable configuration surface.
 * Admins can enable/disable the floating launcher and adjust copy/position settings.
 */
export default function LiveComWidgetPanel({ settings, onChange }: LiveComWidgetPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">LiveCom Messenger</h2>
        <p className="mt-1 text-xs text-gray-500">
          Control the floating chat button that appears on your public website after install snippets are added.
        </p>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
          className="rounded border-gray-300 text-green-600"
        />
        Enable LiveCom widget
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-600">
          Button Label
          <input
            value={settings.buttonLabel}
            onChange={(event) => onChange({ ...settings, buttonLabel: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Button Position
          <select
            value={settings.buttonPosition}
            onChange={(event) => onChange({
              ...settings,
              buttonPosition: event.target.value === "bottom-left" ? "bottom-left" : "bottom-right",
            })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600 sm:col-span-2">
          Greeting Message
          <input
            value={settings.greetingMessage}
            onChange={(event) => onChange({ ...settings, greetingMessage: event.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
        </label>
      </div>

      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        LiveCom messages submitted from your website are recorded as public website interactions inside DonorCRM communication tools.
      </p>
    </section>
  );
}
