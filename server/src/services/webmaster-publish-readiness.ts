/** Computes publish-readiness checks for OyamaWebMaster sites and draft pages. */
import type { WebmasterPageRecord, WebmasterSiteRecord } from "./webmaster-store.js";

export type WebmasterReadinessStatus = "Working" | "Partially Working" | "Broken" | "Not Implemented";

export interface WebmasterPublishReadinessCheck {
  id: string;
  label: string;
  status: WebmasterReadinessStatus;
  detail: string;
}

export interface WebmasterDraftDeltaSummary {
  newPages: number;
  updatedPages: number;
  removedPages: number;
  unchangedPages: number;
  totalDraftCandidates: number;
}

export interface WebmasterDraftDeltaItem {
  id: string;
  title: string;
  path: string;
  changeType: "NEW" | "UPDATED" | "REMOVED";
  updatedAt: string | null;
  currentStatus: string | null;
  previousStatus: string | null;
}

export interface WebmasterPublishReadinessReport {
  status: WebmasterReadinessStatus;
  summary: string;
  checks: WebmasterPublishReadinessCheck[];
  preflightPassed: boolean;
  pagesMissingSeo: Array<{ id: string; title: string; path: string }>;
  pagesWithInvalidPath: Array<{ id: string; title: string; path: string }>;
  draftChangesSinceLastPublish: number;
  draftDeltaSummary: WebmasterDraftDeltaSummary;
  draftDeltaItems: WebmasterDraftDeltaItem[];
  previewLink: string | null;
  publishExecutionStatus: "Not Implemented" | "Working";
  rollbackStatus: "Not Implemented" | "Working";
  lastPublishedVersionId: string | null;
  lastPublishedAt: string | null;
}

/** Validates a page path shape for publish safety checks. */
export function isValidWebmasterPagePath(path: string): boolean {
  if (!path || !path.startsWith("/")) return false;
  if (path.includes(" ")) return false;
  if (!/^\/[a-zA-Z0-9\-/_~.]*$/.test(path)) return false;
  if (path.includes("//")) return false;
  return true;
}

function summarizeReport(status: WebmasterReadinessStatus, checks: WebmasterPublishReadinessCheck[]): string {
  const broken = checks.filter((check) => check.status === "Broken").length;
  const partial = checks.filter((check) => check.status === "Partially Working").length;
  const notImplemented = checks.filter((check) => check.status === "Not Implemented").length;

  if (status === "Working") {
    return "Site is ready for publish preflight and snapshot publishing workflow.";
  }

  if (status === "Broken") {
    return `${broken} blocking issue(s) must be fixed before publish setup can pass.`;
  }

  if (status === "Not Implemented") {
    return `${notImplemented} readiness lane(s) are not implemented yet.`;
  }

  return `${partial + notImplemented} readiness lane(s) need attention before final publish handoff.`;
}

function pickOverallStatus(checks: WebmasterPublishReadinessCheck[]): WebmasterReadinessStatus {
  if (checks.some((check) => check.status === "Broken")) return "Broken";
  if (checks.some((check) => check.status === "Partially Working")) return "Partially Working";
  if (checks.some((check) => check.status === "Not Implemented")) return "Partially Working";
  return "Working";
}

/** Builds page-level draft deltas between the current site pages and last published snapshot. */
function buildDraftDelta(params: {
  pages: WebmasterPageRecord[];
  previousPublishedPages: WebmasterPageRecord[];
  lastPublishedAt: string | null;
}): {
  summary: WebmasterDraftDeltaSummary;
  items: WebmasterDraftDeltaItem[];
} {
  const { pages, previousPublishedPages, lastPublishedAt } = params;

  const items: WebmasterDraftDeltaItem[] = [];
  let unchangedPages = 0;
  const previousById = new Map(previousPublishedPages.map((page) => [page.id, page]));
  const currentById = new Map(pages.map((page) => [page.id, page]));
  const lastPublishedMs = lastPublishedAt ? new Date(lastPublishedAt).getTime() : null;

  if (previousPublishedPages.length === 0) {
    for (const page of pages) {
      if (page.status === "ARCHIVED") continue;
      items.push({
        id: page.id,
        title: page.title,
        path: page.path,
        changeType: "NEW",
        updatedAt: page.updatedAt,
        currentStatus: page.status,
        previousStatus: null,
      });
    }
  } else {
    for (const page of pages) {
      const previousPage = previousById.get(page.id);

      if (!previousPage) {
        items.push({
          id: page.id,
          title: page.title,
          path: page.path,
          changeType: "NEW",
          updatedAt: page.updatedAt,
          currentStatus: page.status,
          previousStatus: null,
        });
        continue;
      }

      const changedAfterPublish = lastPublishedMs !== null
        ? new Date(page.updatedAt).getTime() > lastPublishedMs
        : false;

      const metadataChanged = page.status !== previousPage.status
        || page.title !== previousPage.title
        || page.slug !== previousPage.slug
        || page.path !== previousPage.path
        || (page.seoTitle ?? "") !== (previousPage.seoTitle ?? "")
        || (page.seoDescription ?? "") !== (previousPage.seoDescription ?? "");

      if (!changedAfterPublish && !metadataChanged) {
        unchangedPages += 1;
        continue;
      }

      items.push({
        id: page.id,
        title: page.title,
        path: page.path,
        changeType: "UPDATED",
        updatedAt: page.updatedAt,
        currentStatus: page.status,
        previousStatus: previousPage.status,
      });
    }

    for (const previousPage of previousPublishedPages) {
      if (currentById.has(previousPage.id)) continue;
      items.push({
        id: previousPage.id,
        title: previousPage.title,
        path: previousPage.path,
        changeType: "REMOVED",
        updatedAt: null,
        currentStatus: null,
        previousStatus: previousPage.status,
      });
    }
  }

  const changeOrder: Record<WebmasterDraftDeltaItem["changeType"], number> = {
    UPDATED: 0,
    NEW: 1,
    REMOVED: 2,
  };

  items.sort((left, right) => {
    const byType = changeOrder[left.changeType] - changeOrder[right.changeType];
    if (byType !== 0) return byType;

    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightTime - leftTime;
  });

  const summary: WebmasterDraftDeltaSummary = {
    newPages: items.filter((item) => item.changeType === "NEW").length,
    updatedPages: items.filter((item) => item.changeType === "UPDATED").length,
    removedPages: items.filter((item) => item.changeType === "REMOVED").length,
    unchangedPages,
    totalDraftCandidates: items.length,
  };

  return { summary, items };
}

