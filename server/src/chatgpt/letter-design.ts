import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { managedPublicMedia } from "../lib/public-media.js";
import { CreateError } from "../oyama-create/domain.js";
import { assertAvailableSelections } from "../oyama-create/trash-selection.js";
import { trashedIds } from "../oyama-create/trash-state.js";
import { assertStudioAssetOwnership } from "../oyama-create/studio/asset-ownership.js";
import { normalizeDesign } from "../oyama-create/studio/design.js";
import { htmlToStudio } from "../oyama-create/studio/html.js";
import { newBlock } from "../oyama-create/studio/registry.js";
import type { BrandDocument, StudioDesign, StudioNode } from "../oyama-create/studio/types.js";
import { LETTER_BLOCKS } from "./letter-tool-contract.js";

type Region = { mode?: "brand" | "none"; presetId?: string };
type Layout = Partial<Pick<StudioDesign["page"], "paper" | "orientation" | "headerHeight" | "footerHeight"> &
  Pick<StudioDesign["styles"], "font" | "fontSize" | "lineHeight" | "paragraphSpacing"> & {
    margins: Partial<StudioDesign["page"]["margins"]>;
    textColor: string;
    givingUrl: string;
    giftFrequency: StudioDesign["data"]["frequency"];
    replySlip: { enabled?: boolean; placement?: "attached" | "separate"; html?: string };
    outerEnvelope: Partial<StudioDesign["pack"]["outerEnvelope"]>;
    returnEnvelope: Partial<StudioDesign["pack"]["returnEnvelope"]>;
  } & Record<keyof StudioDesign["regions"], Region>>;

const blockFields: Record<keyof typeof LETTER_BLOCKS, string[]> = {
  image: ["assetId", "alt", "caption", "widthPercent", "align", "heightPixels", "fit", "focalX", "focalY"], field: ["field"], salutation: [], address: [],
  signature: ["signerId", "closing"], giving_link: ["label"], giving_qr: [], page_break: [], spacer: ["heightPoints"], divider: [],
};
type Block = {
  type: keyof typeof LETTER_BLOCKS; afterBlock?: number; assetId?: string; alt?: string; caption?: string; widthPercent?: number;
  align?: "left" | "center" | "right"; heightPixels?: number; fit?: "contain" | "cover"; focalX?: number; focalY?: number;
  field?: string; signerId?: string; closing?: string; label?: string; heightPoints?: number;
};
export type LetterChanges = { html?: string; layout?: Layout; insertBlocks?: Block[] };

