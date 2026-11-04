import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma.js";
import { LETTER_RENDERER_VERSION, record, string, productionLayout, addressFingerprint, type LetterSnapshot } from "./letter-production-contract.js";
import { sanitizeLetterHtml } from "./letter-production-renderer.js";

export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export class ProductionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function productionEnabled(organizationId: string): Promise<boolean> {
  const setting = await prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId, pluginKey: "letters-production-v2" } } });
  return record(setting?.config).enabled === true;
}
export const recipientSnapshot = (contact: { firstName?: string | null; lastName?: string | null; displayName?: string | null; organizationName?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null): LetterSnapshot["recipient"] => ({
  name: contact?.displayName || contact?.organizationName || [contact?.firstName, contact?.lastName].filter(Boolean).join(" "),
  addressLine1: contact?.addressLine1 || "", addressLine2: contact?.addressLine2 || "", city: contact?.city || "", state: contact?.state || "", zip: contact?.zip || "",
});

export async function freezeAsset(source: string, organizationId: string): Promise<string> {
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source) && source.length <= 7_000_000) return source;
  // Only tenant-owned uploads. Never dereference a supplied host, local file, or SVG.
  let pathname = source;
  if (/^https?:/i.test(source)) pathname = new URL(source).pathname;
  pathname = pathname.replace(/^\/api\/letters\/media\/([^/]+)\//, "/uploads/letter-media/$1/");
  const match = pathname.match(/^\/uploads\/(letter-media|branding)\/([a-z0-9_-]+)\/([a-z0-9._-]+\.(png|jpe?g|webp))$/i);
  if (!match || match[2] !== organizationId || match[3].includes("..")) throw new ProductionError(422, "An image is not an authorized tenant upload. Upload the image to this organization before printing.");
  const bytes = await readFile(path.resolve("public", "uploads", match[1], match[2], match[3]));
  if (!bytes.length || bytes.length > 5_000_000) throw new ProductionError(422, "An image is empty or exceeds the 5 MB print limit.");
  return `data:image/${match[4].toLowerCase().startsWith("jp") ? "jpeg" : match[4].toLowerCase()};base64,${bytes.toString("base64")}`;
}

