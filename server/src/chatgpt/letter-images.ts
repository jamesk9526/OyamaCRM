import { Prisma, type ChatGptImageJob, type CreateStudioAsset } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { managedPublicMedia } from "../lib/public-media.js";
import { can, demand } from "../oyama-create/access.js";
import { CreateError } from "../oyama-create/domain.js";
import { isTrashed, trashedIds } from "../oyama-create/trash-state.js";
import { MAX_STUDIO_IMAGE_BYTES, storeStudioImage } from "../oyama-create/studio/asset-storage.js";
import { collectMergeFieldKeys } from "../services/letters-merge.js";
import { logAudit } from "../lib/audit.js";
import { IMAGE_SHAPES } from "./letter-tool-contract.js";
import { readMcpPolicy, toolAllowed } from "./policy.js";
import { effectiveConnectionConfig } from "./setup.js";
import { toolFingerprint, withToolReceipt } from "./receipts.js";

const providerKey = () => process.env.CHATGPT_IMAGE_API_KEY?.trim();
export const imageProviderConfigured = () => Boolean(providerKey());
const IMAGE_MODEL = "gpt-image-2.5-flare";
export const DAILY_IMAGE_LIMIT = 10;
const GENERATION_TIMEOUT_MS = 120_000;

function imageDetails(asset: Pick<CreateStudioAsset, "id" | "name" | "url" | "width" | "height" | "mimeType">, origin: string, org: string) {
  const media = managedPublicMedia(asset.url);
  if (!media || media.organizationId !== org || !/\.(png|jpe?g|webp)$/i.test(media.fileName)) return null;
  return { assetId: asset.id, name: asset.name, width: asset.width, height: asset.height, mimeType: asset.mimeType, url: `${origin}${media.publicUrl}` };
}

export async function listLetterImages(req: Request, origin: string, query = "", cursor = "") {
  await demand(req, "letters.view");
  const org = req.user!.orgId;
  const assets = await prisma.createStudioAsset.findMany({
    where: { organizationId: org, kind: "IMAGE", id: { gt: cursor, notIn: await trashedIds(org, "ASSET") }, name: { contains: query.trim() } },
    select: { id: true, name: true, url: true, width: true, height: true, mimeType: true }, orderBy: { id: "asc" }, take: 26,
  });
  return { items: assets.slice(0, 25).flatMap(asset => imageDetails(asset, origin, org) || []), nextCursor: assets.length > 25 ? assets[24].id : null };
}

async function boundedBytes(response: Response, limit: number) {
  if (!response.body) throw new CreateError(502, "The image service returned an empty response.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    if (Number(response.headers.get("content-length")) > limit) throw new CreateError(413, "The image exceeds the 5 MB Studio limit.");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, total);
      total += value.length;
      if (total > limit) throw new CreateError(413, "The image exceeds the 5 MB Studio limit.");
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

function chatGptDownload(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new CreateError(400, "Attach the image in ChatGPT or upload it in Studio."); }
  const attachmentHost = url.hostname === "oaiusercontent.com" || url.hostname.endsWith(".oaiusercontent.com");
  const attachmentPath = url.hostname === "chatgpt.com" && url.pathname === "/backend-api/estuary/content";
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || !(attachmentHost || attachmentPath)) {
    throw new CreateError(400, "Use a ChatGPT attachment. For other images, upload the file directly in Studio.");
  }
  return url;
}

type ImageAttachment = { name: string; requestKey: string; file: { download_url: string; file_id: string; mime_type?: string } };
export async function importLetterImage(req: Request, grantId: string, origin: string, { name, requestKey, file }: ImageAttachment) {
  await demand(req, "letters.create");
  await demand(req, "letters.edit");
  const { orgId: org, sub: actor } = req.user!;
  const url = chatGptDownload(file.download_url);
  // The signed download URL may change between retries. The file ID is the intent.
  return withToolReceipt(grantId, requestKey, toolFingerprint(["import_letter_image", name, file.file_id]), async record => {
    let bytes: Buffer;
    try {
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new CreateError(422, "ChatGPT could not provide this attachment. Attach it again or upload it in Studio.");
      }
      bytes = await boundedBytes(response, MAX_STUDIO_IMAGE_BYTES);
    } catch (error) {
      if (error instanceof CreateError) throw error;
      throw new CreateError(422, "The ChatGPT attachment is unavailable. Attach it again or upload it in Studio.");
    }
    const mimeType = file.mime_type && file.mime_type !== "application/octet-stream" ? file.mime_type : undefined;
    const asset = await storeStudioImage({ org, actor, name, bytes, mimeType }, data => prisma.$transaction(async tx => {
      const saved = await tx.createStudioAsset.create({ data });
      await record(tx, imageDetails(saved, origin, org)!);
      return saved;
    }));
    return imageDetails(asset, origin, org)!;
  });
}

