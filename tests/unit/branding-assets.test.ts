import { describe, expect, it } from "vitest";
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
});
