/**
 * LiveCom UI e2e smoke script.
 * Validates local embed widget -> CRM inbox -> visitor widget two-way conversation flow.
 */
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

async function login(page) {
  await page.goto(`${WEB_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', "admin@hopefoundation.org");
  await page.fill('input[type="password"], input[name="password"]', "admin123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 45000 });
}

async function configureEmbedSite(request) {
  const config = await request.get(`${API_BASE}/api/site-embeds/config`);
  if (!config.ok()) throw new Error(`Failed to load site embeds config: ${config.status()}`);
  const payload = await config.json();
  const site = payload?.data?.sites?.[0];
  if (!site?.id) throw new Error("No site embed connection exists for LiveCom e2e.");

  const update = await request.put(`${API_BASE}/api/site-embeds/config`, {
    data: {
      siteId: site.id,
      name: site.name || "Local LiveCom Test",
      publicSiteId: site.publicSiteId || `local_pub_${Date.now()}`,
      primaryDomain: "localhost",
      allowedDomains: ["localhost", "127.0.0.1"],
      active: true,
      appearance: site.appearance,
      widgets: {
        ...site.widgets,
        liveCom: {
          ...(site.widgets?.liveCom ?? {}),
          enabled: true,
          buttonLabel: "Chat with us",
          buttonPosition: "bottom-right",
        },
      },
    },
  });
  if (!update.ok()) throw new Error(`Failed to configure local LiveCom site: ${update.status()}`);
  const updated = await update.json();
  const token = updated?.data?.site?.embedToken;
  if (!token) throw new Error("Site embed token missing after config update.");
  return token;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const crmPage = await context.newPage();
    await login(crmPage);

    const token = await configureEmbedSite(crmPage.request);
    const visitorMessage = `LiveCom visitor e2e ${Date.now()}`;
    const staffReply = `LiveCom staff e2e ${Date.now()}`;

    const visitorPage = await context.newPage();
    await visitorPage.goto(`${WEB_BASE}/livecom/embed-test`, { waitUntil: "domcontentloaded" });
    await visitorPage.getByLabel("API base URL").fill(API_BASE);
    await visitorPage.getByLabel("Embed token").fill(token);
    await visitorPage.getByRole("button", { name: "Mount Widget" }).click();
    await visitorPage.locator("#oyama-livecom-launcher button").last().click();
    await visitorPage.locator("#oyama-livecom-launcher textarea").fill(visitorMessage);
    await visitorPage.keyboard.press("Enter");
    await visitorPage.getByText(/sent to our team/i).waitFor({ timeout: 30000 });

    await crmPage.goto(`${WEB_BASE}/livecom/inbox`, { waitUntil: "domcontentloaded" });
    await crmPage.getByText(visitorMessage, { exact: false }).first().waitFor({ timeout: 45000 });
    await crmPage.getByText(visitorMessage, { exact: false }).first().click();
    await crmPage.locator('textarea[placeholder="Aa"]').fill(staffReply);
    await crmPage.keyboard.press("Enter");
    await crmPage.getByText(staffReply, { exact: false }).first().waitFor({ timeout: 30000 });

    await visitorPage.getByText(staffReply, { exact: false }).first().waitFor({ timeout: 45000 });

    await crmPage.getByRole("button", { name: "Archive" }).first().click();
    await crmPage.getByRole("button", { name: "Reopen" }).first().waitFor({ timeout: 30000 });
    const publicBody = await visitorPage.locator("#oyama-livecom-launcher").innerText();
    if (/Conversation archived|Conversation updated|resolved/i.test(publicBody)) {
      throw new Error("Public widget exposed CRM lifecycle system text.");
    }
    await crmPage.getByRole("button", { name: "Reopen" }).first().click();
    await crmPage.getByText(/open/i).first().waitFor({ timeout: 30000 });

    console.log("LiveCom UI smoke passed.");
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("LiveCom UI smoke failed:", error);
  process.exit(1);
});