export async function buildProductionSnapshot(input: { organizationId: string; templateId: string; bodyHtml: string; subject: string; recipientId?: string | null; generatedAt?: Date; generatedLetterId?: string; blockers?: string[] }): Promise<LetterSnapshot> {
  const { organizationId } = input;
  const [template, brandingSetting, organization, recipient, defaultHeader, defaultFooter, defaultSignature] = await Promise.all([
    prisma.letterTemplate.findFirst({ where: { id: input.templateId, organizationId }, include: { headerPreset: true, footerPreset: true, signatureBlock: true } }),
    prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId, pluginKey: "organization-branding" } } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    input.recipientId ? prisma.constituent.findFirst({ where: { id: input.recipientId, organizationId } }) : null,
    prisma.letterHeaderPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.letterFooterPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.letterSignatureBlock.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
  ]);
  if (!template) throw new ProductionError(404, "Template not found.");
  if (input.recipientId && !recipient) throw new ProductionError(422, "Recipient is unavailable.");
  const branding = { organizationName: organization?.name, ...record(brandingSetting?.config) };
  const signature = record(template.signatureBlock ?? defaultSignature ?? { signerName: record(branding).defaultLetterSignerName, signerTitle: record(branding).defaultLetterSignerTitle, signatureImageUrl: record(branding).defaultLetterSignatureImageUrl, closingPhrase: record(branding).defaultLetterClosingPhrase });
  const snapshot: LetterSnapshot = {
    version: 2, organizationId, templateId: template.id, revision: template.revision, generatedLetterId: input.generatedLetterId,
    title: template.name, subject: input.subject, bodyHtml: input.bodyHtml, generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    recipientId: recipient?.id ?? null, recipient: recipientSnapshot(recipient), branding,
    header: record(template.headerPreset ?? defaultHeader), footer: record(template.footerPreset ?? defaultFooter), signature,
    layout: productionLayout(template.printLayoutJson), assets: {}, warnings: [], blockers: [...(input.blockers ?? [])],
  };
  if (recipient?.doNotContact || recipient?.doNotMail) snapshot.blockers.push("Recipient is suppressed from postal contact.");
  if (recipient && (!recipient.addressLine1?.trim() || !recipient.city?.trim() || !recipient.zip?.trim())) snapshot.blockers.push("Recipient postal address is incomplete.");
  if (!recipient) snapshot.warnings.push("Sample proof only: select a real recipient before production approval.");
  const sources = new Set<string>();
  for (const html of [input.bodyHtml, string(snapshot.header.customHtml), string(snapshot.footer.customHtml)]) {
    for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) sources.add(match[1]);
  }
  if (brandingSetting && record(branding).logoUrl) sources.add(string(record(branding).logoUrl));
  if (signature.signatureImageUrl) sources.add(string(signature.signatureImageUrl));
  for (const source of sources) snapshot.assets[source] = await freezeAsset(source, organizationId);
  // Freeze font bytes as well; queued jobs must not depend on a later deployment's fonts.
  for (const [key, file] of [["font:Inter", "inter-latin-variable.woff2"], ["font:Noto Serif", "noto-serif-latin.woff2"]]) {
    snapshot.assets[key] = (await readFile(path.resolve("public/fonts", file))).toString("base64");
  }
  if (/Calibri|Arial|Helvetica|Times New Roman|Georgia/i.test(input.bodyHtml)) snapshot.warnings.push("Legacy font mapping: Calibri/Arial/Helvetica → Inter; Times New Roman/Georgia → Noto Serif.");
  snapshot.bodyHtml = snapshot.bodyHtml.replace(/font-family\s*:\s*[^;"<>]+/gi, value => /Times|Georgia|(?<!sans-)serif/i.test(value) ? "font-family: 'Noto Serif'" : "font-family: Inter");
  return snapshot;
}

export async function enqueueSnapshot(snapshot: LetterSnapshot, actorId: string) {
  const fingerprint = digest(JSON.stringify({ renderer: LETTER_RENDERER_VERSION, snapshot }));
  return prisma.letterRenderJob.upsert({ where: { organizationId_fingerprint: { organizationId: snapshot.organizationId, fingerprint } }, update: {}, create: {
    organizationId: snapshot.organizationId, generatedLetterId: snapshot.generatedLetterId, fingerprint,
    rendererVersion: LETTER_RENDERER_VERSION, snapshotJson: json(snapshot), createdBy: actorId,
  } });
}

export function artifactPath(organizationId: string, id: string): string {
  if (![organizationId, id].every(value => /^[a-z0-9_-]{3,128}$/i.test(value))) throw new ProductionError(400, "Invalid artifact identifier.");
  const root = path.resolve(process.env.LETTERS_ARTIFACT_ROOT || ".private/letter-artifacts");
  return path.join(root, organizationId, `${id}.pdf`);
}
export async function readArtifact(organizationId: string, id: string) {
  const job = await prisma.letterRenderJob.findFirst({ where: { id, organizationId } });
  if (!job) throw new ProductionError(404, "Artifact not found.");
  if (job.status !== "READY" || !job.checksum) throw new ProductionError(409, "The PDF is not ready. Review the render status.");
  const bytes = await readFile(artifactPath(organizationId, id));
  if (digest(bytes) !== job.checksum) throw new ProductionError(409, "The stored PDF failed its integrity check. Do not print it.");
  return { job, bytes };
}

export async function validateCurrentRecipient(organizationId: string, snapshot: LetterSnapshot) {
  if (!snapshot.recipientId) throw new ProductionError(422, "Sample proofs cannot be approved for production.");
  const current = await prisma.constituent.findFirst({ where: { id: snapshot.recipientId, organizationId } });
  if (!current || current.doNotMail || current.doNotContact) throw new ProductionError(422, "Recipient is unavailable or suppressed. Regenerate and review this item.");
  if (addressFingerprint(recipientSnapshot(current)) !== addressFingerprint(snapshot.recipient)) throw new ProductionError(409, "Recipient address changed. Regenerate and review this item.");
  if (snapshot.blockers.length) throw new ProductionError(422, snapshot.blockers.join("; "));
}

/** Lease/CAS fences old workers: a crashed process can never publish over a reclaimed job. */
export async function processNextLetterJob(render: (snapshot: LetterSnapshot) => Promise<{ bytes: Buffer; pageCount: number; warnings: string[] }>): Promise<boolean> {
  const now = new Date();
  const due = { OR: [{ status: "PENDING" }, { status: "RENDERING", leaseUntil: { lt: now } }] };
  const job = await prisma.letterRenderJob.findFirst({ where: { ...due, attempts: { lt: 3 } }, orderBy: { createdAt: "asc" } });
  if (!job) return false;
  const token = randomUUID();
  const claim = await prisma.letterRenderJob.updateMany({ where: { id: job.id, ...due, attempts: { lt: 3 } }, data: { status: "RENDERING", leaseToken: token, leaseUntil: new Date(Date.now() + 90_000), attempts: { increment: 1 }, error: null } });
  if (!claim.count) return true;
  try {
    const result = await render(job.snapshotJson as unknown as LetterSnapshot);
    const filename = artifactPath(job.organizationId, job.id);
    await mkdir(path.dirname(filename), { recursive: true });
    // The lease token is part of the filename, so stale workers cannot replace approved bytes.
    const temp = `${filename}.${token}`;
    await writeFile(temp, result.bytes, { flag: "wx", mode: 0o600 });
    await prisma.$transaction(async tx => {
      const owned = await tx.letterRenderJob.updateMany({ where: { id: job.id, leaseToken: token, status: "RENDERING" }, data: { status: "READY", checksum: digest(result.bytes), pageCount: result.pageCount, warningsJson: json(result.warnings), leaseUntil: null, leaseToken: null } });
      if (!owned.count) throw new Error("Render lease was reclaimed; result discarded.");
      await rename(temp, filename);
    });
  } catch (error) {
    await prisma.letterRenderJob.updateMany({ where: { id: job.id, leaseToken: token }, data: { status: "FAILED", error: error instanceof Error ? error.message : "PDF rendering failed", leaseUntil: null, leaseToken: null } });
  }
  return true;
}

export async function combineArtifacts(organizationId: string, ids: string[]) {
  const document = await PDFDocument.create();
  const ranges: Array<{ artifactId: string; start: number; end: number }> = [];
  for (const id of ids) {
    const { bytes } = await readArtifact(organizationId, id);
    const part = await PDFDocument.load(bytes);
    const start = document.getPageCount() + 1;
    for (const page of await document.copyPages(part, part.getPageIndices())) document.addPage(page);
    ranges.push({ artifactId: id, start, end: document.getPageCount() });
  }
  return { bytes: Buffer.from(await document.save()), ranges };
}

/** Sanitized canonical HTML is persisted with editor JSON; never trust client HTML in rendering. */
export function cleanDocumentBody(html: string): string { return sanitizeLetterHtml(html); }
