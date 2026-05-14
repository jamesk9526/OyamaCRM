import { chromium } from "playwright";

const WEB = "http://localhost:3000";
const API = "http://localhost:4000";

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@hopefoundation.org", password: "admin123!" }),
  });
  const loginBody = await login.json().catch(() => ({}));
  const token = loginBody?.data?.accessToken;
  const widgetToken = `probe-widget-${Date.now()}`;

  const cfg = await fetch(`${API}/api/compassion/appointment-widget`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      enabled: true,
      config: {
        enabled: true,
        token: widgetToken,
        slotIntervalMinutes: 30,
        appointmentDurationMinutes: 30,
        minLeadHours: 0,
        maxAdvanceDays: 120,
        locationOptions: ["Main Office"],
        availabilityBlocks: [
          {
            id: "probe-block",
            dayOfWeek: new Date(Date.now() + 24 * 60 * 60 * 1000).getDay(),
            startTime: "09:00",
            endTime: "11:00",
            location: "Main Office",
            appointmentType: "ANY",
            capacity: 2,
            isActive: true,
          },
        ],
        blackoutDates: [],
      },
    }),
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${WEB}/compassion/public/appointments/${widgetToken}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const submitCount = await page.locator('button[type="submit"]').count();
  const submitDisabled = submitCount ? await page.locator('button[type="submit"]').isDisabled() : null;
  const text = await page.locator('body').innerText();

  console.log(JSON.stringify({
    loginStatus: login.status,
    cfgStatus: cfg.status,
    widgetToken,
    url: page.url(),
    submitCount,
    submitDisabled,
    snippet: text.slice(0, 300),
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
