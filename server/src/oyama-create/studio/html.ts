import { parseDocument, DomUtils } from "htmlparser2";
import { normalizePublicMediaUrl } from "../../lib/public-media.js";
import { escapeHtml } from "../domain.js";
import type { StudioDoc, StudioNode } from "./types.js";

type HtmlNode = ReturnType<typeof parseDocument>["children"][number];
const tags = new Set("p div span h1 h2 h3 h4 h5 h6 strong b em i u s strike blockquote ul ol li br hr img a table thead tbody tfoot tr td th center figure figcaption small sub sup".split(" "));
const voids = new Set(["br", "hr", "img"]);
const css = new Set("color background background-color font-family font-size font-weight font-style line-height text-align text-decoration vertical-align width max-width min-width height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-collapse border-spacing border-radius display float clear white-space overflow-wrap word-break table-layout object-fit object-position break-inside break-before break-after".split(" "));
function safeUrl(value: string, image = false) {
  if (!image && /^\{\{(?:unsubscribeUrl|managePreferencesUrl|preferencesUrl)\}\}$/.test(value)) return value;
  const normalized = image ? normalizePublicMediaUrl(value) : value;
  if (/^\/(?!\/)/.test(normalized) && !normalized.includes("..")) return normalized;
  if (/^#[a-z0-9_-]*$/i.test(normalized)) return normalized;
  if (!image && /^(mailto:|tel:)/i.test(normalized) && !/[<>\s"']/.test(normalized)) return normalized;
  try { const url = new URL(normalized); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString().replace(/%7B%7B([a-zA-Z0-9_.]+)%7D%7D/gi,"{{$1}}") : ""; } catch { return ""; }
}

/** Repair inherited logos whose dimensions were removed by the older brand sanitizer. */
export function restoreLegacyLogoBounds(html: string, logoUrl: string) {
  if (!logoUrl || !/<img\b/i.test(html)) return html;
  const logo = normalizePublicMediaUrl(logoUrl);
  const document = parseDocument(html);
  let changed = false;
  // Older brand projection could wrap a complete legacy header and inject its logo again.
  // Remove only that recognizable automatic wrapper's image, not intentional repeated artwork.
  for (const wrapper of DomUtils.getElementsByTagName("div", document.children)) {
    if (!/font-size:\s*8px/i.test(wrapper.attribs.style || "")) continue;
    const children = wrapper.children.filter(node => "attribs" in node);
    const [automatic, nested] = children;
    if (!automatic || !nested || !("attribs" in automatic) || !("attribs" in nested) || automatic.name !== "img" || nested.name !== "div" || !/font-size:\s*8px/i.test(nested.attribs.style || "")) continue;
    if (normalizePublicMediaUrl(automatic.attribs.src || "") !== logo || !/max-width:\s*140px/i.test(automatic.attribs.style || "")) continue;
    if (DomUtils.getElementsByTagName("img", nested.children).some(image => normalizePublicMediaUrl(image.attribs.src || "") === logo)) { DomUtils.removeElement(automatic); changed = true; }
  }
  for (const image of DomUtils.getElementsByTagName("img", document.children)) {
    const { src, style = "", width, height } = image.attribs;
    if (!src || normalizePublicMediaUrl(src) !== logo || width || height || /(?:^|;)\s*(?:(?:min|max)-)?(?:width|height)\s*:/i.test(style)) continue;
    image.attribs.style = `${style};max-width:140px;max-height:35px;vertical-align:middle`.replace(/^;/, "");
    changed = true;
  }
  return changed ? DomUtils.getOuterHTML(document) : html;
}

/** Shared by conversion, validation and rendering. Originals are kept separately, never executed. */
export function sanitizeStudioHtml(html: string, classicMarkers = false): string {
  const serialize = (node: HtmlNode): string => {
    if (node.type === "text") return escapeHtml(node.data);
    if (!("attribs" in node) || !tags.has(node.name)) {
      if ("attribs" in node && ["script", "style", "iframe", "object", "embed", "form", "input"].includes(node.name)) return "";
      return "children" in node ? node.children.map(serialize).join("") : "";
    }
    const attributes: string[] = [];
    for (const [key, raw] of Object.entries(node.attribs)) {
      let value = raw;
      if (["href", "src"].includes(key)) value = classicMarkers && key === "src" && raw.length <= 1_500_000 && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw) ? raw : safeUrl(raw, key === "src");
      else if (key === "style") value = raw.split(";").map(part => {
        const colon = part.indexOf(":"), name = part.slice(0, colon).trim().toLowerCase(), item = part.slice(colon + 1).trim();
        return colon > 0 && css.has(name) && !/url\s*\(|expression|@|[<>\\\x00-\x1f]/i.test(item) ? `${name}:${item}` : "";
      }).filter(Boolean).join(";");
      else if (!["alt", "title", "width", "height", "colspan", "rowspan", "align", "valign", "cellpadding", "cellspacing", "border", "bgcolor", "role", "start", "data-letter-page-break", "data-letter-spacer", "data-studio-page-number", "data-studio-total-pages", "data-letter-signature", "data-keep-together"].includes(key)
        && !(classicMarkers && ["data-oyama-block", "data-letter-image-block", "data-letter-qr", "data-letter-qr-block", "data-letter-qr-destination", "data-letter-table", "data-letter-width"].includes(key))) continue;
      if(key.startsWith("data-")&&!value)value="true";
      if (value) attributes.push(`${key}="${escapeHtml(value)}"`);
    }
    return `<${node.name}${attributes.length ? " " + attributes.join(" ") : ""}>${voids.has(node.name) ? "" : node.children.map(serialize).join("") + `</${node.name}>`}`;
  };
  return parseDocument(html).children.map(serialize).join("");
}

export function htmlToStudio(html: string, prefix: string): { document: StudioDoc; diagnostics: string[] } {
  const diagnostics: string[] = [], sanitized = sanitizeStudioHtml(html);
  // Deliberately conservative: a layout we cannot represent stays a visible HTML block.
  if (/<script\b|\son\w+\s*=|javascript:|<iframe\b|<style\b/i.test(html)) diagnostics.push("Unsafe or unsupported active markup was removed; compare the original before use.");
  let sequence = 0;
  const id = () => `${prefix}-${++sequence}`;
  const preserved = (node: HtmlNode): StudioNode => {
    diagnostics.push("Complex HTML retained as an editable preserved block. Review its layout before release.");
    return { type: "studioHtml", attrs: { studioId: id(), html: sanitizeStudioHtml(DomUtils.getOuterHTML(node)), reviewedHtml: "" } };
  };
  const inline = (nodes: HtmlNode[], marks: NonNullable<StudioNode["marks"]> = []): StudioNode[] => nodes.flatMap(node => {
    if (node.type === "text") return node.data ? [{ type: "text", text: node.data, ...(marks.length ? { marks } : {}) }] : [];
    if (!("attribs" in node)) return [];
    if (node.name === "br") return [{ type: "hardBreak" }];
    const mark = ({ strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline", s: "strike", strike: "strike", sub: "subscript", sup: "superscript", a: "link" } as Record<string, string>)[node.name];
    return inline(node.children, mark ? [...marks, { type: mark, ...(mark === "link" ? { attrs: { href: node.attribs.href } } : {}) }] : marks);
  });
  const simpleInline = (nodes: HtmlNode[]): boolean => nodes.every(node => node.type === "text" || "attribs" in node && ["strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "a", "br", "span"].includes(node.name) && Object.keys(node.attribs).every(key => node.name === "a" && key === "href") && simpleInline(node.children));
  const blocks = (nodes: HtmlNode[]): StudioNode[] => nodes.flatMap(node => {
    if (node.type === "text") return node.data.trim() ? [{ type: "paragraph", attrs: { studioId: id() }, content: [{ type: "text", text: node.data }] }] : [];
    if (!("attribs" in node)) return [];
    const attrs = node.attribs, base = { studioId: id() };
    if (node.name === "div" && !Object.keys(attrs).length) return blocks(node.children);
    if (/^(p|h[1-6])$/.test(node.name) && !Object.keys(attrs).length && simpleInline(node.children)) return [{ type: node.name === "p" ? "paragraph" : "heading", attrs: { ...base, ...(node.name !== "p" ? { level: Math.min(3, Number(node.name[1])) } : {}) }, content: inline(node.children) }];
    if (node.name === "hr") return [{ type: "horizontalRule", attrs: base }];
    if (node.name === "img" && Object.keys(attrs).every(key => ["src", "alt", "title"].includes(key)) && attrs.src) return [{ type: "image", attrs: { ...base, src: attrs.src, alt: attrs.alt || "", width: 100 } }];
    if (["ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tfoot", "tr", "td", "th"].includes(node.name) && Object.keys(attrs).every(key => ["colspan", "rowspan"].includes(key))) {
      const type = ({ ul: "bulletList", ol: "orderedList", li: "listItem", blockquote: "blockquote", table: "table", tr: "tableRow", td: "tableCell", th: "tableHeader" } as Record<string, string>)[node.name];
      const content = ["li", "td", "th"].includes(node.name) && simpleInline(node.children) ? [{ type: "paragraph", attrs: { studioId: id() }, content: inline(node.children) }] : blocks(node.children);
      return type ? [{ type, attrs: { ...base, ...(attrs.colspan ? { colspan: Number(attrs.colspan) } : {}), ...(attrs.rowspan ? { rowspan: Number(attrs.rowspan) } : {}) }, content }] : content;
    }
    return [preserved(node)];
  });
  return { document: { type: "doc", content: blocks(parseDocument(sanitized).children) }, diagnostics: [...new Set(diagnostics)] };
}
