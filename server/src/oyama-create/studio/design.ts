import { CreateError, object, string } from "../domain.js";
import { EMPTY_DOC, STUDIO_NODE_TYPES, type StudioDesign, type StudioDoc, type StudioNode, type StudioEnvelope } from "./types.js";
import { paragraph } from "./registry.js";

const ATTRS = new Set(["studioId", "level", "textAlign", "indent", "spacing", "keepTogether", "keepWithNext", "src", "alt", "width", "height", "crop", "focalX", "focalY", "caption", "href", "colspan", "rowspan", "colwidth", "background", "color", "borderColor", "signerId", "secondSignerId", "closing", "field", "operator", "value", "basis", "amounts", "multipliers", "fallback", "minimum", "maximum", "rounding", "label", "mode", "statement", "size", "html", "start", "emailOnly", "printOnly", "presetId"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight", "superscript", "subscript"]);
const FIELDS = ["name", "salutation", "address", "entityKind", "gift.amount", "gift.date", "gift.fund", "gift.receiptNumber", "gift.deductible", "giving.total", "giving.count", "giving.lastAmount", "giving.lastDate", "pledge.balance", "campaign.name", "responseCode", "asOf"];
export const DONOR_FIELDS = FIELDS;
export const CONDITION_FIELDS = ["hasGiving", "hasGift", "hasPledge", "recurring", "entityKind", "tag", "givingTotal", "lastGiftBefore"];
export function number(value: unknown, fallback: number, min: number, max: number) { return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }
export function color(value: unknown, fallback: string) { return /^#[a-f0-9]{6}$/i.test(string(value)) ? string(value) : fallback; }
export function studioUrl(value: unknown, asset = false): string {
  const text = string(value).trim(); if (!text) return "";
  if (text.length > 2000) throw new CreateError(400, "The URL exceeds 2,000 characters.");
  if (asset && /^\/uploads\/[a-z0-9/_\-.]+$/i.test(text) && !text.includes("..")) return text;
  if (!asset && /^\/give\/[a-z0-9_-]+$/i.test(text)) return text;
  try { const url = new URL(text); if (url.protocol === "https:" && !url.username && !url.password) return url.toString(); } catch { /* validated below */ }
  throw new CreateError(400, asset ? "Select an uploaded asset or complete HTTPS image URL." : "Choose a hosted giving page or complete HTTPS URL.");
}
export function studioLink(value: unknown) { const text = string(value).trim(); return /^(mailto:[^\s<>"']+@[^\s<>"']+|tel:\+?[\d(). -]{5,30})$/i.test(text) ? text : studioUrl(text); }
function safeText(value: unknown, max = 2000) { const text = string(value); if (text.length > max) throw new CreateError(400, "A Studio field exceeds its length limit."); return text; }
export function normalizeDoc(value: unknown): StudioDoc {
  const root = object(value); if (root.type !== "doc" || !Array.isArray(root.content)) throw new CreateError(400, "A structured Studio document is required.");
  const ids = new Set<string>(); let count = 0;
  function node(raw: unknown, depth: number): StudioNode {
    const input = object(raw), type = string(input.type);
    if (depth > 18 || ++count > 6000) throw new CreateError(400, "The document is too deeply nested or contains too many nodes.");
    if (!(STUDIO_NODE_TYPES as readonly string[]).includes(type) || type === "doc" && depth > 0) throw new CreateError(400, `Unsupported Studio node: ${type || "unknown"}.`);
    const result: StudioNode = { type }; const attrs: Record<string, unknown> = {};
    if (type === "text") { result.text = safeText(input.text, 50000); if (!result.text) throw new CreateError(400, "Text nodes must not be empty."); }
    for (const [key, value] of Object.entries(object(input.attrs))) {
      if (!ATTRS.has(key) || value === null || value === undefined) continue;
      if (["amounts", "multipliers", "fallback", "colwidth"].includes(key)) {
        if (!Array.isArray(value) || value.length > 25 || value.some(entry => typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1_000_000)) throw new CreateError(400, `Invalid ${key} values.`);
        attrs[key] = value;
      } else if (typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) attrs[key] = value;
      else if (typeof value === "string") attrs[key] = safeText(value, key === "html" ? 100000 : key === "statement" ? 5000 : 2000);
      else throw new CreateError(400, `Invalid block property: ${key}.`);
    }
    if(attrs.printOnly===true&&attrs.emailOnly===true)throw new CreateError(400,"A block cannot be both print-only and email-only. Choose one format or link both.");
    if (attrs.studioId) {
      const id = string(attrs.studioId);
      if (!/^[a-z0-9:_-]{1,100}$/i.test(id) || ids.has(id)) throw new CreateError(400, "Studio block identities must be unique.");
      ids.add(id);
    }
    if (type === "image") { attrs.src = studioUrl(attrs.src, true); attrs.width = number(attrs.width, 100, 5, 100); attrs.height = number(attrs.height, 0, 0, 900); attrs.focalX = number(attrs.focalX, 50, 0, 100); attrs.focalY = number(attrs.focalY, 50, 0, 100); attrs.crop = attrs.crop === "cover" ? "cover" : "contain"; attrs.href = studioUrl(attrs.href); }
    if (type === "heading") attrs.level = Math.round(number(attrs.level, 2, 1, 3));
    for (const key of ["colspan", "rowspan"]) if (attrs[key] !== undefined) attrs[key] = Math.round(number(attrs[key], 1, 1, 25));
    if (attrs.indent !== undefined) attrs.indent = number(attrs.indent, 0, 0, 6);
    if (attrs.spacing !== undefined) attrs.spacing = number(typeof attrs.spacing === "string" ? parseFloat(attrs.spacing) : attrs.spacing, 9, 0, 72);
    if (attrs.textAlign && !["left", "center", "right", "justify"].includes(string(attrs.textAlign))) throw new CreateError(400, "Invalid text alignment.");
    if (type === "letterSpacer") attrs.height = number(typeof attrs.height === "string" ? parseFloat(attrs.height) : attrs.height, 12, 0, 144);
    if (type === "studioField" && !FIELDS.includes(string(attrs.field))) throw new CreateError(400, "Choose a supported donor field.");
    if (type === "studioCondition" && (!CONDITION_FIELDS.includes(string(attrs.field)) || !["is", "isNot", "greaterThan", "lessThan"].includes(string(attrs.operator)))) throw new CreateError(400, "Choose a supported donor condition.");
    if (type === "studioAsk") { if (!["fixed", "lastGift", "largestGift"].includes(string(attrs.basis))) throw new CreateError(400, "Choose a supported ask basis."); attrs.minimum = number(attrs.minimum, 1, 0.01, 1_000_000); attrs.maximum = number(attrs.maximum, 100000, Number(attrs.minimum), 1_000_000); attrs.rounding = number(attrs.rounding, 5, 0.01, 1000); }
    if (Object.keys(attrs).length) result.attrs = attrs;
    if (input.marks !== undefined) {
      if (!Array.isArray(input.marks) || input.marks.length > 12) throw new CreateError(400, "Invalid text formatting.");
      result.marks = input.marks.map(rawMark => {
        const mark = object(rawMark), type = string(mark.type), options = object(mark.attrs);
        if (!MARKS.has(type)) throw new CreateError(400, "Unsupported text formatting.");
        if (type === "link") return { type, attrs: { href: studioLink(options.href), target: "_blank", rel: "noopener noreferrer" } };
        if (type === "textStyle") return { type, attrs: { ...(options.fontFamily ? { fontFamily: /Noto Serif|Georgia|Times/i.test(string(options.fontFamily)) ? "Noto Serif" : "Inter" } : {}), ...(options.fontSize ? { fontSize: `${number(parseFloat(string(options.fontSize)), 11, 8, 48)}pt` } : {}), ...(options.color ? { color: color(options.color, "#172b4d") } : {}), ...(options.lineHeight ? { lineHeight: String(number(parseFloat(string(options.lineHeight)), 1.5, 1, 2.5)) } : {}) } };
        if (type === "highlight") return { type, attrs: { color: color(options.color, "#fff2b2") } };
        return { type };
      });
    }
    if (input.content !== undefined) {
      if (!Array.isArray(input.content)) throw new CreateError(400, "Invalid structured block content.");
      result.content = input.content.map(child => node(child, depth + 1));
    }
    const children = result.content || [], inline = new Set(["text", "hardBreak"]);
    const allows = type === "table" ? ["tableRow"] : type === "tableRow" ? ["tableCell", "tableHeader"] : type === "bulletList" || type === "orderedList" ? ["listItem"] : type === "studioColumns" ? ["studioColumn"] : null;
    if (allows && children.some(child => !allows.includes(child.type))) throw new CreateError(400, `Invalid content inside ${type}.`);
    if (["paragraph", "heading"].includes(type) && children.some(child => !inline.has(child.type))) throw new CreateError(400, "A text paragraph cannot contain block content.");
    if (["text", "hardBreak", "horizontalRule", "image", "letterPageBreak", "letterSpacer"].includes(type) && children.length) throw new CreateError(400, `The ${type} block cannot contain child blocks.`);
    if (["doc", "blockquote", "listItem", "tableCell", "tableHeader", "studioGroup", "studioColumn", "studioCallout", "studioImpact", "studioCondition"].includes(type) && children.some(child => inline.has(child.type) || ["tableRow", "tableCell", "tableHeader", "listItem", "studioColumn"].includes(child.type))) throw new CreateError(400, `Invalid block structure inside ${type}.`);
    return result;
  }
  const doc = node(root, 0) as StudioDoc;
  if (JSON.stringify(doc).length > 600000) throw new CreateError(400, "The structured document exceeds 600 KB.");
  return doc;
}
export function defaultDesign(): StudioDesign {
  const region = (): StudioDesign["regions"]["header"] => ({ mode: "brand", presetId: "", content: EMPTY_DOC() });
  const envelope = (size: StudioEnvelope["size"]): StudioEnvelope => ({ enabled: false, size, window: false, addressX: .75, addressY: 1.5, addressWidth: 4, offsetX: 0, offsetY: 0 });
  return {
    version: 2, body: { type: "doc", content: [paragraph("opening")] },
    page: { paper: "LETTER", orientation: "portrait", margins: { top: .8, right: .75, bottom: .8, left: .75 }, headerHeight: .45, footerHeight: .35 },
    styles: { font: "Noto Serif", emailFont: "Georgia, 'Times New Roman', serif", fontSize: 11, lineHeight: 1.5, color: "#172b4d", primary: "#245ec7", accent: "#315f82", background: "#ffffff", paragraphSpacing: 9 },
    brandRevisionId: null, profileId: "", regions: { firstHeader: region(), header: region(), firstFooter: region(), footer: region() },
    pack: { replySlip: { enabled: false, placement: "attached", content: EMPTY_DOC() }, outerEnvelope: envelope("#10"), returnEnvelope: envelope("#9") },
    data: { period: "calendar", year: new Date().getFullYear(), from: "", to: "", giftPolicy: "latest-completed", giftSelections: {}, givingUrl: "", frequency: "one-time", designation: "" },
    email: { overrides: Object.create(null) as Record<string,StudioNode>, subject: "", previewText: "", reviewedSource: null },
  };
}
export function normalizeDesign(value: unknown): StudioDesign {
  const raw = object(value); if (raw.version !== 2) throw new CreateError(400, "A version 2 Studio design is required.");
  const result = defaultDesign(), page = object(raw.page), margins = object(page.margins), styles = object(raw.styles), pack = object(raw.pack), data = object(raw.data), email = object(raw.email);
  result.body = normalizeDoc(raw.body);
  result.brandRevisionId = string(raw.brandRevisionId) || null; result.profileId = safeText(raw.profileId, 191);
  result.page.paper = page.paper === "A4" || page.paper === "LEGAL" ? page.paper : "LETTER"; result.page.orientation = page.orientation === "landscape" ? "landscape" : "portrait";
  for (const key of ["top", "right", "bottom", "left"] as const) result.page.margins[key] = number(margins[key], result.page.margins[key], .125, 1.5);
  result.page.headerHeight = number(page.headerHeight, .45, 0, 1.25); result.page.footerHeight = number(page.footerHeight, .35, 0, 1.25);
  result.styles = { font: styles.font === "Inter" ? "Inter" : "Noto Serif", emailFont: styles.font === "Inter" ? "Arial, Helvetica, sans-serif" : "Georgia, 'Times New Roman', serif", fontSize: number(styles.fontSize, 11, 8, 24), lineHeight: number(styles.lineHeight, 1.5, 1, 2.5), color: color(styles.color, result.styles.color), primary: color(styles.primary, result.styles.primary), accent: color(styles.accent, result.styles.accent), background: color(styles.background, "#ffffff"), paragraphSpacing: number(styles.paragraphSpacing, 9, 0, 36) };
  for (const key of ["firstHeader", "header", "firstFooter", "footer"] as const) { const region = object(object(raw.regions)[key]); result.regions[key] = { mode: region.mode === "custom" || region.mode === "none" ? region.mode : "brand", presetId: safeText(region.presetId, 191), content: region.content ? normalizeDoc(region.content) : EMPTY_DOC() }; }
  const reply = object(pack.replySlip); result.pack.replySlip = { enabled: reply.enabled === true, placement: reply.placement === "separate" ? "separate" : "attached", content: reply.content ? normalizeDoc(reply.content) : EMPTY_DOC() };
  for (const key of ["outerEnvelope", "returnEnvelope"] as const) { const source = object(pack[key]); result.pack[key] = { enabled: source.enabled === true, size: source.size === "DL" || source.size === "#9" ? source.size : "#10", window: source.window === true, addressX: number(source.addressX, .75, 0, 8), addressY: number(source.addressY, 1.5, 0, 4), addressWidth: number(source.addressWidth, 4, 1, 6), offsetX: number(source.offsetX, 0, -.5, .5), offsetY: number(source.offsetY, 0, -.5, .5) }; }
  result.data = { period: data.period === "fiscal" || data.period === "custom" ? data.period : "calendar", year: Math.round(number(data.year, result.data.year, 2000, 3000)), from: safeText(data.from, 32), to: safeText(data.to, 32), giftPolicy: data.giftPolicy === "selected" ? "selected" : "latest-completed", giftSelections: {}, givingUrl: studioUrl(data.givingUrl), frequency: data.frequency === "monthly" ? "monthly" : "one-time", designation: safeText(data.designation, 191) };
  const selections = Object.entries(object(data.giftSelections)); if (selections.length > 15000) throw new CreateError(400, "Too many selected gifts.");
  for (const [id, gift] of selections) { if (!/^[a-z0-9_-]{1,191}$/i.test(id) || !/^[a-z0-9_-]{1,191}$/i.test(string(gift))) throw new CreateError(400, "Invalid selected gift identity."); result.data.giftSelections[id] = string(gift); }
  const validDate=(value:string)=>{const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
  if (result.data.period === "custom" && (!/^\d{4}-\d{2}-\d{2}$/.test(result.data.from) || !/^\d{4}-\d{2}-\d{2}$/.test(result.data.to) || result.data.from > result.data.to || !validDate(result.data.from) || !validDate(result.data.to))) throw new CreateError(400, "Choose a valid giving period.");
  for (const [id, node] of Object.entries(object(email.overrides))) { if (!/^[a-z0-9:_-]{1,100}$/i.test(id)) throw new CreateError(400, "Invalid customized email block identity."); const normalized = normalizeDoc({ type: "doc", content: [node] }).content[0]; if (normalized.attrs?.studioId !== id) throw new CreateError(400, "An email customization must retain its linked block identity."); result.email.overrides[id] = normalized; }
  result.email.subject = safeText(email.subject, 1000); result.email.previewText = safeText(email.previewText, 1000); result.email.reviewedSource = string(email.reviewedSource) || null;
  if (JSON.stringify(result).length > 1500000) throw new CreateError(400, "The appeal design exceeds 1.5 MB.");
  return result;
}
export function walkNodes(doc: StudioNode): StudioNode[] { return [doc, ...(doc.content || []).flatMap(walkNodes)]; }
export function sourceIdentity(design: StudioDesign): string { return JSON.stringify({ body: design.body, styles: design.styles, regions: design.regions, brand: design.brandRevisionId, data: design.data, profile: design.profileId }); }
export function emailReviewRequired(design: StudioDesign) { return Object.keys(design.email.overrides).length > 0 && design.email.reviewedSource !== sourceIdentity(design); }
export function dimensions(page: StudioDesign["page"]): { width: number; height: number; bodyWidth: number; bodyHeight: number } {
  let [width, height] = page.paper === "A4" ? [210 / 25.4, 297 / 25.4] : page.paper === "LEGAL" ? [8.5, 14] : [8.5, 11];
  if (page.orientation === "landscape") [width, height] = [height, width];
  return { width: width * 96, height: height * 96, bodyWidth: (width - page.margins.left - page.margins.right) * 96, bodyHeight: (height - page.margins.top - page.margins.bottom) * 96 };
}
