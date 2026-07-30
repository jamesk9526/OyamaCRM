import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
const organizationId = `letter-media-test-${randomUUID()}`;
const fileName = "preview-image.png";
const uploadDirectory = path.resolve(process.cwd(), "public", "uploads", "letter-media", organizationId);

describe("public letter media", () => {
  beforeAll(async () => {
    app = (await import("@/server/src/index")).default;
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, fileName), "letter-image-fixture");
  }, 30_000);

  afterAll(async () => {
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  it("serves uploaded letter images from the URL returned by the upload route", async () => {
    const response = await request(app).get(`/uploads/letter-media/${organizationId}/${fileName}`);

    expect(response.status).toBe(200);
    expect(Buffer.from(response.body).toString()).toBe("letter-image-fixture");
  });
});
