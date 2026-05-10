/** Preflight module checks export/publish readiness. */
export interface PreflightIssue {
  id: string;
  severity: "critical" | "warning" | "suggestion";
  scope: "site" | "page" | "section" | "block" | "asset" | "form";
  targetId: string;
  title: string;
  message: string;
}

export interface PreflightModule {
  runSiteChecks: (siteId: string) => Promise<PreflightIssue[]>;
}
