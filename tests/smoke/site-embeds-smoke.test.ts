/** Smoke tests for DonorCRM site-embeds admin APIs, public loader/domain validation, and LiveCom ingestion. */
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let siteId = "";
let embedToken = "";
const primaryDomain = `smoke-${Date.now()}.example.org`;
const blockedDomain = `blocked-${Date.now()}.example.org`;
const liveComMessage = `Smoke LiveCom message ${Date.now()}`;

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  accessToken = login.body.data?.accessToken ?? "";
});

describe("site embeds smoke", () => {
  it("returns site embed config for authenticated admins", async () => {
    const res = await request(app)
      .get("/api/site-embeds/config")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data?.sites)).toBe(true);
    expect(Array.isArray(res.body?.data?.registry)).toBe(true);
    siteId = String(res.body?.data?.selectedSiteId ?? "");
    embedToken = String(res.body?.data?.sites?.[0]?.embedToken ?? "");
    expect(siteId).toBeTruthy();
    expect(embedToken).toBeTruthy();
  });

  it("persists domain and LiveCom settings updates", async () => {
    const res = await request(app)
      .put("/api/site-embeds/config")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        siteId,
        name: "Smoke Public Website",
        publicSiteId: `smoke_pub_${Date.now()}`,
        primaryDomain,
        allowedDomains: [primaryDomain, `www.${primaryDomain}`, "*.preview.example.org"],
        active: true,
        widgets: {
          liveCom: {
            enabled: true,
            buttonLabel: "Chat with our team",
            buttonPosition: "bottom-right",
            greetingMessage: "Thanks for supporting our mission.",
          },
          campaign_meter: { enabled: true },
          donation_widget: { enabled: true },
          event_card: { enabled: true },
          volunteer_signup: { enabled: true },
          newsletter_signup: { enabled: true },
          impact_counter: { enabled: true },
          cta_block: { enabled: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body?.data?.site?.primaryDomain).toBe(primaryDomain);
    expect(res.body?.data?.site?.widgets?.liveCom?.enabled).toBe(true);

    siteId = String(res.body?.data?.site?.id ?? siteId);
    embedToken = String(res.body?.data?.site?.embedToken ?? embedToken);
    expect(siteId).toBeTruthy();
    expect(embedToken).toBeTruthy();
  });

  it("serves loader.js for allowed domains and blocks non-allowlisted domains", async () => {
    const allowed = await request(app)
      .get(`/api/site-embeds/loader.js?token=${encodeURIComponent(embedToken)}&domain=${encodeURIComponent(primaryDomain)}`);

    expect(allowed.status).toBe(200);
    expect(String(allowed.text)).toContain("OyamaCRM Site Embed Loader");
    expect(String(allowed.text)).toContain("/api/site-embeds/public/ping");

    const blocked = await request(app)
      .get(`/api/site-embeds/loader.js?token=${encodeURIComponent(embedToken)}&domain=${encodeURIComponent(blockedDomain)}`);

    expect(blocked.status).toBe(403);
    expect(String(blocked.text)).toContain("Domain is not allowed");
  });

  it("records public ping status and stores latest script load metadata", async () => {
    const ping = await request(app)
      .get(`/api/site-embeds/public/ping?token=${encodeURIComponent(embedToken)}&domain=${encodeURIComponent(primaryDomain)}&reason=smoke_ping&widgets=livecom`);

    expect(ping.status).toBe(200);
    expect(ping.body?.data?.ok).toBe(true);

    const config = await request(app)
      .get(`/api/site-embeds/config?siteId=${encodeURIComponent(siteId)}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(config.status).toBe(200);

    const selected = (config.body?.data?.sites ?? []).find((site: { id: string }) => site.id === siteId);
    expect(selected?.lastSuccessfulScriptLoad?.domain).toBe(primaryDomain);
    expect(selected?.lastSuccessfulScriptLoad?.reason).toBe("smoke_ping");
  });

  it("returns widget data payloads for implemented inline embeds", async () => {
    const impact = await request(app)
      .get(`/api/site-embeds/public/widget-data?token=${encodeURIComponent(embedToken)}&domain=${encodeURIComponent(primaryDomain)}&widget=impact-counter`);

    expect(impact.status).toBe(200);
    expect(impact.body?.data?.widget).toBe("impact_counter");
    expect(typeof impact.body?.data?.metrics?.constituentCount).toBe("number");

    const campaign = await request(app)
      .get(`/api/site-embeds/public/widget-data?token=${encodeURIComponent(embedToken)}&domain=${encodeURIComponent(primaryDomain)}&widget=campaign-meter`);

    expect(campaign.status).toBe(200);
    expect(campaign.body?.data?.widget).toBe("campaign_meter");
  });

  it("accepts public LiveCom messages and exposes them in LiveCom interactions", async () => {
    const submit = await request(app)
      .post("/api/site-embeds/public/livecom")
      .type("form")
      .send({
        token: embedToken,
        domain: primaryDomain,
        name: "Smoke Visitor",
        email: `smoke.livecom.${Date.now()}@example.org`,
        message: liveComMessage,
        pageUrl: `https://${primaryDomain}/donate`,
      });

    expect(submit.status).toBe(201);
    expect(submit.body?.data?.queued).toBe(true);

    const interactions = await request(app)
      .get(`/api/livecom/interactions?search=${encodeURIComponent(liveComMessage)}&limit=200`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(interactions.status).toBe(200);
    expect(Array.isArray(interactions.body)).toBe(true);
    const found = (interactions.body as Array<{ detail: string }>).some((row) => row.detail.includes(liveComMessage));
    expect(found).toBe(true);
  });

  it("accepts newsletter widget submissions and updates script-load reason", async () => {
    const submit = await request(app)
      .post("/api/site-embeds/public/widget-submit")
      .type("form")
      .send({
        token: embedToken,
        domain: primaryDomain,
        widget: "newsletter-signup",
        name: "Smoke Newsletter",
        email: `smoke.newsletter.${Date.now()}@example.org`,
        message: "Please add me to updates",
      });

    expect(submit.status).toBe(201);
    expect(submit.body?.data?.queued).toBe(true);
    expect(submit.body?.data?.widget).toBe("newsletter_signup");

    const config = await request(app)
      .get(`/api/site-embeds/config?siteId=${encodeURIComponent(siteId)}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(config.status).toBe(200);
    const selected = (config.body?.data?.sites ?? []).find((site: { id: string }) => site.id === siteId);
    expect(selected?.lastSuccessfulScriptLoad?.reason).toBe("newsletter_signup_submit");
  });
});
