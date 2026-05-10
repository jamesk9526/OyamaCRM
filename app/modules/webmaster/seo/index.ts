/** SEO module contracts for metadata and checks. */
export interface SeoIssue {
  id: string;
  severity: "critical" | "warning" | "suggestion";
  title: string;
  message: string;
}

export interface SeoModule {
  runPageChecks: (pageId: string) => Promise<SeoIssue[]>;
}
