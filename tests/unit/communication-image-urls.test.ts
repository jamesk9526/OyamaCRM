import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { studioUrl } from "@/server/src/oyama-create/studio/design";
import { normalizeBrand } from "@/server/src/oyama-create/studio/brand";
import { sanitizeBrandHtml } from "@/server/src/oyama-create/studio/brand-service";
import { assertStudioAssetOwnership } from "@/server/src/oyama-create/studio/asset-ownership";
import { absolutizeEmailAssetUrls } from "@/server/src/services/oyama-email/email-render-service";
import { freezeAsset } from "@/server/src/services/letter-production";
import { sanitizeLetterHtml } from "@/server/src/services/letter-production-renderer";

describe("communication image compatibility", () => {
  it.each([
    "/api/letters/media/org/signature.png",
    "http://localhost:4000/api/letters/media/org/signature.png",
    "https://old-api.example.org/uploads/letter-media/org/signature.png",
  ])("opens a saved legacy signature in Studio: %s", source => {
    expect(studioUrl(source, true)).toBe("/api/letters/media/org/signature.png");
  });

  it("retains imported logos and signatures and normalizes profile overrides", () => {
    const brand = normalizeBrand({ version: 1, identity: { logoUrl: "http://localhost:4000/uploads/branding/org/logo.png" }, signers: [{ id: "signer", signatureImageUrl: "/api/letters/media/org/sign.png" }], profiles: [{ id: "email", channel: "EMAIL", values: { logoUrl: "https://old.example.org/uploads/email-media/org/logo.png" } }] });
    expect(brand.identity.logoUrl).toBe("/api/public-media/branding/org/logo.png");
    expect(brand.signers[0].signatureImageUrl).toBe("/api/letters/media/org/sign.png");
    expect(brand.profiles[0].values.logoUrl).toBe("/api/email-campaigns/media/org/logo.png");
  });

  it("keeps authored header/footer images through brand saving without weakening print sanitization", () => {
    const html = '<p onclick="bad()"><img src="http://localhost:4000/api/letters/media/org/sign.png" alt="Signature"><script>bad()</script></p>';
    const brand = normalizeBrand({ version: 1, identity: { globalHeaderHtml: html }, presets: [{ id: "header", kind: "header", legacyHtml: html }], profiles: [{ id: "email", channel: "EMAIL", values: { globalFooterHtml: html } }] });
    const saved = sanitizeBrandHtml(brand);
    for (const value of [saved.identity.globalHeaderHtml, saved.presets[0].legacyHtml, saved.profiles[0].values.globalFooterHtml]) {
      expect(value).toContain('src="/api/letters/media/org/sign.png"');
      expect(value).not.toMatch(/script|onclick/);
    }
    expect(sanitizeLetterHtml(html)).not.toContain('src=');
  });

  it("resolves every authored email image source against the public host", () => {
    const html = `<img src='http://localhost:4000/uploads/branding/org/logo.png'><img src=/api/letters/media/org/sign.png><table background="/uploads/email-media/org/bg.png"><tr><td style="background-image:url('/uploads/branding/org/bg.png')">Copy</td></tr></table><v:fill src="https://old.example.org/uploads/letter-media/org/story.png"/><img src="https://cdn.example.org/photo.jpg?a=1&amp;b=2"><img src="cid:attached"><img src="{{imageUrl}}">`;
    const result = absolutizeEmailAssetUrls(html, "https://crm.example.org");
    expect(result).toContain("src='https://crm.example.org/api/public-media/branding/org/logo.png'");
    expect(result).toContain('src="https://crm.example.org/api/letters/media/org/sign.png"');
    expect(result).toContain('background="https://crm.example.org/api/email-campaigns/media/org/bg.png"');
    expect(result).toContain("url('https://crm.example.org/api/public-media/branding/org/bg.png')");
    expect(result).toContain('src="https://crm.example.org/api/letters/media/org/story.png"');
    expect(result).toContain('src="https://cdn.example.org/photo.jpg?a=1&amp;b=2"');
    expect(result).toContain('src="cid:attached"');
    expect(result).toContain('src="{{imageUrl}}"');
    expect(result).not.toContain("localhost");
  });

  it("enforces tenant ownership for API aliases, profile avatars and HTML image attributes", () => {
    for (const value of [
      { src: "/api/letters/media/other/sign.png" },
      { "widgets.liveCom.avatarUrl": "https://old.example.org/api/email-campaigns/media/other/logo.png" },
      { globalHeaderHtml: "<img src='/uploads/branding/other/logo.png'>" },
      { legacyHtml: "<img src=/api/letters/media/other/sign.png>" },
    ]) expect(() => assertStudioAssetOwnership("org", value)).toThrow(/organization/);
  });

  it("freezes an email-library image for letters without requesting its obsolete host", async () => {
    const org = `image-${randomUUID()}`, directory = path.resolve("public/uploads/email-media", org);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLvsAAAAASUVORK5CYII=", "base64");
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(path.join(directory, "story.png"), png);
      const frozen = await freezeAsset(`http://localhost:1/api/email-campaigns/media/${org}/story.png`, org);
      expect(frozen).toBe(`data:image/png;base64,${png.toString("base64")}`);
      await expect(freezeAsset(`/api/email-campaigns/media/${org}/story.png`, "other")).rejects.toThrow(/authorized/);
    } finally { await unlink(path.join(directory, "story.png")); await rmdir(directory); }
  });
});
