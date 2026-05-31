import type { DashboardChromeTint } from "@/app/lib/dashboard-image-tint";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";

export interface TopBarModuleChromePalette {
  scoopStart: string;
  scoopMid: string;
  scoopEnd: string;
  scoopStroke: string;
  glowStart: string;
  glowMid: string;
  glowEnd: string;
  mobileGradient: string;
  mobileBorderColor: string;
  mobileShadow: string;
}

export interface ModuleSwitcherTone {
  glow: string;
  button: string;
  activeItem: string;
  activeIcon: string;
  activePill: string;
}

/** Resolves the thin reactive accent line class used at the bottom of the top bar. */
export function resolveTopBarModuleAccentClass(moduleKey: TopBarModuleKey, donorAccentLineClass: string): string {
  if (moduleKey === "compassion") return "bg-blue-600";
  if (moduleKey === "events") return "bg-violet-500";
  if (moduleKey === "watchdog") return "bg-red-600";
  if (moduleKey === "webmaster") return "bg-indigo-600";
  if (moduleKey === "hrm") return "bg-teal-600";
  if (moduleKey === "oshareview") return "bg-cyan-600";
  return donorAccentLineClass;
}

/** Resolves module chrome palette values for brand scoop/glow and mobile gradients. */
export function resolveTopBarModuleChromePalette(
  moduleKey: TopBarModuleKey,
  donorChromeTint?: DashboardChromeTint,
): TopBarModuleChromePalette {
  if (moduleKey === "compassion") {
    return {
      scoopStart: "#1e3a8a",
      scoopMid: "#1d4ed8",
      scoopEnd: "#2563eb",
      scoopStroke: "#1e40af",
      glowStart: "#60a5fa",
      glowMid: "#2563eb",
      glowEnd: "#1e3a8a",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(96,165,250,0.24), transparent 42%), linear-gradient(135deg, #1e3a8a, #1d4ed8 58%, #2563eb)",
      mobileBorderColor: "rgba(147,197,253,0.25)",
      mobileShadow: "0 10px 26px rgba(30,58,138,0.24)",
    };
  }

  if (moduleKey === "events") {
    return {
      scoopStart: "#4c1d95",
      scoopMid: "#6d28d9",
      scoopEnd: "#7c3aed",
      scoopStroke: "#5b21b6",
      glowStart: "#c4b5fd",
      glowMid: "#8b5cf6",
      glowEnd: "#4c1d95",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(196,181,253,0.24), transparent 42%), linear-gradient(135deg, #4c1d95, #6d28d9 58%, #7c3aed)",
      mobileBorderColor: "rgba(196,181,253,0.25)",
      mobileShadow: "0 10px 26px rgba(76,29,149,0.24)",
    };
  }

  if (moduleKey === "watchdog") {
    return {
      scoopStart: "#7f1d1d",
      scoopMid: "#b91c1c",
      scoopEnd: "#dc2626",
      scoopStroke: "#991b1b",
      glowStart: "#fca5a5",
      glowMid: "#ef4444",
      glowEnd: "#7f1d1d",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(252,165,165,0.22), transparent 42%), linear-gradient(135deg, #7f1d1d, #b91c1c 58%, #dc2626)",
      mobileBorderColor: "rgba(252,165,165,0.24)",
      mobileShadow: "0 10px 26px rgba(127,29,29,0.24)",
    };
  }

  if (moduleKey === "webmaster") {
    return {
      scoopStart: "#312e81",
      scoopMid: "#4f46e5",
      scoopEnd: "#6366f1",
      scoopStroke: "#3730a3",
      glowStart: "#c7d2fe",
      glowMid: "#818cf8",
      glowEnd: "#312e81",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(199,210,254,0.24), transparent 42%), linear-gradient(135deg, #312e81, #4f46e5 58%, #6366f1)",
      mobileBorderColor: "rgba(199,210,254,0.25)",
      mobileShadow: "0 10px 26px rgba(49,46,129,0.24)",
    };
  }

  if (moduleKey === "hrm") {
    return {
      scoopStart: "#115e59",
      scoopMid: "#0f766e",
      scoopEnd: "#0d9488",
      scoopStroke: "#0f766e",
      glowStart: "#99f6e4",
      glowMid: "#2dd4bf",
      glowEnd: "#115e59",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(153,246,228,0.22), transparent 42%), linear-gradient(135deg, #115e59, #0f766e 58%, #0d9488)",
      mobileBorderColor: "rgba(153,246,228,0.22)",
      mobileShadow: "0 10px 26px rgba(17,94,89,0.24)",
    };
  }

  if (moduleKey === "oshareview") {
    return {
      scoopStart: "#0e7490",
      scoopMid: "#0891b2",
      scoopEnd: "#06b6d4",
      scoopStroke: "#0e7490",
      glowStart: "#a5f3fc",
      glowMid: "#22d3ee",
      glowEnd: "#0e7490",
      mobileGradient: "radial-gradient(circle at 8% 0%, rgba(165,243,252,0.24), transparent 42%), linear-gradient(135deg, #0e7490, #0891b2 58%, #06b6d4)",
      mobileBorderColor: "rgba(165,243,252,0.24)",
      mobileShadow: "0 10px 26px rgba(14,116,144,0.24)",
    };
  }

  if (donorChromeTint) {
    return {
      scoopStart: donorChromeTint.dark,
      scoopMid: donorChromeTint.mid,
      scoopEnd: donorChromeTint.base,
      scoopStroke: donorChromeTint.mid,
      glowStart: donorChromeTint.light,
      glowMid: donorChromeTint.base,
      glowEnd: donorChromeTint.dark,
      mobileGradient: `radial-gradient(circle at 8% 0%, ${donorChromeTint.light}24, transparent 42%), linear-gradient(135deg, ${donorChromeTint.dark}, ${donorChromeTint.mid} 58%, ${donorChromeTint.base})`,
      mobileBorderColor: donorChromeTint.border,
      mobileShadow: `0 8px 20px rgba(${donorChromeTint.shadowRgb}, 0.15)`,
    };
  }

  return {
    scoopStart: "#013a31",
    scoopMid: "#0a6b58",
    scoopEnd: "#10a886",
    scoopStroke: "#0d806b",
    glowStart: "#6ee7c4",
    glowMid: "#22c597",
    glowEnd: "#075a48",
    mobileGradient: "radial-gradient(circle at 8% 0%, rgba(110,231,196,0.28), transparent 42%), linear-gradient(135deg, #013a31, #0a6b58 58%, #10a886)",
    mobileBorderColor: "rgba(167,243,208,0.18)",
    mobileShadow: "0 10px 26px rgba(6,78,59,0.20)",
  };
}