type ImageRequest = { name: string; prompt: string; shape?: keyof typeof IMAGE_SHAPES; requestKey: string };
const jobSummary = (job: ChatGptImageJob) => ({
  jobId: job.id, name: job.name, status: job.status, ...(job.error ? { error: job.error } : {}),
  ...(["QUEUED", "RUNNING"].includes(job.status) ? { retryAfterSeconds: 5 } : {}),
});

export async function queueLetterImage(req: Request, grantId: string, { name, prompt, shape = "landscape", requestKey }: ImageRequest) {
  await demand(req, "letters.create");
  await demand(req, "letters.edit");
  const { orgId: organizationId, sub: userId } = req.user!;
  if (!imageProviderConfigured() || !(await readMcpPolicy(organizationId)).policy.allowImageGeneration) throw new CreateError(403, "Image generation requires the configured image provider and administrator approval. Use a Studio image or import an attachment.");
  if (collectMergeFieldKeys(prompt).length) throw new CreateError(400, "Describe the artwork without letter merge fields or donor data.");
  const fingerprint = toolFingerprint([name, prompt, shape]), quotaDay = new Date().toISOString().slice(0, 10);
  const where = { grantId_requestKey: { grantId, requestKey } };
  function replay(job: ChatGptImageJob) {
    if (job.fingerprint !== fingerprint) throw new CreateError(409, "This requestKey belongs to a different image request.");
    return jobSummary(job);
  }
  // The slot constraint enforces the daily cap across API processes and concurrent grants.
  for (let attempt = 0; attempt <= DAILY_IMAGE_LIMIT; attempt++) {
    const existing = await prisma.chatGptImageJob.findUnique({ where });
    if (existing) return replay(existing);
    const last = await prisma.chatGptImageJob.findFirst({ where: { organizationId, quotaDay }, orderBy: { quotaSlot: "desc" }, select: { quotaSlot: true } });
    const quotaSlot = (last?.quotaSlot || 0) + 1;
    if (quotaSlot > DAILY_IMAGE_LIMIT) {
      const concurrent = await prisma.chatGptImageJob.findUnique({ where });
      if (concurrent) return replay(concurrent);
      throw new CreateError(429, `This organization has used its ${DAILY_IMAGE_LIMIT} image requests for today (UTC). Use an existing image or try tomorrow.`);
    }
    try {
      return jobSummary(await prisma.chatGptImageJob.create({ data: { organizationId, userId, grantId, requestKey, fingerprint, quotaDay, quotaSlot, name, prompt, shape } }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  throw new CreateError(409, "Image generation is busy. Check or retry using the same requestKey.");
}

export async function getLetterImageJob(req: Request, origin: string, id: string) {
  await demand(req, "letters.edit");
  const { orgId: org, sub: userId } = req.user!;
  const job = await prisma.chatGptImageJob.findFirst({ where: { id, organizationId: org, userId } });
  if (!job) throw new CreateError(404, "Image job not found.");
  if (!job.assetId) return { ...jobSummary(job), ...(job.status === "QUEUED" && !imageProviderConfigured() ? { note: "The server image provider is unavailable. Use an existing Studio image or import an attachment." } : {}) };
  const asset = await prisma.createStudioAsset.findFirst({ where: { id: job.assetId, organizationId: org, kind: "IMAGE" } });
  const image = asset && !await isTrashed(org, "ASSET", asset.id) ? imageDetails(asset, origin, org) : null;
  return { ...jobSummary(job), image, ...(!image ? { note: "The generated image is unavailable in the Studio library." } : {}) };
}

async function generateImage(key: string, job: ChatGptImageJob) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt: job.prompt, size: IMAGE_SHAPES[job.shape as keyof typeof IMAGE_SHAPES], quality: "medium", n: 1, output_format: "jpeg", safety_identifier: toolFingerprint([job.organizationId, job.userId]) }),
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new CreateError(502, response.status === 429 ? "The image provider is at its usage limit. Ask your administrator to check the provider quota." : "The image provider could not generate the artwork. Check the prompt or ask your administrator to verify the provider.");
  }
  const body = JSON.parse((await boundedBytes(response, 7_000_000)).toString("utf8"));
  const encoded = body?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !/^[a-z0-9+/]+=*$/i.test(encoded)) throw new CreateError(502, "The image provider returned no printable artwork.");
  return Buffer.from(encoded, "base64");
}

