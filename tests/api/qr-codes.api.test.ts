import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let linkId = "";
let shortPath = "";
const alias = `qr-smoke-${Date.now()}`;

beforeAll(async () => {
  app = (await import("@/server/src/index")).default;
  const login = await request(app).post("/api/auth/login").send({ email: "admin@hopefoundation.org", password: "admin123!" });
  accessToken = login.body.data?.accessToken ?? "";
});

afterAll(async () => {
  if (linkId && accessToken) {
    await request(app).delete(`/api/qr-codes/${linkId}`).set("Authorization", `Bearer ${accessToken}`);
  }
});

describe("trackable QR code API", () => {
  it("blocks management access without authentication", async () => {
    const response = await request(app).get("/api/qr-codes");
    expect(response.status).toBe(401);
  });

  it("creates an organization-scoped editable redirect", async () => {
    const response = await request(app)
      .post("/api/qr-codes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "QR API smoke test", destinationUrl: "https://example.org/first", slug: alias, notes: "Temporary automated test" });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe(alias);
    expect(response.body.shortUrl).toContain(`/api/qr-codes/public/${alias}`);
    linkId = response.body.id;
    shortPath = new URL(response.body.shortUrl).pathname;
  });

  it("tracks a public scan and returns a real redirect", async () => {
    const response = await request(app)
      .get(shortPath)
      .set("User-Agent", "Mozilla/5.0 (iPhone; Mobile)")
      .set("Referer", "https://newsletter.example/private/path?subscriber=hidden")
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://example.org/first");
    expect(response.headers["cache-control"]).toContain("no-store");

    const analytics = await request(app)
      .get(`/api/qr-codes/${linkId}/analytics?days=7`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.totals.scans).toBeGreaterThanOrEqual(1);
    expect(analytics.body.devices).toContainEqual(expect.objectContaining({ device: "mobile" }));
    expect(analytics.body.recentScans[0].referrer).toBe("https://newsletter.example");
  });

  it("updates the destination without changing the QR short path, then pauses it", async () => {
    const update = await request(app)
      .patch(`/api/qr-codes/${linkId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ destinationUrl: "https://example.org/updated" });
    expect(update.status).toBe(200);
    expect(new URL(update.body.shortUrl).pathname).toBe(shortPath);

    const redirect = await request(app).get(shortPath).redirects(0);
    expect(redirect.headers.location).toBe("https://example.org/updated");

    const pause = await request(app)
      .patch(`/api/qr-codes/${linkId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ active: false });
    expect(pause.status).toBe(200);
    expect((await request(app).get(shortPath)).status).toBe(410);
  });
});
