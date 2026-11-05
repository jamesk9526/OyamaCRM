/// <reference lib="dom" />
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { renderEnvelope } from "./envelope.js";
import { freezeAsset, ProductionError } from "../../services/letter-production.js";
import { defaultDesign, dimensions, walkNodes } from "./design.js";
import { renderStudio, renderRegion, givingLink, regionIssues, designSensitive } from "./render.js";
import { studioContentCss } from "./layout.js";
import type { ArtifactKind, BrandDocument, DonorContext, FrozenStudioPrint, StudioDesign } from "./types.js";

export async function freezeStudioPrint(org: string, design: StudioDesign, donor: DonorContext, brand: BrandDocument, kind: ArtifactKind = "LETTER", sample = false): Promise<FrozenStudioPrint> {
  const metrics = dimensions(design.page), url = givingLink(design, undefined, donor.responseCode), qrImages: Record<string, string> = {};
  if (url && [design.body, design.pack.replySlip.content].flatMap(walkNodes).some(node => node.type === "studioQr")) qrImages[url] = await QRCode.toDataURL(new URL(url, process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000").toString(), { errorCorrectionLevel: "M", margin: 4, width: 384 });
  const rendered = renderStudio(design, donor, brand, { channel: "LETTER", artifact: kind, qrImages, sample });
  rendered.issues.push(...regionIssues(design,donor,brand));
  const snapshot: FrozenStudioPrint = { sensitive:designSensitive(design)||brand.presets.some(preset=>designSensitive({...design,body:preset.content})), version: 1, kind, width: metrics.width / 96, height: metrics.height / 96, margins: { ...design.page.margins }, styles: { ...design.styles }, html: rendered.html, headers: [renderRegion(design, donor, brand, "firstHeader"), renderRegion(design, donor, brand, "header")], footers: [renderRegion(design, donor, brand, "firstFooter"), renderRegion(design, donor, brand, "footer")], assets: {}, issues: rendered.issues, responseCode: donor.responseCode, brandRevisionId: design.brandRevisionId };
  if (kind === "OUTER_ENVELOPE" || kind === "RETURN_ENVELOPE") {
    const renderedEnvelope=renderEnvelope(design,donor,brand,kind,sample);
    snapshot.width=renderedEnvelope.width;snapshot.height=renderedEnvelope.height;
    snapshot.margins={top:0,right:0,bottom:0,left:0};snapshot.headers=["",""];snapshot.footers=["",""];
    snapshot.issues=renderedEnvelope.issues;snapshot.html=renderedEnvelope.html;
  }
  const sources = new Set<string>();
  for (const html of [snapshot.html, ...snapshot.headers, ...snapshot.footers]) for (const match of html.matchAll(/<img\b[^>]*src="([^"]+)"/gi)) sources.add(match[1].replace(/&amp;/g, "&"));
  for (const source of sources) snapshot.assets[source] = await freezeAsset(source, org);
  for (const [name, file] of [["Inter", "inter-latin-variable.woff2"], ["Noto Serif", "noto-serif-latin.woff2"]]) snapshot.assets[`font:${name}`] = (await readFile(`public/fonts/${file}`)).toString("base64");
  return snapshot;
}
function frozenHtml(snapshot: FrozenStudioPrint, html: string) {
  return html.replace(/<img\b[^>]*src="([^"]+)"[^>]*>/gi, tag => tag.replace(/src="([^"]+)"/i, (_match, source: string) => { const frozen = snapshot.assets[source.replace(/&amp;/g, "&")]; if (!frozen) throw new ProductionError(422,"A frozen Studio image is missing."); return `src="${frozen}"`; }));
}
export async function renderFrozenStudio(snapshot: FrozenStudioPrint, sample = false): Promise<{ bytes: Buffer; pageCount: number; warnings: string[] }> {
  if (!sample && snapshot.issues.some(issue => issue.blocking)) throw new ProductionError(422,snapshot.issues.filter(issue => issue.blocking).map(issue => issue.message).join("; "));
  const browser = await chromium.launch({ headless: true }), lifetime = setTimeout(() => { void browser.close(); }, 60000);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" }); await context.route("**/*", route => route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const fonts = Object.entries(snapshot.assets).filter(([key]) => key.startsWith("font:")).map(([key, value]) => `@font-face{font-family:'${key.slice(5)}';src:url(data:font/woff2;base64,${value});font-weight:100 900}`).join("");
    const design = defaultDesign(); design.styles = snapshot.styles; const printableWidth = (snapshot.width - snapshot.margins.left - snapshot.margins.right) * 96;
    await page.setViewportSize({ width: Math.round(printableWidth), height: Math.round(snapshot.height * 96) });
    const css = studioContentCss(design, ".studio-content").replace(/break-before:column/g, "break-before:page");
    await page.setContent(`<html><head><style>${fonts}@page{size:${snapshot.width}in ${snapshot.height}in;margin:${snapshot.margins.top}in ${snapshot.margins.right}in ${snapshot.margins.bottom}in ${snapshot.margins.left}in}html,body{margin:0;padding:0;background:${snapshot.styles.background}}${css}</style></head><body><main class="studio-content">${frozenHtml(snapshot, snapshot.html)}</main></body></html>`, { waitUntil: "load" });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode())); });
    const oversized = await page.evaluate(({ height, width }) => ({ tall: Array.from(document.querySelectorAll('tr,[data-letter-signature],[data-keep-together],figure,[style*="break-inside:avoid"],img')).some(element => element.getBoundingClientRect().height > height), wide: document.body.scrollWidth > width + 2 }), { height: (snapshot.height - snapshot.margins.top - snapshot.margins.bottom) * 96, width: printableWidth });
    if (oversized.tall || oversized.wide) throw new ProductionError(422,oversized.tall ? "A row, signature or grouped section is taller than the printed page. Resize or split it." : "The design exceeds the printable width. Adjust table or image dimensions.");
    const output = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true })), font = await output.embedFont(StandardFonts.Helvetica);
    const strips = new Map<string, Awaited<ReturnType<typeof output.embedPdf>>[number]>();
    for (let index = 0; index < output.getPageCount(); index++) {
      const target = output.getPage(index);
      for (const [footer, source, inches] of [[false, snapshot.headers[index ? 1 : 0], snapshot.margins.top], [true, snapshot.footers[index ? 1 : 0], snapshot.margins.bottom]] as const) {
        if (!source || inches <= 0) continue;
        const html = source.replace(/<span[^>]*(?:data-studio-page-number|data-studio-total-pages)[^>]*>[\s\S]*?<\/span>/g, "").replace(/Page\s+\s*of\s*/g, ""), key = `${footer}:${html}`;
        if (!strips.has(key)) {
          await page.setViewportSize({ width: Math.round(snapshot.width * 96), height: 160 });
          await page.setContent(`<html><head><style>${fonts}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;font-size:9pt}</style></head><body><div id="chrome" style="padding:8px ${snapshot.margins.right}in 0 ${snapshot.margins.left}in">${frozenHtml(snapshot, html)}</div></body></html>`);
          await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode())); });
          if (await page.evaluate(() => document.getElementById("chrome")!.getBoundingClientRect().height) > inches * 96 + 2) throw new ProductionError(422,`The ${footer ? "footer" : "header"} exceeds its reserved margin. Increase the margin or reduce its content.`);
          const strip = await page.pdf({ width: `${snapshot.width}in`, height: `${inches}in`, margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true, preferCSSPageSize: false }); strips.set(key, (await output.embedPdf(strip, [0]))[0]);
        }
        target.drawPage(strips.get(key)!, { x: 0, y: footer ? 0 : target.getHeight() - inches * 72, width: snapshot.width * 72, height: inches * 72 });
      }
      if (snapshot.kind === "LETTER" || snapshot.kind === "REPLY_SLIP") target.drawText(`Page ${index + 1} of ${output.getPageCount()}`, { x: target.getWidth() - snapshot.margins.right * 72 - 70, y: 12, size: 8, font, color: rgb(.18, .25, .35) });
      if (sample) target.drawText("SAMPLE PROOF", { x: 10, y: 10, size: 8, font, color: rgb(.6, .2, .15) });
    }
    output.setProducer("oyamaCreate Studio Chromium v1"); return { bytes: Buffer.from(await output.save()), pageCount: output.getPageCount(), warnings: snapshot.issues.filter(issue => !issue.blocking).map(issue => issue.message) };
  } finally { clearTimeout(lifetime); await browser.close(); }
}
