import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
const organizationId = `email-media-test-${randomUUID()}`;
const fileName = "preview-image.png";
const uploadDirectory = path.resolve(process.cwd(), "public", "uploads", "email-media", organizationId);

describe("public campaign media", () => {
  beforeAll(async () => {
    app = (await import("@/server/src/index")).default;
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, fileName), "email-image-fixture");
  }, 30_000);

  afterAll(async () => {
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  it("serves uploaded campaign images through the public API route without a CRM session", async () => {
    const response = await request(app).get(`/api/email-campaigns/media/${organizationId}/${fileName}`);

    expect(response.status).toBe(200);
    expect(Buffer.from(response.body).toString()).toBe("email-image-fixture");
  });
});
