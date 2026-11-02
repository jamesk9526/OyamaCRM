/// <reference lib="dom" />
import sanitizeHtml from "sanitize-html";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { type LetterSnapshot, string, LETTER_RENDERER_VERSION } from "./letter-production-contract.js";

const escape = (value: unknown) => string(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const scalar = [/^\d+(?:\.\d+)?(?:pt|px|em|in|%)?$/];
/** Constrain documents to flow layout. No script, positioning, remote CSS, or CSS URLs. */
export function sanitizeLetterHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "div", "span", "br", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "img", "figure", "figcaption", "a", "hr", "blockquote"],
    allowedAttributes: { "*": ["style", "data-letter-page-break", "data-letter-spacer", "data-keep-together"], img: ["src", "alt", "width", "height", "style"], a: ["href"], td: ["colspan", "rowspan", "style"], th: ["colspan", "rowspan", "style"] },
    allowedSchemes: ["https", "http", "mailto", "data"], allowedSchemesByTag: { img: ["data"] }, allowProtocolRelative: false,
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
    } },
  });
}

export function letterBodyHtml(snapshot: LetterSnapshot): string {
  let body = snapshot.bodyHtml.replace(/<img\b[^>]*>/gi, tag => tag.replace(/\bsrc\s*=\s*(["'])(.*?)\1/i, (_m, quote, src: string) => `src=${quote}${snapshot.assets[src] ?? ""}${quote}`));
  body = sanitizeLetterHtml(body);
  const signature = snapshot.signature;
  const image = snapshot.assets[string(signature.signatureImageUrl)];
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
    img{max-width:100%;object-fit:contain}figure{margin:9pt 0;break-inside:avoid}
    [data-letter-page-break]{break-before:page;height:0;margin:0;padding:0;color:transparent;font-size:0}
    [data-keep-together]{break-inside:avoid}[data-letter-spacer]{min-height:12pt}
    .letter-date{text-align:right}.letter-address{margin-bottom:18pt}.letter-subject{font-weight:600;margin-bottom:12pt}
  </style></head><body><p class="letter-date">${date}</p>
  ${r.name ? `<div class="letter-address">${[r.name, r.addressLine1, r.addressLine2, [r.city, r.state].filter(Boolean).join(", ") + (r.zip ? ` ${r.zip}` : "")].filter(Boolean).map(escape).join("<br>")}</div>` : ""}
  ${snapshot.subject ? `<p class="letter-subject">${escape(snapshot.subject)}</p>` : ""}${letterBodyHtml(snapshot)}</body></html>`;
}

function chrome(snapshot: LetterSnapshot, footer: boolean): string {
  const source = footer ? snapshot.footer : snapshot.header;
  if (source.enabled === false) return "<div></div>";
  const b = snapshot.branding;
  const logo = snapshot.assets[string(b.logoUrl)];
  const custom = string(source.customHtml);
  const label = footer ? string(source.customText) || string(b.footerLegalText) : string(b.organizationDisplayName || b.legalOrganizationName || b.organizationName);
  const contact = [b.addressLine1, b.city, b.state, b.postalCode, b.contactEmail, b.contactPhone, b.websiteUrl].filter(value => typeof value === "string" && value).map(escape).join(" · ");
  return `<div style="font-family:Arial,sans-serif;font-size:8px;width:100%;padding:0 ${snapshot.layout.margins.right}in 0 ${snapshot.layout.margins.left}in;color:#243b58">${!footer && logo ? `<img src="${logo}" style="max-width:140px;max-height:35px;vertical-align:middle;margin-right:12px">` : ""}${custom ? sanitizeLetterHtml(custom) : `<strong>${escape(label)}</strong><div>${contact}</div>`}${footer && source.showPageNumber !== false ? '<span style="float:right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' : ""}</div>`;
}

/** Called only by the dedicated production worker. Every browser has a hard lifetime. */
export async function renderProductionLetter(snapshot: LetterSnapshot): Promise<{ bytes: Buffer; pageCount: number; warnings: string[] }> {
  if (snapshot.blockers.length) throw new Error(snapshot.blockers.join("; "));
  const browser = await chromium.launch({ headless: true });
  const lifetime = setTimeout(() => { void browser.close(); }, 45_000);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
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
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1, displayHeaderFooter: true, headerTemplate: chrome(snapshot, false), footerTemplate: chrome(snapshot, true), tagged: true });
    const pdf = await PDFDocument.load(bytes);
    pdf.setProducer(LETTER_RENDERER_VERSION);
    return { bytes: Buffer.from(await pdf.save()), pageCount: pdf.getPageCount(), warnings: snapshot.warnings };
  } finally { clearTimeout(lifetime); await browser.close(); }
}
