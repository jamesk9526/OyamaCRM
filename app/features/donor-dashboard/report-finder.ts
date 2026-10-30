import { REPORTS, type ReportDefinition } from "./report-catalog";

const ignored = new Set(["a", "an", "the", "of", "by", "for", "to", "and", "me", "show", "find", "report", "reports", "please", "chart", "charts", "graph", "graphs"]);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Search only real, supported report definitions; never execute a free-form data command. */
export function findDonorReports(query: string): ReportDefinition[] {
  const words = normalize(query).split(/\s+/);
  const visualOnly = words.some((word) => ["chart", "charts", "graph", "graphs"].includes(word));
  const terms = words.filter((word) => word && !ignored.has(word));
  const matches = REPORTS.filter((report) => {
    if (visualOnly && !report.capabilities.includes("Visual")) return false;
    const text = normalize(`${report.key} ${report.title} ${report.description} ${report.source}`);
    return terms.every((term) => text.includes(term));
  });
  return matches.sort((a, b) => {
    const score = (report: ReportDefinition) => terms.reduce((sum, term) => sum + (normalize(report.title).includes(term) ? 2 : 0), 0);
    return score(b) - score(a);
  });
}

export function donorReportHref(report: ReportDefinition, visual: boolean, period?: { basis: string; year: number; from: string; through: string }): string {
  const query = new URLSearchParams({ report: report.key });
  if (visual && report.capabilities.includes("Visual")) query.set("view", "visual");
  if (period) {
    query.set("dateBasis", period.basis);
    if (report.scope === "date") { query.set("from", period.from.slice(0, 10)); query.set("through", period.through.slice(0, 10)); }
    if (report.scope === "year") query.set("year", String(period.year));
    // Annual tax statements explicitly use calendar years, even in fiscal dashboards.
    if (report.scope === "calendar-year") { query.set("dateBasis", "calendar"); query.set("year", period.through.slice(0, 4)); }
  }
  return `/reports?${query}`;
}
