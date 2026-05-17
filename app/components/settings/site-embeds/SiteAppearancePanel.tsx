// Site-wide appearance controls for all public OyamaCRM embed widgets.
"use client";

import type { SiteEmbedAppearanceSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface SiteAppearancePanelProps {
  /** Current site-wide appearance draft for the selected website connection. */
  appearance: SiteEmbedAppearanceSettings;
  /** Called when one or more appearance settings change. */
  onChange: (next: SiteEmbedAppearanceSettings) => void;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string, fallback: string): string {
  return HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const pickerColor = safeColor(value, fallback);

  return (
    <label className="block text-xs font-semibold text-gray-600">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={pickerColor}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-11 rounded border border-gray-300 bg-white p-1"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fallback}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
        />
      </div>
    </label>
  );
}

/**
 * SiteAppearancePanel centralizes theme controls so widget-specific editors only handle content.
 */
export default function SiteAppearancePanel({ appearance, onChange }: SiteAppearancePanelProps) {
  const update = (patch: Partial<SiteEmbedAppearanceSettings>) => onChange({ ...appearance, ...patch });
  const accent = safeColor(appearance.accentColor, "#16a34a");
  const background = safeColor(appearance.backgroundColor, "#ffffff");
  const textColor = safeColor(appearance.textColor, "#111827");
  const borderColor = safeColor(appearance.borderColor, "#e5e7eb");
  const radiusClass = appearance.cornerRadius === "rounded" ? "rounded-2xl" : appearance.cornerRadius === "square" ? "rounded-md" : "rounded-xl";
  const buttonClass = appearance.buttonStyle === "outline"
    ? "border bg-transparent"
    : appearance.buttonStyle === "soft"
      ? "border"
      : "border border-transparent";

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Embed Theme</h2>
        <p className="mt-1 text-xs text-gray-500">
          Set the default styling used across LiveCom and all inline public widgets. Widget accent fields can still override this per block.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="Default Accent" value={appearance.accentColor} fallback="#16a34a" onChange={(value) => update({ accentColor: value })} />
        <ColorField label="Background" value={appearance.backgroundColor} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
        <ColorField label="Text" value={appearance.textColor} fallback="#111827" onChange={(value) => update({ textColor: value })} />
        <ColorField label="Muted Text" value={appearance.mutedTextColor} fallback="#6b7280" onChange={(value) => update({ mutedTextColor: value })} />
        <ColorField label="Border" value={appearance.borderColor} fallback="#e5e7eb" onChange={(value) => update({ borderColor: value })} />

        <label className="block text-xs font-semibold text-gray-600">
          Surface Mode
          <select
            value={appearance.themeMode}
            onChange={(event) => update({ themeMode: event.target.value as SiteEmbedAppearanceSettings["themeMode"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="light">Light</option>
            <option value="soft">Soft</option>
            <option value="transparent">Transparent</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Density
          <select
            value={appearance.density}
            onChange={(event) => update({ density: event.target.value as SiteEmbedAppearanceSettings["density"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Corners
          <select
            value={appearance.cornerRadius}
            onChange={(event) => update({ cornerRadius: event.target.value as SiteEmbedAppearanceSettings["cornerRadius"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="square">Square</option>
            <option value="soft">Soft</option>
            <option value="rounded">Rounded</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Card Style
          <select
            value={appearance.cardStyle}
            onChange={(event) => update({ cardStyle: event.target.value as SiteEmbedAppearanceSettings["cardStyle"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="elevated">Elevated</option>
            <option value="bordered">Bordered</option>
            <option value="flat">Flat</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Button Style
          <select
            value={appearance.buttonStyle}
            onChange={(event) => update({ buttonStyle: event.target.value as SiteEmbedAppearanceSettings["buttonStyle"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="solid">Solid</option>
            <option value="soft">Soft</option>
            <option value="outline">Outline</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-600">
          Font
          <select
            value={appearance.fontFamily}
            onChange={(event) => update({ fontFamily: event.target.value as SiteEmbedAppearanceSettings["fontFamily"] })}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="system">System Sans</option>
            <option value="rounded">Rounded Sans</option>
            <option value="serif">Serif</option>
          </select>
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div
          className={`border p-4 ${radiusClass} ${appearance.cardStyle === "elevated" ? "shadow-sm" : ""}`}
          style={{
            background: appearance.themeMode === "transparent" ? "transparent" : background,
            borderColor,
            color: textColor,
            fontFamily: appearance.fontFamily === "serif" ? "Georgia, serif" : "system-ui, sans-serif",
          }}
        >
          <div className="h-1 w-16 rounded-full" style={{ background: accent }} />
          <p className="mt-3 text-sm font-semibold">Sample public widget</p>
          <p className="mt-1 text-xs" style={{ color: safeColor(appearance.mutedTextColor, "#6b7280") }}>
            Theme settings apply globally unless a widget overrides its own accent color.
          </p>
          <button
            type="button"
            className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold ${buttonClass}`}
            style={{
              background: appearance.buttonStyle === "solid" ? accent : appearance.buttonStyle === "soft" ? `${accent}18` : "transparent",
              borderColor: appearance.buttonStyle === "solid" ? "transparent" : accent,
              color: appearance.buttonStyle === "solid" ? "#ffffff" : accent,
            }}
          >
            Sample CTA
          </button>
        </div>
      </div>
    </section>
  );
}
