import { prisma } from "../lib/prisma.js";
import { normalizePublicMediaUrl } from "../lib/public-media.js";
import { CreateError } from "./domain.js";

/** Existing selections remain usable. New block/region selections cannot adopt trashed resources. */
export async function assertAvailableSelections(org: string, next: unknown, previous?: unknown) {
  const rows = await prisma.createTrashItem.findMany({ where: { organizationId: org, restoredAt: null } });
  if (!rows.length) return;
  const assets = await prisma.createStudioAsset.findMany({ where: { organizationId: org, id: { in: rows.filter(row => row.kind === "ASSET").map(row => row.resourceId) } } });
  const prior = references(previous);
  for (const [key, value] of references(next)) {
    if (prior.get(key) === value) continue;
    const unavailable = /:(src|logoUrl|logoSquareUrl|signatureImageUrl|avatarUrl)$/.test(key)
      ? assets.some(asset => normalizePublicMediaUrl(asset.url) === value)
      : rows.some(row => ["SIGNATURE", "PRESET"].includes(row.kind) && row.resourceId === value);
    if (unavailable) throw new CreateError(409, "Restore this library item from Trash before selecting it for new content.");
  }
}
function references(value: unknown, path = "document", result = new Map<string, string>()) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) { value.forEach((item, index) => references(item, `${path}.${index}`, result)); return result; }
  const object = value as Record<string, unknown>;
  const attrs = object.attrs as Record<string, unknown> | undefined;
  const identity = typeof attrs?.studioId === "string" ? attrs.studioId : typeof object.id === "string" ? object.id : path;
  for (const [key, item] of Object.entries(object)) {
    if (["src", "logoUrl", "logoSquareUrl", "signatureImageUrl", "avatarUrl", "signerId", "secondSignerId", "presetId"].includes(key) && typeof item === "string") result.set(`${path.endsWith(".attrs") ? path.slice(0, -6) : identity}:${key}`, /^(src|logoUrl|logoSquareUrl|signatureImageUrl|avatarUrl)$/.test(key) ? normalizePublicMediaUrl(item) : item);
    else if (item && typeof item === "object") references(item, key === "attrs" ? `${identity}.attrs` : `${identity}.${key}`, result);
  }
  return result;
}
