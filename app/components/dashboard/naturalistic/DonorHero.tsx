/**
 * DonorHero renders the naturalistic full-width hero header for the Donor CRM dashboard.
 * Reads a configurable header image URL from organization settings; falls back to a soft
 * green gradient when no image is configured.
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEventHandler } from "react";
import { DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import type { DashboardAppearanceSettings } from "@/app/features/donor-dashboard/types";

interface DonorHeroProps {
  greeting: string;
  name: string;
  appearance: DashboardAppearanceSettings;
  crmReactiveTone?: "steady" | "focus" | "growth" | "alert";
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
  compact: "min-h-[140px] md:min-h-[155px] xl:min-h-[165px]",
  standard: "min-h-[165px] md:min-h-[185px] xl:min-h-[200px]",
  large: "min-h-[200px] md:min-h-[240px] xl:min-h-[280px]",
};

const IMAGE_POSITION_CLASS = {
  center: "bg-center",
  top: "bg-top",
  bottom: "bg-bottom",
  left: "bg-left",
  right: "bg-right",
};

const HERO_MISSION_VARIANTS = [
  "Steward well. Give generously. Impact grows.",
  "Steward with heart. Give with purpose. Impact grows.",
  "Steward daily. Give boldly. Impact compounds.",
];

export default function DonorHero({ greeting, name, appearance, crmReactiveTone: _crmReactiveTone, subtitleText, headerImageOverride, onEditHeader }: DonorHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [missionVariantIndex, setMissionVariantIndex] = useState(0);
  const firstName = name.split(" ")[0] || name;
  const headerImageUrl = (headerImageOverride ?? appearance.headerImageUrl) || null;
  const crmTone = _crmReactiveTone ?? "steady";
  const toneStatusLabel = crmTone === "alert"
    ? "Action needed"
    : crmTone === "focus"
      ? "Focus mode"
      : crmTone === "growth"
        ? "Growth momentum"
        : "Steady operations";
  const toneStatusClass = crmTone === "alert"
    ? "bg-amber-300/25 text-amber-50 border-amber-200/45"
    : crmTone === "focus"
      ? "bg-sky-300/25 text-sky-50 border-sky-200/45"
      : crmTone === "growth"
        ? "bg-emerald-300/25 text-emerald-50 border-emerald-200/45"
        : "bg-white/15 text-white border-white/30";
  const toneGuidance = crmTone === "alert"
    ? "Overdue tasks detected. Prioritize follow-up and acknowledgments."
    : crmTone === "focus"
      ? "Pipeline concentration is high. Keep action cadence tight this week."
      : crmTone === "growth"
        ? "Positive giving trend detected. Expand outreach while momentum is strong."
        : "Stewardship indicators look stable. Maintain your regular rhythm.";
  const heroText = subtitleText
    ?? (appearance.heroTitleMode === "custom" && appearance.customHeroText
      ? appearance.customHeroText
      : toneGuidance || HERO_MISSION_VARIANTS[missionVariantIndex] || HERO_MISSION_VARIANTS[0]);
  const shouldShowQuote = appearance.showQuoteCard && appearance.quoteText.trim().length > 0;
  const overlayColor = overlayFromHex(appearance.overlayColor, appearance.overlayStrength);
  const heightClass = HERO_HEIGHT_CLASS[appearance.heroHeight] ?? HERO_HEIGHT_CLASS.standard;
  const imagePositionClass = IMAGE_POSITION_CLASS[appearance.headerImagePosition] ?? IMAGE_POSITION_CLASS.center;
  const greetingText = appearance.greetingStyle === "formal"
    ? `${greeting}, ${name}.`
    : appearance.greetingStyle === "simple"
      ? `${greeting}.`
      : `${greeting}, ${firstName}.`;

  useEffect(() => {
    if (subtitleText || (appearance.heroTitleMode === "custom" && appearance.customHeroText.trim().length > 0)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMissionVariantIndex((current) => (current + 1) % HERO_MISSION_VARIANTS.length);
    }, 9000);

    return () => window.clearInterval(intervalId);
  }, [appearance.customHeroText, appearance.heroTitleMode, subtitleText]);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    const node = heroRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nx = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const ny = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    node.style.setProperty("--hero-mx", nx.toFixed(4));
    node.style.setProperty("--hero-my", ny.toFixed(4));
  };

  const handleMouseLeave = () => {
    const node = heroRef.current;
    if (!node) return;
    node.style.setProperty("--hero-mx", "0");
    node.style.setProperty("--hero-my", "0");
  };

  return (
    <div
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`hero-reactive-root relative w-full overflow-hidden ${heightClass}`}
      style={{ ["--hero-mx" as string]: 0, ["--hero-my" as string]: 0 }}
    >
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

      {/* Dark overlay for readability — fades to page bg at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: headerImageUrl
            ? `linear-gradient(to bottom, ${overlayColor} 0%, ${overlayColor} 72%, rgba(250,250,247,0.82) 100%)`
            : "linear-gradient(to bottom, rgba(5,46,36,0.55) 0%, rgba(4,120,87,0.35) 70%, rgba(250,250,247,0.6) 100%)",
        }}
        aria-hidden="true"
      />
      {/* Bottom fade to merge smoothly with page background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #FAFAF7)" }}
        aria-hidden="true"
      />

      {/* Soft ambient gradient motion to give the hero a calm sense of life. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="hero-ambient hero-ambient-one hero-reactive-depth-3" />
        <div className="hero-ambient hero-ambient-two hero-reactive-depth-2" />
        <div className="hero-ambient hero-ambient-three hero-reactive-depth-1" />
      </div>

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
        <div className="flex flex-1 flex-col justify-center px-5 py-5 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="hero-badge-motion hero-badge-shimmer text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/90">
              Donor CRM
            </p>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${toneStatusClass}`}>
              {toneStatusLabel}
            </span>
          </div>
          <h1
            className="font-extrabold tracking-tight text-white"
            style={{ lineHeight: 1.1, fontSize: "clamp(1.4rem, 2.5vw, 2rem)" }}
          >
            {greetingText}
          </h1>
          <p key={heroText} className="hero-subtitle-motion mt-1.5 max-w-xl text-sm font-medium leading-relaxed text-white/78">
            {heroText}
          </p>

          {/* Action strip */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {appearance.primaryActions.map((actionId) => {
              const action = DASHBOARD_HERO_ACTIONS[actionId];
              return (
                <Link
                  key={actionId}
                  href={action.href}
                  className={action.primary
                    ? "inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-emerald-900 shadow-md transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-white/60"
                    : "inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  }
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right column: quote card (hidden on small screens / compact heights) */}
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

      <style jsx>{`
        .hero-ambient {
          position: absolute;
          border-radius: 9999px;
          filter: blur(42px);
          opacity: 0.34;
          will-change: transform, opacity;
        }

        .hero-reactive-root {
          transition: background-position 0.7s ease-out;
        }

        .hero-reactive-depth-1 {
          transform: translate3d(calc(var(--hero-mx) * 4px), calc(var(--hero-my) * 4px), 0);
        }

        .hero-reactive-depth-2 {
          transform: translate3d(calc(var(--hero-mx) * -5px), calc(var(--hero-my) * -4px), 0);
        }

        .hero-reactive-depth-3 {
          transform: translate3d(calc(var(--hero-mx) * 7px), calc(var(--hero-my) * 5px), 0);
        }

        .hero-badge-motion {
          display: inline-block;
          text-shadow: 0 1px 0 rgba(4, 47, 46, 0.18), 0 6px 24px rgba(167, 243, 208, 0.16);
          transform: translate3d(calc(var(--hero-mx) * 2px), calc(var(--hero-my) * 1.5px), 0);
          transition: transform 0.35s ease-out, text-shadow 0.35s ease-out;
          will-change: transform;
        }

        .hero-badge-shimmer {
          background-image: linear-gradient(110deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.98) 22%, rgba(209, 250, 229, 0.84) 44%, rgba(255, 255, 255, 0.76) 68%, rgba(255, 255, 255, 0.95) 100%);
          background-size: 210% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: donor-hero-badge-shimmer 12s ease-in-out infinite;
        }

        .hero-subtitle-motion {
          transform: translate3d(calc(var(--hero-mx) * 1.2px), calc(var(--hero-my) * 1px), 0);
          transition: transform 0.45s ease-out;
          will-change: transform;
        }

        .hero-subtitle-pulse {
          animation: donor-hero-subtitle-fade 0.9s ease;
        }

        .hero-ambient-one {
          width: 52%;
          height: 72%;
          left: -12%;
          top: -16%;
          background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.36) 0%, rgba(255, 255, 255, 0) 72%);
          animation: donor-hero-float-a 32s ease-in-out infinite;
        }

        .hero-ambient-two {
          width: 46%;
          height: 66%;
          right: -11%;
          top: 14%;
          background: radial-gradient(circle at 50% 50%, rgba(167, 243, 208, 0.34) 0%, rgba(167, 243, 208, 0) 74%);
          animation: donor-hero-float-b 38s ease-in-out infinite;
        }

        .hero-ambient-three {
          width: 44%;
          height: 60%;
          left: 24%;
          bottom: -24%;
          background: radial-gradient(circle at 50% 50%, rgba(236, 253, 245, 0.26) 0%, rgba(236, 253, 245, 0) 72%);
          animation: donor-hero-float-c 42s ease-in-out infinite;
        }

        @keyframes donor-hero-float-a {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.28;
          }
          50% {
            transform: translate3d(2.5%, 3.5%, 0) scale(1.04);
            opacity: 0.42;
          }
        }

        @keyframes donor-hero-float-b {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.24;
          }
          50% {
            transform: translate3d(-3.5%, -2.2%, 0) scale(1.05);
            opacity: 0.37;
          }
        }

        @keyframes donor-hero-float-c {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.2;
          }
          50% {
            transform: translate3d(2.2%, -3.2%, 0) scale(1.06);
            opacity: 0.34;
          }
        }

        @keyframes donor-hero-badge-shimmer {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes donor-hero-subtitle-fade {
          0% {
            opacity: 0.4;
            transform: translate3d(calc(var(--hero-mx) * 1.2px), calc(var(--hero-my) * 1px + 4px), 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(calc(var(--hero-mx) * 1.2px), calc(var(--hero-my) * 1px), 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-ambient-one,
          .hero-ambient-two,
          .hero-ambient-three {
            animation: none;
            opacity: 0.22;
          }

          .hero-reactive-depth-1,
          .hero-reactive-depth-2,
          .hero-reactive-depth-3,
          .hero-badge-motion,
          .hero-subtitle-motion,
          .hero-badge-shimmer,
          .hero-subtitle-pulse {
            transform: none;
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
