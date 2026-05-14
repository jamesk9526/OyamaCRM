/**
 * Browser-driven DonorCRM QA pass.
 * Captures route health metrics across desktop/laptop/tablet/mobile and writes screenshot artifacts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3000";
const screenshotDir = path.resolve("docs/screenshots/donor-crm/2026-05-13");
const reportDir = path.resolve("docs/modules/donor-crm");
const metricsPath = path.join(reportDir, "browser-qa-metrics-2026-05-13.json");

const credentials = {
  email: process.env.QA_EMAIL ?? "admin@hopefoundation.org",
  password: process.env.QA_PASSWORD ?? "admin123!",
};

const fallbackDetailIds = {
  constituentId: process.env.QA_CONSTITUENT_ID ?? "con_02",
  campaignId: process.env.QA_CAMPAIGN_ID ?? "cmp4h4re80005ocg8f54g6z2w",
};

const routeChecks = [
  { id: "dashboard", path: "/", desktopShot: "donor-dashboard-desktop.png", mobileShot: "donor-dashboard-mobile.png" },
  { id: "constituents", path: "/constituents", desktopShot: "constituents-list-desktop.png", mobileShot: "constituents-list-mobile.png" },
  { id: "donations", path: "/donations", desktopShot: "donations-list-desktop.png", mobileShot: "donations-list-mobile.png" },
  { id: "donationForm", path: "/donations/new", desktopShot: "donation-form-desktop.png" },
  { id: "campaigns", path: "/campaigns", desktopShot: "campaigns-list-desktop.png", mobileShot: "campaigns-list-mobile.png" },
  { id: "grants", path: "/grants", desktopShot: "grants-workspace-desktop.png" },
  { id: "tasks", path: "/tasks", desktopShot: "tasks-workspace-desktop.png" },
  { id: "meetings", path: "/meetings", desktopShot: "meetings-workspace-desktop.png" },
  { id: "communications", path: "/communications", desktopShot: "communications-workspace-desktop.png", mobileShot: "communications-workspace-mobile.png" },
  { id: "letters", path: "/letters-printables", desktopShot: "letters-printables-desktop.png", mobileShot: "letters-printables-mobile.png" },
  { id: "automations", path: "/automations", desktopShot: "steward-paths-automations-desktop.png", mobileShot: "steward-paths-automations-mobile.png" },
  { id: "signals", path: "/steward-signals", desktopShot: "steward-signals-desktop.png" },
  { id: "reports", path: "/reports", desktopShot: "reports-desktop.png", mobileShot: "reports-mobile.png" },
  { id: "dataTools", path: "/data-tools", desktopShot: "data-tools-desktop.png" },
  { id: "importTools", path: "/data-tools/import", desktopShot: "data-tools-import-desktop.png", mobileShot: "data-tools-import-mobile.png" },
  { id: "volunteers", path: "/volunteers", desktopShot: "volunteers-desktop.png" },
  { id: "customFields", path: "/custom-fields", desktopShot: "custom-fields-desktop.png" },
  { id: "payments", path: "/payments", desktopShot: "payments-desktop.png" },
  { id: "settings", path: "/settings", desktopShot: "settings-desktop.png", mobileShot: "settings-mobile.png" },
  { id: "pluginSettings", path: "/settings/plugins", desktopShot: "settings-plugins-desktop.png" },
];

const viewports = [
  { id: "desktop-1440", context: { viewport: { width: 1440, height: 900 } } },
  { id: "laptop-1280", context: { viewport: { width: 1280, height: 800 } } },
  { id: "tablet-768", context: { viewport: { width: 768, height: 1024 } } },
  { id: "mobile-390", context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

function detectPageFlags(bodyText) {
  const normalized = bodyText.toLowerCase();
  return {
    hasErrorText: /application error|internal server error|something went wrong|not found/.test(normalized),
    hasInDevelopmentNotice: /in development|not implemented|demo only|coming soon/.test(normalized),
  };
}

async function ensureLoggedIn(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!page.url().includes("/login")) return;

  const email = page.locator('input[type="email"], input[placeholder*="organization"], input[placeholder*="Email"]');
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
    // Keep going and let route checks capture auth failures explicitly.
  }
}

async function waitForSettled(page) {
  await page.waitForTimeout(1200);
}

async function screenshotIfNeeded(page, viewportId, shotName) {
  if (!shotName) return;
  const shouldCaptureDesktop = viewportId === "desktop-1440";
  const shouldCaptureMobile = viewportId === "mobile-390";
  if (!shouldCaptureDesktop && !shouldCaptureMobile) return;

  const outPath = path.join(screenshotDir, shotName);
  await page.screenshot({ path: outPath, fullPage: true });
}

async function captureDetailPages(page, viewportId, runResults) {
  if (viewportId !== "desktop-1440") return;

  await page.goto(`${baseUrl}/constituents`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);
  const constituentHref = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/constituents/"]'));
    const item = anchors.find((node) => {
      const href = node.getAttribute("href") || "";
      return /^\/constituents\/[^/]+$/.test(href) && href !== "/constituents/new";
    });
    return item?.getAttribute("href") || null;
  });
  const resolvedConstituentHref = constituentHref || `/constituents/${encodeURIComponent(fallbackDetailIds.constituentId)}`;
  try {
    await page.goto(`${baseUrl}${resolvedConstituentHref}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForSettled(page);
    await page.screenshot({ path: path.join(screenshotDir, "constituent-profile-desktop.png"), fullPage: true });
    runResults.push({
      viewport: viewportId,
      route: resolvedConstituentHref,
      id: "constituentProfile",
      ok: true,
      note: constituentHref ? "Captured from discovered list link" : `Captured using fallback constituent id ${fallbackDetailIds.constituentId}`,
    });
  } catch (error) {
    runResults.push({
      viewport: viewportId,
      route: resolvedConstituentHref,
      id: "constituentProfile",
      ok: false,
      note: error instanceof Error ? error.message : "Failed to capture constituent profile",
    });
  }

  await page.goto(`${baseUrl}/campaigns`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);
  const campaignHref = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/campaigns/"]'));
    const item = anchors.find((node) => {
      const href = node.getAttribute("href") || "";
      return /^\/campaigns\/[^/]+$/.test(href);
    });
    return item?.getAttribute("href") || null;
  });
  const resolvedCampaignHref = campaignHref || `/campaigns/${encodeURIComponent(fallbackDetailIds.campaignId)}`;
  try {
    await page.goto(`${baseUrl}${resolvedCampaignHref}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForSettled(page);
    await page.screenshot({ path: path.join(screenshotDir, "campaign-detail-desktop.png"), fullPage: true });
    runResults.push({
      viewport: viewportId,
      route: resolvedCampaignHref,
      id: "campaignDetail",
      ok: true,
      note: campaignHref ? "Captured from discovered list link" : `Captured using fallback campaign id ${fallbackDetailIds.campaignId}`,
    });
  } catch (error) {
    runResults.push({
      viewport: viewportId,
      route: resolvedCampaignHref,
      id: "campaignDetail",
      ok: false,
      note: error instanceof Error ? error.message : "Failed to capture campaign detail",
    });
  }

  await page.goto(`${baseUrl}/steward-paths/builder`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);
  await page.screenshot({ path: path.join(screenshotDir, "steward-paths-builder-desktop.png"), fullPage: true });

  await page.goto(`${baseUrl}/communications`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);
  const campaignId = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href^="/communications/"]')).find((node) => {
      const href = node.getAttribute("href") || "";
      return /^\/communications\/.+/.test(href);
    });
    if (!link) return null;
    const href = link.getAttribute("href") || "";
    return href.split("/").filter(Boolean).at(-1) ?? null;
  });

  const emailBuilderPath = campaignId
    ? `/email-builder?campaign=${encodeURIComponent(campaignId)}&returnTo=${encodeURIComponent(`/communications/${campaignId}`)}`
    : "/email-builder";
  await page.goto(`${baseUrl}${emailBuilderPath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);
  await page.screenshot({ path: path.join(screenshotDir, "email-builder-desktop.png"), fullPage: true });

  runResults.push({ viewport: viewportId, route: emailBuilderPath, id: "emailBuilder", ok: true });
}

async function collectPageMetrics(page, routeDef) {
  const response = await page.goto(`${baseUrl}${routeDef.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForSettled(page);

  const metrics = await page.evaluate(() => {
    const heading = document.querySelector("h1, h2")?.textContent?.trim() ?? "";
    const bodyText = document.body?.innerText ?? "";
    return {
      heading,
      bodyPreview: bodyText.slice(0, 8000),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  const flags = detectPageFlags(metrics.bodyPreview);
  const quickChecks = {
    hasPrimaryButton: /new|create|add|record|run|open|generate|save/i.test(metrics.bodyPreview),
    hasLoadingText: /loading/i.test(metrics.bodyPreview),
    hasEmptyState: /no .* yet|no .* found|start by|create your first/i.test(metrics.bodyPreview.toLowerCase()),
  };

  return {
    status: response?.status() ?? null,
    route: routeDef.path,
    heading: metrics.heading,
    innerWidth: metrics.innerWidth,
    innerHeight: metrics.innerHeight,
    scrollWidth: metrics.scrollWidth,
    scrollHeight: metrics.scrollHeight,
    overflowX: metrics.overflowX,
    hasErrorText: flags.hasErrorText,
    hasInDevelopmentNotice: flags.hasInDevelopmentNotice,
    hasPrimaryButton: quickChecks.hasPrimaryButton,
    hasLoadingText: quickChecks.hasLoadingText,
    hasEmptyState: quickChecks.hasEmptyState,
  };
}

async function run() {
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  for (const viewport of viewports) {
    const context = await browser.newContext(viewport.context);
    const page = await context.newPage();

    await ensureLoggedIn(page);

    const viewportResults = [];
    for (const routeDef of routeChecks) {
      try {
        const row = await collectPageMetrics(page, routeDef);
        row.viewport = viewport.id;
        row.id = routeDef.id;
        viewportResults.push(row);

        const shotName = viewport.id === "desktop-1440" ? routeDef.desktopShot : routeDef.mobileShot;
        await screenshotIfNeeded(page, viewport.id, shotName);
      } catch (error) {
        viewportResults.push({
          viewport: viewport.id,
          id: routeDef.id,
          route: routeDef.path,
          status: null,
          error: String(error),
        });
      }
    }

    try {
      await captureDetailPages(page, viewport.id, viewportResults);
    } catch (error) {
      viewportResults.push({ viewport: viewport.id, id: "detailCapture", route: "mixed", status: null, error: String(error) });
    }

    allResults.push(...viewportResults);
    await context.close();
  }

  await browser.close();

  const payload = {
    generatedAtUtc: new Date().toISOString(),
    baseUrl,
    screenshotsDir: screenshotDir,
    totalChecks: allResults.length,
    checks: allResults,
  };

  await fs.writeFile(metricsPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote metrics to ${metricsPath}`);
  console.log(`Captured screenshots in ${screenshotDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
