// Browser e2e for EventSTUDIO public page output and registration.
import { chromium } from "playwright";

const WEB_BASE = process.env.E2E_WEB_BASE_URL || "http://localhost:3000";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";

async function expectJsonOk(response, step) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new Error(`${step} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function getAdminToken() {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@hopefoundation.org", password: "admin123!" }),
  });
  const body = await expectJsonOk(response, "Admin login");
  const token = body?.data?.accessToken;
  if (!token) throw new Error("Admin login did not return an access token.");
  return token;
}

async function setupPublishedEventPage(token) {
  const suffix = Date.now();
  const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const event = await expectJsonOk(await fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `Public Page E2E ${suffix}`,
      type: "GALA",
      status: "PUBLISHED",
      startDate,
      location: "E2E Hall",
      capacity: 20,
      visibility: "PUBLIC",
    }),
  }), "Create event");

  await expectJsonOk(await fetch(`${API_BASE}/api/events/${event.id}/ticket-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "General Admission",
      price: 0,
      capacity: 10,
      available: 10,
      description: "Public page smoke ticket",
      maxPerOrder: 4,
    }),
  }), "Create ticket type");

  const pageSlug = `public-page-e2e-${suffix}`;
  await expectJsonOk(await fetch(`${API_BASE}/api/events/${event.id}/page-builder-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pageSlug,
      status: "Published",
      paymentPolicy: "NoPaymentRequired",
      sections: [
        {
          id: "hero",
          enabled: true,
          lockToEventData: true,
          content: {
            kicker: "Browser smoke",
            primaryButtonText: "Register Now",
            primaryButtonLink: "#registration",
            secondaryButtonText: "Event Details",
            secondaryButtonLink: "#event-details",
          },
          design: { backgroundType: "color", backgroundColor: "#120c3b", textAlign: "center" },
          advanced: { anchorId: "hero" },
        },
        { id: "event-details", enabled: true, lockToEventData: true, advanced: { anchorId: "event-details" } },
        { id: "registration-form", enabled: true, lockToEventData: true, advanced: { anchorId: "registration" } },
        { id: "share-buttons", enabled: true, lockToEventData: true, advanced: { anchorId: "share" } },
        { id: "footer", enabled: true, lockToEventData: true, advanced: { anchorId: "footer" } },
      ],
    }),
  }), "Publish page builder config");

  return { event, pageSlug };
}

async function main() {
  const token = await getAdminToken();
  const { event, pageSlug } = await setupPublishedEventPage(token);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(`${WEB_BASE}/${pageSlug}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByText(event.name).first().waitFor({ timeout: 30000 });
    await page.getByRole("link", { name: /Register Now/i }).first().click();
    await page.getByText(/Reserve seats for this event/i).waitFor({ timeout: 15000 });

    await page.getByLabel(/First name/i).first().fill("Browser");
    await page.getByLabel(/Last name/i).first().fill("Registrant");
    await page.getByLabel(/Email/i).first().fill(`browser-registrant-${Date.now()}@example.org`);
    await page.getByLabel(/I agree to share/i).check();
    await page.getByRole("button", { name: /^Register$/i }).click();

    await page.getByText(/Registration received/i).waitFor({ timeout: 30000 });
    await page.getByText(/Code:/i).waitFor({ timeout: 15000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
    if (overflow) {
      throw new Error("Public event page has horizontal overflow at 1366px.");
    }
  } finally {
    await browser.close();
  }

  console.log("Event public page builder e2e passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