/** Resolves the module home href used by topbar brand links and workspace jumps. */
export function resolveTopBarHomeHref(moduleKey: TopBarModuleKey): string {
  if (moduleKey === "compassion") return "/compassion/dashboard";
  if (moduleKey === "events") return "/events/events";
  if (moduleKey === "watchdog") return "/watchdog";
  if (moduleKey === "webmaster") return "/webmaster";
  if (moduleKey === "hrm") return "/hrm";
  if (moduleKey === "oshareview") return "/reports";
  return "/";
}

/** Resolves workspace switcher visual tokens by module and scroll state. */
export function resolveModuleSwitcherTone(moduleKey: TopBarModuleKey, scrolled: boolean): ModuleSwitcherTone {
  const baseTone = moduleKey === "donor"
    ? {
      glow: "from-emerald-300/16 via-emerald-200/8 to-transparent",
      button: scrolled
        ? "border-white/20 bg-emerald-950/30 text-emerald-50 shadow-[0_6px_16px_rgba(2,8,23,0.3)]"
        : "border-white/20 bg-emerald-950/32 text-emerald-50 shadow-[0_8px_20px_rgba(2,8,23,0.32)]",
      activeItem: "border-emerald-200/35 bg-emerald-50/55",
    }
    : {
      glow: "from-slate-200/50 via-slate-100/40 to-transparent",
      button: scrolled
        ? "border-slate-300/90 bg-white text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
        : "border-slate-300/90 bg-white text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.1)]",
      activeItem: "border-slate-300 bg-slate-50",
    };

  const accentTone = moduleKey === "compassion"
    ? {
      activeIcon: "border-blue-200 bg-blue-50 text-blue-700",
      activePill: "bg-blue-100 text-blue-700",
    }
    : moduleKey === "events"
      ? {
        activeIcon: "border-amber-200 bg-amber-50 text-amber-700",
        activePill: "bg-amber-100 text-amber-700",
      }
      : {
        activeIcon: "border-emerald-200 bg-emerald-50 text-emerald-700",
        activePill: "bg-emerald-100 text-emerald-700",
      };

  return {
    ...baseTone,
    ...accentTone,
  };
}
