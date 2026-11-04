import { access } from "node:fs/promises";
import path from "node:path";
import { managedPublicMedia } from "./public-media.js";

/**
 * Keeps remote branding URLs intact and suppresses stale local upload URLs.
 * Local upload files are deployment data rather than source-controlled assets;
 * returning an empty URL lets every UI use its existing organization-name
 * fallback instead of repeatedly requesting a missing image.
 */
export async function usableBrandingAssetUrl(value: unknown, organizationId: string): Promise<string> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";

  const media = managedPublicMedia(normalized);
  if (!media) return normalized;
  if (media.organizationId !== organizationId) return "";
  const assetPath = path.resolve(process.cwd(), "public", "uploads", media.namespace, media.organizationId, media.fileName);
  try {
    await access(assetPath);
    // Uploaded media is proxied by the public app. An old API or localhost
    // origin cannot be loaded by visitors, so always use the app-relative path.
    return media.publicUrl;
  } catch {
    return "";
  }
}
