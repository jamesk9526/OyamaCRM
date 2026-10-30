/** Synthetic data only. Checks shared presentation and protects authored documents. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { installDonorWorkspaceFixtures } from "./fixtures/donor-daily-workspace.mjs";

const base = process.env.QA_BASE_URL || "http://localhost:4781";
const evidence = "docs/status/audit-artifacts/2026-10-30-reference-modernization";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); const errors = []; const checks = []; const writes = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/api/**", route => {
  const request = route.request(); const path = new URL(request.url()).pathname;
  let body = [];
  if (path === "/api/auth/refresh") body = { data: { accessToken: "synthetic" } };
  else if (path === "/api/auth/me") body = { data: { id: "visual", firstName: "Taylor", lastName: "Reed", email: "visual@example.invalid", role: "admin", organizationId: "visual" } };
  else if (request.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405, json: { error: { message: "Writes disabled" } } }); }
  else if (path.startsWith("/api/reports/library/")) body = { report: path.split("/").pop(), title: "Synthetic report", description: "Browser fixture", columns: [{ key: "name", label: "Donor" }], rows: [], summary: [], notices: [], period: null };
  else if (path === "/api/notifications") body = { items: [], total: 0, unreadCount: 0 };
  else if (path.startsWith("/api/settings/")) body = {};
  return route.fulfill({ json: body });
});
await installDonorWorkspaceFixtures(page);
try {
  for (const path of ["/campaigns", "/reports", "/reports?report=recurring-giving", "/settings", "/constituents/qa-person"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.locator("main h1").first().waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} overflow at ${width}`);
      await page.screenshot({ path: `${evidence}/${path.replace(/[^a-z0-9]/gi, "-")}-${width}.png`, fullPage: true });
    }
    checks.push(`${path}: desktop and mobile presentation without page overflow`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  const authored = await page.evaluate(() => {
    const fixture = document.createElement("section"); fixture.setAttribute("data-oyama-authored", "");
    fixture.innerHTML = '<h2 class="text-red-600">Authored heading</h2><button class="bg-emerald-600">Authored action</button>';
    document.querySelector("main").append(fixture);
    const values = [getComputedStyle(fixture.querySelector("h2")).color, getComputedStyle(fixture.querySelector("button")).backgroundColor];
    fixture.remove(); return values;
  });
  assert.notEqual(authored[0], "rgb(16, 31, 67)"); assert.notEqual(authored[1], "rgb(0, 127, 128)");
  checks.push("Authored content retains its heading and action colors inside the internal workspace");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(`${checks.length} reference design checks passed.`);
} finally {
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify({ fixture: "Synthetic browser responses; no stored data or business writes", checks, errors, writes }, null, 2));
  await browser.close();
}
