/**
 * DonorHero renders the naturalistic full-width hero header for the Donor CRM dashboard.
 * Reads a configurable header image URL from organization settings; falls back to a soft
 * green gradient when no image is configured.
 */
"use client";

import Link from "next/link";
import { DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import type { DashboardAppearanceSettings } from "@/app/features/donor-dashboard/types";

interface DonorHeroProps {
  greeting: string;
  name: string;
  appearance: DashboardAppearanceSettings;
  /** Override subtitle text. Defaults to a mission-centered line. */
  subtitleText?: string;
  /** User's personal header image URL override. Takes priority over org default. */
  headerImageOverride?: string | null;
  /** Called when the user clicks the edit/customize button on the hero. */
  onEditHeader?: () => void;
}

function overlayFromHex(hex: string, opacityPercent: number): string {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#052e24";
  const alpha = Math.min(0.9, Math.max(0, opacityPercent / 100));
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const HERO_HEIGHT_CLASS = {
  compact: "min-h-[200px] md:min-h-[220px] xl:min-h-[240px]",
  standard: "min-h-[220px] md:min-h-[260px] xl:min-h-[300px]",
  large: "min-h-[240px] md:min-h-[300px] xl:min-h-[360px]",
};

const IMAGE_POSITION_CLASS = {
  center: "bg-center",
  top: "bg-top",
  bottom: "bg-bottom",
  left: "bg-left",
  right: "bg-right",
};

export default function DonorHero({ greeting, name, appearance, subtitleText, headerImageOverride, onEditHeader }: DonorHeroProps) {
  const firstName = name.split(" ")[0] || name;
  const headerImageUrl = (headerImageOverride ?? appearance.headerImageUrl) || null;
  const heroText = subtitleText
    ?? (appearance.heroTitleMode === "custom" && appearance.customHeroText
      ? appearance.customHeroText
      : "Steward well. Give generously. Impact grows.");
  const shouldShowQuote = appearance.showQuoteCard && appearance.quoteText.trim().length > 0;
  const overlayColor = overlayFromHex(appearance.overlayColor, appearance.overlayStrength);
  const heightClass = HERO_HEIGHT_CLASS[appearance.heroHeight] ?? HERO_HEIGHT_CLASS.standard;
  const imagePositionClass = IMAGE_POSITION_CLASS[appearance.headerImagePosition] ?? IMAGE_POSITION_CLASS.center;
  const greetingText = appearance.greetingStyle === "formal"
    ? `${greeting}, ${name}.`
    : appearance.greetingStyle === "simple"
      ? `${greeting}.`
      : `${greeting}, ${firstName}.`;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl ${heightClass}`}>
      {/* Background: image or gradient */}
      {headerImageUrl ? (
        <div
          className={`absolute inset-0 bg-cover bg-no-repeat ${imagePositionClass}`}
          style={{ backgroundImage: `url(${headerImageUrl})` }}
          aria-hidden="true"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #052E24 0%, #065f46 38%, #047857 65%, #059669 100%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: headerImageUrl
            ? `linear-gradient(to bottom, ${overlayColor} 0%, ${overlayColor} 100%)`
            : "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Customize button — absolute top-right */}
      {onEditHeader && (
        <button
          type="button"
          onClick={onEditHeader}
          className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Customize dashboard"
        >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          Customize
        </button>
      )}

      {/* Two-column hero content */}
      <div
        className={`relative z-10 flex h-full items-stretch ${heightClass}`}
      >
        {/* Left column: greeting + CTAs */}
        <div className="flex flex-1 flex-col justify-between px-5 py-7 sm:px-8 lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/80">
              DONOR STEWARDSHIP DASHBOARD
            </p>
            <h1
              className="mt-3 font-extrabold tracking-tight text-white"
              style={{ lineHeight: 1.08, fontSize: "clamp(1.85rem, 3.5vw, 3rem)" }}
            >
              {greetingText}
            </h1>
            <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-white/80 sm:text-lg">
              {heroText}
            </p>
          </div>

          {/* Action strip */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {appearance.primaryActions.map((actionId) => {
              const action = DASHBOARD_HERO_ACTIONS[actionId];
              return (
                <Link
                  key={actionId}
                  href={action.href}
                  className={action.primary
                    ? "inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-900 shadow-lg transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white/60"
                    : "inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  }
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right column: quote card (hidden on small screens) */}
        {shouldShowQuote ? <div className="hidden items-center justify-end pb-8 pr-8 pt-14 lg:flex lg:pr-10">
          <div
            className="max-w-xs rounded-2xl border border-white/20 p-6 backdrop-blur-md"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <span
              aria-hidden="true"
              className="block font-serif text-7xl leading-none select-none text-white/20"
              style={{ lineHeight: 0.75, marginBottom: "0.5rem" }}
            >
              &ldquo;
            </span>
            <blockquote className="mt-1 text-sm font-medium italic leading-relaxed text-white/90">
              {appearance.quoteText}
            </blockquote>
            {appearance.quoteAuthor ? (
              <footer className="mt-4 text-xs font-semibold text-white/55">
                {appearance.quoteAuthor}
              </footer>
            ) : null}
          </div>
        </div> : null}
      </div>
    </div>
  );
}
