// Builds a privacy-safe feedback context payload from current browser and route state.

import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import type { FeedbackContextPayload, FeedbackCrmScope } from "@/app/components/feedback/types";

/** Maps one topbar module key to the CRM scope values accepted by feedback ticketing APIs. */
function mapModuleToFeedbackScope(moduleKey: TopBarModuleKey): FeedbackCrmScope {
  if (moduleKey === "donor") return "donor";
  if (moduleKey === "compassion") return "compassion";
  if (moduleKey === "events") return "events";
  if (moduleKey === "watchdog") return "watchdog";
  if (moduleKey === "webmaster") return "webmaster";
  if (moduleKey === "hrm") return "hrm";
  if (moduleKey === "reportit") return "reportit";
  return "unknown";
}

/** Reads one concise browser descriptor while avoiding sensitive per-user values. */
function readBrowserDescriptor(): string {
  if (typeof navigator === "undefined") return "unknown";
  return navigator.userAgent.slice(0, 380);
}

/** Reads one concise device descriptor for ticket troubleshooting context. */
function readDeviceDescriptor(): string {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "unknown";
  const platform = navigator.platform || "unknown";
  return `${platform}; viewport=${window.innerWidth}x${window.innerHeight}`.slice(0, 380);
}

/**
 * Creates a lightweight context payload for one feedback submission.
 * This intentionally omits keystrokes, form field values, and any full DOM capture.
 */
export function getFeedbackContext(params: {
  moduleKey: TopBarModuleKey;
  pathname: string;
}): FeedbackContextPayload {
  const href = typeof window !== "undefined" ? window.location.href : "";
  const pageTitle = typeof document !== "undefined" ? document.title : "";

  return {
    crmScope: mapModuleToFeedbackScope(params.moduleKey),
    pageUrl: href || `https://oyamacrm.local${params.pathname || "/"}`,
    routePath: params.pathname || "/",
    pageTitle: pageTitle || "Untitled page",
    browserInfo: readBrowserDescriptor(),
    deviceInfo: readDeviceDescriptor(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    environment: process.env.NODE_ENV ?? "development",
  };
}
