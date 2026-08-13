import { access } from "node:fs/promises";
import path from "node:path";

const LOCAL_BRANDING_ASSET = /^\/uploads\/branding\/([a-z0-9_-]+)\/([a-z0-9][a-z0-9._-]{0,200}\.(?:png|jpe?g|webp|gif))$/i;

/**
 * Keeps remote branding URLs intact and suppresses stale local upload URLs.
 * Local upload files are deployment data rather than source-controlled assets;
 * returning an empty URL lets every UI use its existing organization-name
 * fallback instead of repeatedly requesting a missing image.
 */
export async function usableBrandingAssetUrl(value: unknown, organizationId: string): Promise<string> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";

  let pathname = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathname = new URL(normalized).pathname;
    } catch {
      return "";
    }
  }

  const match = pathname.match(LOCAL_BRANDING_ASSET);
  if (!match) return normalized;
  if (match[1] !== organizationId) return "";

  const assetPath = path.resolve(process.cwd(), "public", "uploads", "branding", match[1], match[2]);
  try {
    await access(assetPath);
    return normalized;
  } catch {
    return "";
  }
}
