import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateStudioAsset, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { CreateError, required } from "../domain.js";
import { studioImageSize } from "./image-metadata.js";

export const MAX_STUDIO_IMAGE_BYTES = 5_000_000;

function imageFormat(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mimeType: "image/jpeg", ext: "jpg" };
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return { mimeType: "image/webp", ext: "webp" };
  throw new CreateError(400, "Choose a PNG, JPEG or WebP image.");
}

type ImageUpload = { org: string; actor: string; name: string; bytes: Buffer; mimeType?: string; kind?: "IMAGE" | "SIGNATURE" };

/** Persist the same managed image format for Studio and MCP. The callback can record a receipt with the asset row. */
export async function storeStudioImage(
  { org, actor, name, bytes, mimeType, kind = "IMAGE" }: ImageUpload,
  save: (data: Prisma.CreateStudioAssetUncheckedCreateInput) => Promise<CreateStudioAsset> = data => prisma.createStudioAsset.create({ data }),
) {
  const assetName = required(name, "Asset name");
  if (!bytes.length || bytes.length > MAX_STUDIO_IMAGE_BYTES) throw new CreateError(400, "The image is empty or exceeds 5 MB.");
  const format = imageFormat(bytes);
  if (mimeType && mimeType !== format.mimeType) throw new CreateError(400, "The file contents do not match its image type.");
  const size = studioImageSize(bytes, format.mimeType);
  if (!/^[a-z0-9_-]+$/i.test(org)) throw new CreateError(400, "Invalid organization identity.");
  const directory = path.resolve("public", "uploads", "letter-media", org), file = `${randomUUID()}.${format.ext}`;
  const destination = path.join(directory, file);
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  try {
    return await save({ organizationId: org, name: assetName, kind, url: `/api/letters/media/${org}/${file}`, mimeType: format.mimeType, bytes: bytes.length, ...size, checksum: createHash("sha256").update(bytes).digest("hex"), uploadedBy: actor });
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
}
