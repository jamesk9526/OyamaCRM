import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";

export interface SupportTicketContext {
  crmScope: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "reportit" | "other" | "unknown";
  pageUrl: string;
  routePath: string;
  pageTitle: string;
  browserInfo: string;
  deviceInfo: string;
  appVersion: string;
  environment: string;
}

function scopeForModule(moduleKey: TopBarModuleKey): SupportTicketContext["crmScope"] {
  if (moduleKey === "donor" || moduleKey === "letters") return "donor";
  if (moduleKey === "compassion") return "compassion";
  if (moduleKey === "events") return "events";
  if (moduleKey === "watchdog") return "watchdog";
  if (moduleKey === "webmaster") return "webmaster";
  if (moduleKey === "oshareview") return "reportit";
  if (moduleKey === "password") return "other";
  return "unknown";
}

/** Collects compact diagnostics for a support request without reading form values or user input. */
export function getSupportTicketContext({ moduleKey, pathname }: { moduleKey: TopBarModuleKey; pathname: string }): SupportTicketContext {
  const href = typeof window !== "undefined" ? window.location.href : "";
  const browser = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : "unknown";
  const device = typeof navigator !== "undefined" && typeof window !== "undefined"
    ? `${navigator.platform || "unknown"}; viewport=${window.innerWidth}x${window.innerHeight}; dpr=${window.devicePixelRatio || 1}`.slice(0, 380)
    : "unknown";

  return {
    crmScope: scopeForModule(moduleKey),
    pageUrl: href || `https://oyamacrm.local${pathname || "/"}`,
    routePath: pathname || "/",
    pageTitle: typeof document !== "undefined" ? document.title || "Untitled page" : "Untitled page",
    browserInfo: `${browser}; language=${typeof navigator !== "undefined" ? navigator.language : "unknown"}`.slice(0, 380),
    deviceInfo: device,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    environment: process.env.NODE_ENV ?? "development",
  };
}