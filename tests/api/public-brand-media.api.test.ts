import { randomUUID } from "node:crypto";
import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
const org = `brand-media-${randomUUID()}`;
const directory = path.resolve("public/uploads/branding", org);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLvsAAAAASUVORK5CYII=", "base64");
describe("public brand artwork", () => {
  beforeAll(async () => {
    app = (await import("@/server/src/index")).default;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "logo.png"), png);
  }, 30000);
  afterAll(async () => { await unlink(path.join(directory, "logo.png")); await rmdir(directory); });
  it("serves the exact image bytes to inbox clients without cookies or authentication", async () => {
    const response = await request(app).get(`/api/public-media/branding/${org}/logo.png`).set("Origin", "https://inbox.example.org");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(response.body)).toEqual(png);
  });
  it.each(["missing.png", "private.pdf", ".hidden.png"])("returns a public 404 for %s instead of an authentication page", async file => {
    const response = await request(app).get(`/api/public-media/branding/${org}/${file}`);
    expect(response.status).toBe(404);
    expect(response.headers.location).toBeUndefined();
  });
});
