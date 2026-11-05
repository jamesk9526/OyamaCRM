/// <reference lib="dom" />
import sanitizeHtml from "sanitize-html";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { type LetterSnapshot, string, LETTER_RENDERER_VERSION } from "./letter-production-contract.js";

const escape = (value: unknown) => string(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const LETTER_TAGS = ["p", "div", "span", "br", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "img", "figure", "figcaption", "a", "hr", "blockquote"];
const scalar = [/^\d+(?:\.\d+)?(?:pt|px|em|in|%)?$/];
/** Constrain documents to flow layout. No script, positioning, remote CSS, or CSS URLs. */
export function sanitizeLetterHtml(html: string, options: { authoredImages?: boolean } = {}): string {
  return sanitizeHtml(html, {
    allowedTags: LETTER_TAGS,
      allowedAttributes: { "*": ["style", "data-create-block", "data-studio-page-number", "data-studio-total-pages", "data-letter-page-break", "data-letter-spacer", "data-keep-together", "data-letter-signature"], img: ["src", "alt", "width", "height", "style"], a: ["href"], td: ["colspan", "rowspan", "style"], th: ["colspan", "rowspan", "style"] },
    allowedSchemes: ["https", "http", "mailto", "data"], allowedSchemesByTag: { img: options.authoredImages ? ["https", "data"] : ["data"] }, allowProtocolRelative: false,
    allowedStyles: { "*": {
      "font-family": [/^(?:Inter|Noto Serif|Arial|Helvetica|Calibri|Times New Roman|Georgia|serif|sans-serif|[,'"\s])+$/i],
      "font-size": scalar, "line-height": scalar, "letter-spacing": scalar,
      "margin-top": scalar, "margin-bottom": scalar, "margin-left": scalar, "margin-right": scalar,
      "padding": scalar, "padding-left": scalar, "padding-right": scalar, "padding-top": scalar, "padding-bottom": scalar,
      "color": [/^#[a-f\d]{3,8}$/i, /^rgb\([\d,\s]+\)$/], "background-color": [/^#[a-f\d]{3,8}$/i],
      "text-align": [/^(left|right|center|justify)$/], "font-weight": [/^(normal|bold|[1-9]00)$/], "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(underline|line-through|none)$/], "width": scalar, "height": scalar,
      "border": [/^\d+(?:px|pt) (?:solid|dashed) #[a-f\d]{3,8}$/i], "border-collapse": [/^collapse$/],
      "break-before": [/^page$/], "break-inside": [/^avoid$/],
    }, ...(options.authoredImages ? { img: {
      "max-width": scalar, "max-height": scalar, "vertical-align": [/^(middle|top|bottom|baseline)$/],
    } } : {}) },
  });
}

/** Parse image attributes before sanitizing, including unquoted and entity-escaped URLs. */
export function freezeLetterImages(html: string, assets: LetterSnapshot["assets"]): string {
  return sanitizeHtml(html, {
    allowedTags: LETTER_TAGS, allowedAttributes: false, allowedSchemesByTag: { img: ["data"] },
    transformTags: {
      img: (_tag, attributes) => {
        const source = attributes.src;
        const frozen = source ? assets[source] : undefined;
        if (!frozen || !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(frozen)) {
          throw new Error("A document image is missing from its frozen asset package. Upload it and regenerate the proof.");
        }
        return { tagName: "img", attribs: { ...attributes, src: frozen } };
      },
    },
  });
}

export function letterBodyHtml(snapshot: LetterSnapshot): string {
  let body = freezeLetterImages(snapshot.bodyHtml, snapshot.assets);
  body = sanitizeLetterHtml(body);
  const signature = snapshot.signature;
  const image = snapshot.assets[string(signature.signatureImageUrl)];
  if (signature.signatureImageUrl && !image) throw new Error("The signature image is missing from the frozen asset package. Regenerate this proof.");
  if (!/data-letter-signature|data-keep-together=["']signature/i.test(snapshot.bodyHtml) && (signature.signerName || image)) {
    body += `<div data-keep-together="signature"><p>${escape(signature.closingPhrase || "With gratitude,")}</p>${image ? `<img alt="Signature" src="${image}" style="height:48px;width:auto">` : ""}<p><strong>${escape(signature.signerName)}</strong><br>${escape(signature.signerTitle)}</p></div>`;
  }
  return body;
}

export function letterPrintHtml(snapshot: LetterSnapshot): string {
  const { margins: m, paper } = snapshot.layout;
  const r = snapshot.recipient;
  const date = new Date(snapshot.generatedAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${paper};margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}
    *{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;color:#172b4d;font-family:Inter,sans-serif;font-size:11pt;line-height:1.5;overflow-wrap:anywhere}
    p{margin:0 0 9pt}h1,h2,h3{break-after:avoid}p,li{orphans:2;widows:2}
    table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}td,th{border:1px solid #b6c4d6;padding:6pt;overflow-wrap:anywhere}
    img{max-width:100%;height:auto;object-fit:contain}figure{margin:9pt 0;break-inside:avoid}
    [data-letter-page-break]{break-before:page;height:0;margin:0;padding:0;color:transparent;font-size:0}
    [data-keep-together]{break-inside:avoid}[data-letter-spacer]{min-height:12pt}
    .letter-date{text-align:right}.letter-address{margin-bottom:18pt}.letter-subject{font-weight:600;margin-bottom:12pt}
  </style></head><body><p class="letter-date">${date}</p>
  ${r.name ? `<div class="letter-address">${[r.name, r.addressLine1, r.addressLine2, [r.city, r.state].filter(Boolean).join(", ") + (r.zip ? ` ${r.zip}` : "")].filter(Boolean).map(escape).join("<br>")}</div>` : ""}
  ${snapshot.subject ? `<p class="letter-subject">${escape(snapshot.subject)}</p>` : ""}${letterBodyHtml(snapshot)}</body></html>`;
}

export function letterChromeHtml(snapshot: Pick<LetterSnapshot, "branding" | "assets" | "layout" | "header" | "footer">, footer: boolean): string {
  const source = footer ? snapshot.footer : snapshot.header;
  if (source.enabled === false) return "<div></div>";
  const b = snapshot.branding;
  const logo = source.logoAlignment !== "NONE" ? snapshot.assets[string(b.logoUrl)] : undefined;
  if (!footer && source.logoAlignment !== "NONE" && b.logoUrl && !logo) throw new Error("The letterhead logo is missing from the frozen asset package. Regenerate this proof.");
  const custom = freezeLetterImages(string(source.customHtml), snapshot.assets);
  const organization = source.showOrganizationName !== false ? string(b.organizationDisplayName || b.legalOrganizationName || b.organizationName) : "";
  const label = footer ? string(source.customText) || string(b.footerLegalText) || organization : organization;
  const contact = [
    ...(source.showAddress !== false ? [b.streetAddress1 || b.addressLine1, b.streetAddress2, b.city, b.stateProvince || b.state, b.postalCode] : []),
    ...(footer && source.showEmail !== false ? [b.contactEmail] : []),
    ...(source.showPhone !== false ? [b.contactPhone] : []),
    ...(source.showWebsite !== false ? [b.websiteUrl] : []),
    ...(footer && source.showTaxId === true ? [b.taxId] : []),
  ].filter(value => typeof value === "string" && value).map(escape).join(" · ");
  return `<div style="box-sizing:border-box;font-family:Arial,sans-serif;font-size:8px;width:100%;padding:0 ${snapshot.layout.margins.right}in 0 ${snapshot.layout.margins.left}in;color:#243b58">${!footer && logo ? `<img src="${logo}" style="max-width:140px;max-height:35px;vertical-align:middle;margin-right:12px">` : ""}${custom ? sanitizeLetterHtml(custom) : `<strong>${escape(label)}</strong><div>${contact}</div>`}${footer && source.showPageNumber !== false ? '<span style="float:right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' : ""}</div>`;
}

/** Called only by the dedicated production worker. Every browser has a hard lifetime. */
export async function renderProductionLetter(snapshot: LetterSnapshot): Promise<{ bytes: Buffer; pageCount: number; warnings: string[] }> {
  if (snapshot.blockers.length) throw new Error(snapshot.blockers.join("; "));
  if (snapshot.studio) return (await import("../oyama-create/studio/print.js")).renderFrozenStudio(snapshot.studio);
  const headerTemplate = letterChromeHtml(snapshot, false);
  const footerTemplate = letterChromeHtml(snapshot, true);
  const browser = await chromium.launch({ headless: true });
  const lifetime = setTimeout(() => { void browser.close(); }, 45_000);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
    // Preflight must measure against the printable width, not Chromium's 1280px default.
    const pageWidthInches = snapshot.layout.paper === "A4" ? 210 / 25.4 : 8.5;
    const printableWidth = (pageWidthInches - snapshot.layout.margins.left - snapshot.layout.margins.right) * 96;
    const chromePage = await context.newPage();
    await chromePage.setViewportSize({ width: Math.floor(pageWidthInches * 96), height: 1056 });
    try {
      for (const [name, template, margin] of [["header", headerTemplate, snapshot.layout.margins.top], ["footer", footerTemplate, snapshot.layout.margins.bottom]] as const) {
        await chromePage.setContent(`<html><body style="margin:0">${template}</body></html>`, { waitUntil: "load" });
        await chromePage.evaluate(async () => { await Promise.all(Array.from(document.images).map(image => image.decode())); });
        const bounds = await chromePage.evaluate(() => ({ height: document.body.firstElementChild?.getBoundingClientRect().height ?? 0, overflow: document.body.scrollWidth > innerWidth + 1 }));
        // Chromium's repeated chrome includes an approximately 8px page-edge inset.
        if (bounds.height > margin * 96 - 8 || bounds.overflow) throw new Error(`The ${name} does not fit its reserved margin. Increase the ${name === "header" ? "top" : "bottom"} margin or reduce its content before printing.`);
      }
    } finally { await chromePage.close(); }
    await page.setViewportSize({ width: Math.floor(printableWidth), height: 1056 });
    page.setDefaultTimeout(15_000);
    let html = letterPrintHtml(snapshot);
    if (!snapshot.assets['font:Inter'] || !snapshot.assets['font:Noto Serif']) throw new Error("The frozen font package is missing. Regenerate this proof.");
    const fontCss = `<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${snapshot.assets['font:Inter']}) format('woff2');font-weight:100 900}@font-face{font-family:'Noto Serif';src:url(data:font/woff2;base64,${snapshot.assets['font:Noto Serif']}) format('woff2');font-weight:100 900}</style>`;
    html = html.replace("</head>", `${fontCss}</head>`);
    await page.setContent(html, { waitUntil: "load" });
    // Playwright evaluation runs through DevTools even with document scripts disabled.
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode())); });
    const issues = await page.evaluate(({ paper, margins }) => {
      const height = (paper === "A4" ? 11.6929 : paper === "Legal" ? 14 : 11) * 96 - (margins.top + margins.bottom) * 96;
      const oversized = Array.from(document.querySelectorAll("figure,img,[data-keep-together],tr")).filter(element => element.getBoundingClientRect().height > height);
      return { oversized: oversized.length, overflow: document.body.scrollWidth > document.documentElement.clientWidth + 2 };
    }, snapshot.layout);
    if (issues.oversized) throw new Error("Content is taller than the printable page. Resize images or split the grouped content/table row.");
    if (issues.overflow) throw new Error("Content exceeds the printable width. Review table and image dimensions.");
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: true, headerTemplate, footerTemplate, tagged: true });
    const pdf = await PDFDocument.load(bytes);
    pdf.setProducer(LETTER_RENDERER_VERSION);
    return { bytes: Buffer.from(await pdf.save()), pageCount: pdf.getPageCount(), warnings: snapshot.warnings };
  } finally { clearTimeout(lifetime); await browser.close(); }
}
