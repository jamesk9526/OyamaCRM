/**
 * Browser-driven responsive UI audit for compact laptops, tablets, and mobile widths.
 * Captures overflow/topbar/rail metrics and writes report artifacts plus key screenshots.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3000";
const screenshotDir = path.resolve("docs/screenshots/responsive-ui/2026-05-14");
const reportDir = path.resolve("docs/status");
const reportJsonPath = path.join(reportDir, "responsive-ui-audit.json");
const reportMdPath = path.join(reportDir, "responsive-ui-audit.md");

const credentials = {
  email: process.env.QA_EMAIL ?? "admin@hopefoundation.org",
  password: process.env.QA_PASSWORD ?? "admin123!",
};

const fallbackIds = {
  constituentId: process.env.QA_CONSTITUENT_ID ?? "con_02",
};

const viewports = [
  { id: "1024x768", width: 1024, height: 768 },
  { id: "1180x720", width: 1180, height: 720 },
  { id: "1280x720", width: 1280, height: 720 },
  { id: "1280x800", width: 1280, height: 800 },
  { id: "1366x768", width: 1366, height: 768 },
  { id: "1440x900", width: 1440, height: 900 },
  { id: "1536x864", width: 1536, height: 864 },
  { id: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
  { id: "768x1024", width: 768, height: 1024, isMobile: true, hasTouch: true },
];

const routes = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "constituents", label: "Constituents", path: "/constituents" },
  { id: "constituent-detail", label: "Constituent Detail", resolver: resolveConstituentDetailRoute },
  { id: "donations", label: "Donations", path: "/donations" },
  { id: "communications", label: "Communications", path: "/communications" },
  { id: "letters-printables", label: "Letters & Printables", path: "/letters-printables" },
  { id: "steward-signals", label: "Steward Signals", path: "/steward-signals" },
  { id: "steward-paths", label: "Steward Paths", path: "/steward-paths" },
  { id: "steward-paths-builder", label: "Steward Paths Builder", path: "/steward-paths/builder" },
  { id: "reports", label: "Reports", path: "/reports" },
  { id: "system-status", label: "System Status", path: "/settings/system-status" },
  { id: "webmaster-editor", label: "Webmaster Editor", path: "/webmaster/editor" },
  { id: "webmaster-publishing", label: "Webmaster Publishing", path: "/webmaster/publishing" },
  { id: "trivia-app", label: "Trivia App", path: "/apps/trivia" },
];

const screenshotTargets = [
  { routeId: "dashboard", viewportId: "1366x768", fileName: "dashboard-1366x768.png" },
  { routeId: "reports", viewportId: "1366x768", fileName: "reports-1366x768.png" },
  { routeId: "communications", viewportId: "1280x720", fileName: "communications-1280x720.png" },
  { routeId: "steward-signals", viewportId: "1366x768", fileName: "steward-signals-1366x768.png" },
  { routeId: "steward-paths-builder", viewportId: "1280x720", fileName: "steward-paths-builder-1280x720.png" },
  { routeId: "webmaster-editor", viewportId: "1366x768", fileName: "webmaster-editor-1366x768.png" },
];

async function ensureLoggedIn(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!page.url().includes("/login")) return;

  const email = page.locator('input[type="email"], input[placeholder*="Email" i], input[placeholder*="organization" i]');
  const password = page.locator('input[type="password"]');
  const submit = page.getByRole("button", { name: /sign in/i });

  if (await email.count()) {
    await email.first().fill(credentials.email);
  }
  if (await password.count()) {
    await password.first().fill(credentials.password);
  }
  if (await submit.count()) {
    await submit.first().click();
  }

  try {
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 20000 });
  } catch {
    // Let the route audit surface auth failures explicitly.
  }
}

async function waitForSettled(page) {
  await page.waitForTimeout(1200);
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function resolveConstituentDetailRoute(page) {
  await page.goto(`${baseUrl}/constituents`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);

  const discovered = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/constituents/"]'));
    const match = anchors.find((node) => {
      const href = node.getAttribute("href") || "";
      return /^\/constituents\/[^/]+$/.test(href) && href !== "/constituents/new";
    });
    return match?.getAttribute("href") || null;
  });

  return discovered || `/constituents/${encodeURIComponent(fallbackIds.constituentId)}`;
}

function getScreenshotTarget(routeId, viewportId) {
  return screenshotTargets.find((target) => target.routeId === routeId && target.viewportId === viewportId) ?? null;
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const tolerance = 4;
    const topbar = document.querySelector('[data-topbar-root="true"]');
    const workspaceRail = document.querySelector('[data-workspace-control-rail="true"]');
    const workspaceControlsTrigger = document.querySelector('[data-workspace-controls-trigger="true"]');
    const bodyText = document.body?.innerText ?? "";

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0 && rect.width > 0 && rect.height > 0;
    };

    const overflowingContainers = Array.from(document.querySelectorAll("div, section, main, aside, article"))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + tolerance;
      })
      .slice(0, 20)
      .map((element) => {
        const tag = element.tagName.toLowerCase();
        const label = element.getAttribute("aria-label") || element.getAttribute("data-testid") || element.id || "";
        return label ? `${tag}:${label}` : tag;
      });

    const wideTables = Array.from(document.querySelectorAll("table")).filter((table) => {
      if (!(table instanceof HTMLElement)) return false;
      return table.scrollWidth > table.clientWidth + tolerance;
    }).length;

    const sidebar = document.querySelector("aside[data-sidebar-collapsed]");
    const sidebarCollapsed = sidebar?.getAttribute("data-sidebar-collapsed") === "true";

    const topbarHeight = topbar instanceof HTMLElement ? Math.round(topbar.getBoundingClientRect().height) : 0;
    const compactViewport = window.innerWidth >= 1024 && window.innerWidth < 1440;
    const mobileViewport = window.innerWidth < 1024;
    const expectedTopbarMax = mobileViewport ? 120 : compactViewport ? 80 : 72;
    const cumulativeLayoutShift = Number(window.__oyamaCumulativeLayoutShift || 0);

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body?.scrollWidth ?? 0,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + tolerance,
      topbarHeight,
      topbarTooTall: topbarHeight > expectedTopbarMax,
      cumulativeLayoutShift,
      workspaceRailVisible: isVisible(workspaceRail),
      workspaceControlsTriggerVisible: isVisible(workspaceControlsTrigger),
      sidebarCollapsed,
      wideTables,
      overflowingContainers,
      bodyPreview: bodyText.slice(0, 4000),
    };
  });
}

function classifyResult(route, viewport, diagnostics) {
  const issues = [];
  const compactViewport = viewport.width >= 1024 && viewport.width < 1440;
  const fatalMarkers = ["application error", "internal server error", "this page could not be found", "something went wrong"];
  const fatalMarker = fatalMarkers.find((marker) => diagnostics.bodyPreview.toLowerCase().includes(marker));

  if (fatalMarker) issues.push(`fatal:${fatalMarker}`);
  if (diagnostics.hasHorizontalOverflow) issues.push("layout:page-horizontal-overflow");
  if (diagnostics.topbarTooTall) issues.push(`layout:topbar-too-tall:${diagnostics.topbarHeight}`);
  if (diagnostics.cumulativeLayoutShift > 0.1) issues.push(`layout:cumulative-layout-shift:${diagnostics.cumulativeLayoutShift.toFixed(3)}`);
  if (compactViewport && route.id !== "trivia-app" && diagnostics.workspaceRailVisible && !diagnostics.workspaceControlsTriggerVisible) {
    issues.push("layout:rail-did-not-collapse");
  }
  if (compactViewport && !diagnostics.sidebarCollapsed && !route.path?.startsWith("/reports")) {
    issues.push("layout:sidebar-not-collapsed");
  }
  if (diagnostics.wideTables > 0 && diagnostics.overflowingContainers.length === 0) {
    issues.push(`layout:wide-tables-without-scroll-container:${diagnostics.wideTables}`);
  }

  const status = issues.some((issue) => issue.startsWith("fatal") || issue.startsWith("layout:page-horizontal-overflow") || issue === "layout:rail-did-not-collapse")
    ? "fail"
    : issues.length > 0
      ? "warn"
      : "pass";

  return { issues, status };
}

function buildMarkdown(summary, results) {
  const lines = [];
  lines.push("# Responsive UI Audit");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Base URL: ${summary.baseUrl}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Pass: ${summary.totals.pass}`);
  lines.push(`- Warn: ${summary.totals.warn}`);
  lines.push(`- Fail: ${summary.totals.fail}`);
  lines.push(`- Routes checked: ${summary.totals.all}`);
  lines.push("");
  lines.push("## Viewport Summary");
  lines.push("");
  lines.push("| Viewport | Pass | Warn | Fail |");
  lines.push("|---|---:|---:|---:|");

  for (const viewport of summary.byViewport) {
    lines.push(`| ${viewport.id} | ${viewport.pass} | ${viewport.warn} | ${viewport.fail} |`);
  }

  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| Viewport | Route | Status | Issues |");
  lines.push("|---|---|---|---|");

  for (const result of results) {
    const issues = result.issues.length > 0 ? result.issues.join(", ") : "None";
    lines.push(`| ${result.viewport.id} | ${result.route} | ${result.status} | ${issues} |`);
  }

  return `${lines.join("\n")}\n`;
}

async function run() {
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile ?? false,
        hasTouch: viewport.hasTouch ?? false,
      });
      await context.addInitScript(() => {
        window.__oyamaCumulativeLayoutShift = 0;
        if (!("PerformanceObserver" in window)) return;

        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__oyamaCumulativeLayoutShift += entry.value;
            }
          }
        });

        try {
          observer.observe({ type: "layout-shift", buffered: true });
        } catch {
          // Older engines can still run the rest of the responsive audit.
        }
      });
      const page = await context.newPage();

      await ensureLoggedIn(page);

      for (const route of routes) {
        const resolvedPath = route.resolver ? await route.resolver(page) : route.path;
        process.stdout.write(`[responsive-ui] ${viewport.id} ${resolvedPath}\n`);

        try {
          await page.goto(`${baseUrl}${resolvedPath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          await waitForSettled(page);
          const diagnostics = await collectMetrics(page);
          const { issues, status } = classifyResult({ ...route, path: resolvedPath }, viewport, diagnostics);
          const screenshotTarget = getScreenshotTarget(route.id, viewport.id);

          if (screenshotTarget) {
            await page.screenshot({ path: path.join(screenshotDir, screenshotTarget.fileName), fullPage: true });
          }

          results.push({
            route: resolvedPath,
            routeId: route.id,
            label: route.label,
            viewport,
            status,
            issues,
            diagnostics,
            screenshot: screenshotTarget?.fileName ?? null,
          });
        } catch (error) {
          results.push({
            route: resolvedPath,
            routeId: route.id,
            label: route.label,
            viewport,
            status: "fail",
            issues: [error instanceof Error ? `fatal:${error.message}` : "fatal:unknown-navigation-error"],
            diagnostics: null,
            screenshot: null,
          });
        }
      }

      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    totals: {
      all: results.length,
      pass: results.filter((item) => item.status === "pass").length,
      warn: results.filter((item) => item.status === "warn").length,
      fail: results.filter((item) => item.status === "fail").length,
    },
    byViewport: viewports.map((viewport) => ({
      id: viewport.id,
      pass: results.filter((item) => item.viewport.id === viewport.id && item.status === "pass").length,
      warn: results.filter((item) => item.viewport.id === viewport.id && item.status === "warn").length,
      fail: results.filter((item) => item.viewport.id === viewport.id && item.status === "fail").length,
    })),
  };

  await fs.writeFile(reportJsonPath, JSON.stringify({ summary, results }, null, 2), "utf8");
  await fs.writeFile(reportMdPath, buildMarkdown(summary, results), "utf8");

  process.stdout.write(`[responsive-ui] json: ${reportJsonPath}\n`);
  process.stdout.write(`[responsive-ui] markdown: ${reportMdPath}\n`);
  process.stdout.write(`[responsive-ui] totals: ${JSON.stringify(summary.totals)}\n`);

  if (summary.totals.fail > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("[responsive-ui] fatal", error);
  process.exitCode = 1;
});
