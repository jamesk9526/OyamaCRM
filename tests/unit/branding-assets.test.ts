import { describe, expect, it } from "vitest";
import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { usableBrandingAssetUrl } from "@/server/src/lib/branding-assets";

describe("usableBrandingAssetUrl", () => {
  it("preserves externally hosted organization logos", async () => {
    await expect(usableBrandingAssetUrl("https://cdn.example.org/logo.png", "org-1"))
      .resolves.toBe("https://cdn.example.org/logo.png");
  });

  it("rejects local branding paths owned by another organization", async () => {
    await expect(usableBrandingAssetUrl("/uploads/branding/org-2/primary-example.png", "org-1"))
      .resolves.toBe("");
  });

  it("suppresses a stale local upload instead of returning a broken image URL", async () => {
    await expect(usableBrandingAssetUrl("/uploads/branding/org-1/primary-file-that-does-not-exist.png", "org-1"))
      .resolves.toBe("");
  });

  it("serves an existing upload through the public app even when an old absolute API URL was saved", async () => {
    const organizationId = `brand-${randomUUID()}`;
    const directory = path.resolve(process.cwd(), "public", "uploads", "branding", organizationId);
    const localUrl = `/uploads/branding/${organizationId}/primary-logo.png`;
    const logoPath = path.join(directory, "primary-logo.png");
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(logoPath, "test image");
      await expect(usableBrandingAssetUrl(`http://localhost:4000${localUrl}`, organizationId))
        .resolves.toBe(localUrl);
    } finally {
      await unlink(logoPath);
      await rmdir(directory);
    }
  });
});