function layoutChanges(design: StudioDesign, brand: BrandDocument, changes: Layout, diagnostics: string[]) {
  for (const key of ["paper", "orientation", "headerHeight", "footerHeight"] as const) {
    if (changes[key] !== undefined) Object.assign(design.page, { [key]: changes[key] });
  }
  Object.assign(design.page.margins, changes.margins);
  for (const key of ["font", "fontSize", "lineHeight", "paragraphSpacing"] as const) {
    if (changes[key] !== undefined) Object.assign(design.styles, { [key]: changes[key] });
  }
  if (changes.textColor !== undefined) {
    if (!/^#[a-f0-9]{6}$/i.test(changes.textColor)) throw new CreateError(400, "Use a six-digit hex text color, such as #172b4d.");
    design.styles.color = changes.textColor;
  }
  for (const key of ["firstHeader", "header", "firstFooter", "footer"] as const) {
    const region = changes[key];
    if (!region) continue;
    const kind = key.toLowerCase().endsWith("header") ? "header" : "footer";
    if (region.presetId && !brand.presets.some(preset => preset.id === region.presetId && preset.kind === kind && preset.active && !preset.trashed)) {
      throw new CreateError(400, `Select an active ${kind} from get_letter_design_options.`);
    }
    Object.assign(design.regions[key], region.presetId !== undefined ? { mode: "brand", ...region } : region);
  }
  if (changes.givingUrl !== undefined) design.data.givingUrl = changes.givingUrl;
  if (changes.giftFrequency !== undefined) design.data.frequency = changes.giftFrequency;
  for (const key of ["outerEnvelope", "returnEnvelope"] as const) Object.assign(design.pack[key], changes[key]);
  if (changes.replySlip) {
    const { html, ...patch } = changes.replySlip;
    Object.assign(design.pack.replySlip, patch);
    if (html !== undefined) {
      const converted = htmlToStudio(html, "chatgpt-reply-slip");
      design.pack.replySlip.content = converted.document;
      diagnostics.push(...converted.diagnostics.map(issue => `Reply slip: ${issue}`));
    }
  }
}

async function insertBlocks(org: string, body: StudioDesign["body"], blocks: Block[], brand: BrandDocument) {
  const assetIds = [...new Set(blocks.flatMap(block => block.assetId ? [block.assetId] : []))];
  const assets = assetIds.length ? await prisma.createStudioAsset.findMany({
    where: { organizationId: org, kind: "IMAGE", id: { in: assetIds, notIn: await trashedIds(org, "ASSET") } },
    select: { id: true, url: true },
  }) : [];
  const insertionPoints = new Map<number, StudioNode[]>();
  for (const block of blocks) {
    const after = block.afterBlock ?? body.content.length;
    if (after > body.content.length) throw new CreateError(400, `The letter body has ${body.content.length} blocks. Choose a valid afterBlock.`);
    if (Object.keys(block).some(key => key !== "type" && key !== "afterBlock" && !blockFields[block.type].includes(key))) throw new CreateError(400, `Unexpected option for a ${block.type} block.`);
    const node = newBlock(LETTER_BLOCKS[block.type], `mcp-${randomUUID()}`), attrs = node.attrs!;
    switch (block.type) {
      case "image": {
        if (block.alt === undefined) throw new CreateError(400, "Provide image alt text or an empty string for decorative artwork.");
        if (block.fit === "cover" && !block.heightPixels) throw new CreateError(400, "Set an image height in pixels to crop the image.");
        const asset = assets.find(item => item.id === block.assetId), media = asset && managedPublicMedia(asset.url);
        if (!media || media.organizationId !== org || !/\.(png|jpe?g|webp)$/i.test(media.fileName)) throw new CreateError(404, "Choose an active PNG, JPEG or WebP image from this organization's Studio library.");
        Object.assign(attrs, {
          src: media.publicUrl, alt: block.alt, caption: block.caption || "", width: block.widthPercent ?? 100, textAlign: block.align || "center",
          height: block.heightPixels ?? 0, crop: block.fit || "contain", focalX: block.focalX ?? 50, focalY: block.focalY ?? 50,
        });
        break;
      }
      case "field":
        if (!block.field) throw new CreateError(400, "Choose a field from get_letter_design_options.");
        attrs.field = block.field;
        break;
      case "signature":
        if (block.signerId && !brand.signers.some(signer => signer.id === block.signerId && signer.active && !signer.trashed)) throw new CreateError(400, "Choose an active signature from get_letter_design_options.");
        Object.assign(attrs, { signerId: block.signerId || "", closing: block.closing || "" });
        break;
      case "giving_link": attrs.label = block.label ?? attrs.label; break;
      case "spacer": attrs.height = block.heightPoints ?? attrs.height; break;
    }
    const group = insertionPoints.get(after) || [];
    group.push(node);
    insertionPoints.set(after, group);
  }
  body.content = [...(insertionPoints.get(0) || []), ...body.content.flatMap((node, index) => [node, ...(insertionPoints.get(index + 1) || [])])];
}

export async function applyLetterChanges(org: string, base: StudioDesign, brand: BrandDocument, changes: LetterChanges, previous?: unknown) {
  const design = structuredClone(base), diagnostics: string[] = [];
  const channel = design.channels?.LETTER;
  if (changes.html !== undefined) {
    const converted = htmlToStudio(changes.html, "chatgpt");
    if (channel) channel.document = converted.document;
    else design.body = converted.document;
    diagnostics.push(...converted.diagnostics);
  }
  if (changes.layout) layoutChanges(design, brand, changes.layout, diagnostics);
  if (changes.insertBlocks?.length) await insertBlocks(org, channel?.document || design.body, changes.insertBlocks, brand);
  const normalized = normalizeDesign(design);
  assertStudioAssetOwnership(org, normalized);
  await assertAvailableSelections(org, normalized, previous);
  return { design: normalized, diagnostics };
}
