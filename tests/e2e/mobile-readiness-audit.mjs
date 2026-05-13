// Mobile readiness audit script for key OyamaCRM routes across phone/tablet viewports.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "iphone-12", width: 390, height: 844 },
  { name: "android-small", width: 360, height: 800 },
  { name: "tablet-portrait", width: 768, height: 1024 },
];

const ROUTES = [
  "/",
  "/automations",
  "/constituents",
  "/donations",
  "/campaigns",
  "/tasks",
  "/communications",
  "/reports",
  "/quickbooks-sync",
  "/settings",
  "/compassion/dashboard",
  "/compassion/clients",
  "/compassion/appointments",
  "/compassion/cases",
  "/compassion/reports",
  "/events/workspace",
  "/events/events",
  "/events/guests",
  "/events/check-in",
  "/events/reports",
  "/watchdog",
  "/watchdog/feedback-tickets",
  "/webmaster",
  "/hrm",
  "/apps",
];

/** Logs into the app using API auth bound to the current browser context. */
async function authenticate(page) {
  const response = await page.request.post(`${WEB_BASE}/api/auth/login`, {
    data: {
      email: "admin@hopefoundation.org",
      password: "admin123!",
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Mobile audit login failed: ${response.status()} ${body}`);
  }

  await page.goto(`${WEB_BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Collects mobile diagnostics for the current page. */
async function collectMetrics(page, route, viewport) {
  const diagnostics = await page.evaluate(() => {
    const interactiveElements = Array.from(document.querySelectorAll("a, button, input, select, textarea"));
    const tooSmallTargets = interactiveElements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40);
    }).length;

    const textElements = Array.from(document.querySelectorAll("p, span, label, td, li, button, a"));
    const tinyTextCount = textElements.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const size = Number.parseFloat(style.fontSize || "0");
      return Number.isFinite(size) && size > 0 && size < 12;
    }).length;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      tooSmallTargets,
      tinyTextCount,
      bodyTextSample: (document.body?.innerText || "").slice(0, 300),
    };
  });

  const url = new URL(page.url()).pathname;
  const fatalMarkers = ["Application error", "This page could not be found", "An error occurred"];
  const fatalMarker = fatalMarkers.find((marker) => diagnostics.bodyTextSample.includes(marker));

  const issues = [];
  if (fatalMarker) issues.push(`fatal:${fatalMarker}`);
  if (diagnostics.hasHorizontalOverflow) issues.push("layout:horizontal-overflow");
  if (diagnostics.tooSmallTargets > 0) issues.push(`a11y:small-targets:${diagnostics.tooSmallTargets}`);
  if (diagnostics.tinyTextCount > 0) issues.push(`a11y:tiny-text:${diagnostics.tinyTextCount}`);

  return {
    route,
    url,
    viewport,
    diagnostics,
    issues,
    status: issues.some((issue) => issue.startsWith("fatal") || issue.startsWith("layout"))
      ? "fail"
      : issues.length > 0
        ? "warn"
        : "pass",
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await authenticate(page);

    const results = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of ROUTES) {
        const target = `${WEB_BASE}${route}`;
        process.stdout.write(`[mobile-audit] ${viewport.name} ${route}\n`);
        await page.goto(target, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        results.push(await collectMetrics(page, route, viewport));
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl: WEB_BASE,
      totals: {
        all: results.length,
        pass: results.filter((item) => item.status === "pass").length,
        warn: results.filter((item) => item.status === "warn").length,
        fail: results.filter((item) => item.status === "fail").length,
      },
    };

    const artifactsDir = path.join(process.cwd(), "tests", "e2e", "artifacts");
    await fs.mkdir(artifactsDir, { recursive: true });
    const reportPath = path.join(artifactsDir, "mobile-readiness-report.json");
    await fs.writeFile(reportPath, JSON.stringify({ summary, results }, null, 2), "utf8");

    process.stdout.write(`[mobile-audit] report: ${reportPath}\n`);
    process.stdout.write(`[mobile-audit] totals: ${JSON.stringify(summary.totals)}\n`);

    if (summary.totals.fail > 0) {
      process.exitCode = 1;
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error("[mobile-audit] fatal", error);
  process.exitCode = 1;
});