/** Each job is claimed once. An interrupted provider call may have incurred a charge, so it is never retried automatically. */
export async function processLetterImageQueue() {
  const key = providerKey();
  if (!key) return;
  const now = new Date();
  await prisma.chatGptImageJob.updateMany({ where: { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - GENERATION_TIMEOUT_MS - 60_000) } }, data: { status: "FAILED", error: "The image job was interrupted. Check the Studio library and provider usage before requesting another image." } });
  await prisma.chatGptImageJob.updateMany({ where: { status: "QUEUED", createdAt: { lt: new Date(now.getTime() - 900_000) } }, data: { status: "FAILED", prompt: null, error: "The request expired in the queue. You can request a new image." } });
  const job = await prisma.chatGptImageJob.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
  if (!job) return;
  const claim = await prisma.chatGptImageJob.updateMany({ where: { id: job.id, status: "QUEUED" }, data: { status: "RUNNING", prompt: null, startedAt: now } });
  if (!claim.count) return;
  const org = job.organizationId, actor = job.userId;
  try {
    const [user, grant, { policy }, connection] = await Promise.all([
      prisma.user.findFirst({ where: { id: actor, organizationId: org, active: true } }),
      prisma.chatGptGrant.findFirst({ where: { id: job.grantId, userId: actor, organizationId: org, revokedAt: null, refreshExpiresAt: { gt: new Date() } } }),
      readMcpPolicy(org), effectiveConnectionConfig(undefined, org),
    ]);
    const context = { user: user && { sub: actor, orgId: org, role: user.role, email: user.email } } as Request;
    if (!connection.enabled || !policy.allowImageGeneration || !toolAllowed("letters.write", policy) ||
        !grant || grant.resource !== connection.resource || !grant.scopes.split(" ").includes("letters.write") ||
        !user || user.role === "compassion_user" || !await can(context, "letters.create") || !await can(context, "letters.edit")) {
      throw new CreateError(403, "The connection or image permissions changed before generation began.");
    }
    const bytes = await generateImage(key, job);
    await storeStudioImage({ org, actor, name: job.name, bytes, mimeType: "image/jpeg" }, data => prisma.$transaction(async tx => {
      const asset = await tx.createStudioAsset.create({ data });
      const completed = await tx.chatGptImageJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "COMPLETED", assetId: asset.id } });
      if (!completed.count) throw new CreateError(409, "The generation job expired before the artwork was saved.");
      return asset;
    }));
    await logAudit({ action: "CHATGPT_IMAGE_GENERATED", userId: actor, organizationId: org, entity: "ChatGptImageJob", entityId: job.id });
  } catch (error) {
    const message = error instanceof CreateError ? error.message : "Generation was interrupted. Check provider usage before requesting another image.";
    await prisma.chatGptImageJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "FAILED", error: message.slice(0, 191) } });
    await logAudit({ action: "CHATGPT_IMAGE_FAILED", userId: actor, organizationId: org, entity: "ChatGptImageJob", entityId: job.id });
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
let processing = false;
export function startLetterImageWorker() {
  if (timer || !imageProviderConfigured()) return;
  timer = setInterval(async () => {
    if (processing) return;
    processing = true;
    try { await processLetterImageQueue(); }
    catch { console.error("[ChatGPT] Letter image queue pass failed"); }
    finally { processing = false; }
  }, 3000).unref();
}

export function stopLetterImageWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
