/** Source requirements for insights that consume the dashboard's shared metrics. */
const SUMMARY_WIDGETS = new Set([
  "at-a-glance", "donor-pipeline", "actionable-insights", "revenue", "goal-health",
  "donation-velocity", "fundraising-forecast", "engagement-pulse", "stewardship-attention",
  "workflow-pressure", "follow-up-capacity", "weekly-stats",
]);
const RETENTION_WIDGETS = new Set(["at-a-glance", "retention", "workflow-pressure"]);

export function unavailableWidgetSource(id: string, summaryAvailable: boolean, retentionAvailable: boolean): string | null {
  if (SUMMARY_WIDGETS.has(id) && !summaryAvailable) return "Summary metrics";
  if (RETENTION_WIDGETS.has(id) && !retentionAvailable) return "Donor retention";
  return null;
}