/** Builds publish readiness with strict preflight requirements and honest implementation flags. */
export function buildWebmasterPublishReadinessReport(input: {
  site: WebmasterSiteRecord;
  pages: WebmasterPageRecord[];
  previousPublishedPages?: WebmasterPageRecord[];
}): WebmasterPublishReadinessReport {
  const { site, pages } = input;
  const previousPublishedPages = Array.isArray(input.previousPublishedPages) ? input.previousPublishedPages : [];
  const checks: WebmasterPublishReadinessCheck[] = [];

  const homePage = pages.find((page) => page.path === "/");
  const pagesMissingSeo = pages
    .filter((page) => !page.seoTitle?.trim() || !page.seoDescription?.trim())
    .map((page) => ({ id: page.id, title: page.title, path: page.path }));

  const pagesWithInvalidPath = pages
    .filter((page) => !isValidWebmasterPagePath(page.path))
    .map((page) => ({ id: page.id, title: page.title, path: page.path }));

  const domainConfigured = Boolean(site.domain?.trim() || site.publishingTarget?.trim());
  const siteArchived = site.status === "ARCHIVED";

  checks.push({
    id: "site-not-archived",
    label: "Site is not archived",
    status: siteArchived ? "Broken" : "Working",
    detail: siteArchived
      ? "Archived sites cannot move through publish setup until restored."
      : "Site lifecycle status allows publish setup.",
  });

  checks.push({
    id: "pages-exist",
    label: "At least one page exists",
    status: pages.length > 0 ? "Working" : "Broken",
    detail: pages.length > 0
      ? `${pages.length} page(s) found for this site.`
      : "Create at least one page before publish setup.",
  });

  checks.push({
    id: "home-page",
    label: "Home page is present",
    status: homePage ? "Working" : "Broken",
    detail: homePage
      ? `Home page found: ${homePage.title} (${homePage.path}).`
      : "A page with path / is required.",
  });

  checks.push({
    id: "seo-required-fields",
    label: "SEO title and description are set",
    status: pagesMissingSeo.length === 0 ? "Working" : "Broken",
    detail: pagesMissingSeo.length === 0
      ? "All pages have SEO title and description."
      : `${pagesMissingSeo.length} page(s) are missing SEO title or description.`,
  });

  checks.push({
    id: "page-paths-valid",
    label: "Page paths are valid",
    status: pagesWithInvalidPath.length === 0 ? "Working" : "Broken",
    detail: pagesWithInvalidPath.length === 0
      ? "All page paths passed path validation."
      : `${pagesWithInvalidPath.length} page path(s) are invalid for publishing.`,
  });

  checks.push({
    id: "target-configured",
    label: "Domain or publish target is configured",
    status: domainConfigured ? "Working" : "Partially Working",
    detail: domainConfigured
      ? "Domain or publish target profile is configured."
      : "Configure a domain or publishing target profile before production publish.",
  });

  checks.push({
    id: "publish-execution",
    label: "Publish execution adapter",
    status: "Working",
    detail: "Publish execution is enabled with immutable version snapshots and explicit confirmation.",
  });

  checks.push({
    id: "rollback-history",
    label: "Rollback execution",
    status: "Working",
    detail: site.publishedVersionId
      ? "Rollback endpoint is available for saved publish versions."
      : "Rollback endpoint is available. Create at least one publish version to use rollback.",
  });

  const lastPublishedAt = site.lastPublishedAt;
  const draftDelta = buildDraftDelta({
    pages,
    previousPublishedPages,
    lastPublishedAt,
  });
  const draftChangesSinceLastPublish = draftDelta.summary.totalDraftCandidates;

  const preflightChecks = checks.filter(
    (check) => check.id !== "publish-execution" && check.id !== "rollback-history",
  );
  const preflightPassed = preflightChecks.every((check) => check.status !== "Broken");

  const previewPage = homePage ?? pages[0] ?? null;
  const previewLink = previewPage ? `/webmaster/preview/${site.id}/${previewPage.id}?draft=1` : null;
  const status = pickOverallStatus(checks);

  return {
    status,
    summary: summarizeReport(status, checks),
    checks,
    preflightPassed,
    pagesMissingSeo,
    pagesWithInvalidPath,
    draftChangesSinceLastPublish,
    draftDeltaSummary: draftDelta.summary,
    draftDeltaItems: draftDelta.items,
    previewLink,
    publishExecutionStatus: "Working",
    rollbackStatus: "Working",
    lastPublishedVersionId: site.publishedVersionId,
    lastPublishedAt,
  };
}
