/** Standalone Letters retains its own template editor after Create cutover. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.CREATE_UI_WEB || "http://127.0.0.1:3138";
const endpoint = "/api/letters/templates/original-letter";
const template = {
  id: "original-letter", name: "Original November Letter", status: "DRAFT", category: "GENERAL",
  printBody: "<p>Dear {first} {last},</p><p>Thank you for {{donation.amount}}.</p>", printLayoutJson: {}, printSubject: "Thank you",
};
const permissions = ["letters.view", "letters.edit", "letters.create", "edit:communications", "view:communications"];
const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] });
try {
  for (const width of [1440, 390]) {
    let saved = null;
    const errors = [];
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const json = (body, status = 200) => route.fulfill({ json: body, status });
      if (path === "/api/auth/refresh") return json({ data: { accessToken: "synthetic" } });
      if (path === "/api/auth/me") return json({ data: { id: "qa", organizationId: "qa-org", firstName: "QA", lastName: "Admin", role: "admin", permissions } });
      if (path === "/api/oyama-create/bootstrap") return json({ enabled: true, classicLettersEnabled: true, permissions });
      if (path === "/api/letters/production/config") return json({ enabled: false });
      if (path === endpoint) {
        if (request.method() === "PATCH") saved = { ...template, ...request.postDataJSON() };
        return json(saved || template);
      }
      if (path === "/api/letters/merge-fields") return json({ sections: [{ label: "Donor", fields: ["{first}", "{last}", "{{donation.amount}}"] }], validationFields: ["{first}", "{last}", "{{donation.amount}}"] });
      if (path === "/api/settings/branding") return json({ organizationDisplayName: "Community Foundation" });
      if (request.method() !== "GET") return json({ error: { message: `Unexpected write ${path}` } }, 400);
      return json([]);
    });
    await page.goto(`${base}/oyama-letters/templates/original-letter`, { waitUntil: "domcontentloaded" });
    const editor = page.getByRole("textbox", { name: "Print body", exact: true });
    await editor.waitFor({ timeout: 90000 });
    assert.match(await editor.innerHTML(), /\{first\} \{last\}/);
    await editor.fill("Dear {first} {last}, updated synthetic original.");
    await page.getByRole("button", { name: /^Save(?: template)?$/i }).first().click();
    await page.getByText("Template saved.", { exact: true }).waitFor();
    assert.match(saved?.printBody || "", /updated synthetic original/);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Standalone Letters opened and saved its original template at desktop and phone widths.");
} finally {
  await browser.close();
}
