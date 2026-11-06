import type { EmailCampaign, LetterTemplate } from "@prisma/client";
import { defaultDesign, normalizeDesign, normalizeDoc, walkNodes } from "./design.js";
import { htmlToStudio, sanitizeStudioHtml } from "./html.js";
import { normalizeEmailTemplateDocument, normalizeEmailTemplateSettings, renderEmailTemplateBody, renderEmailTemplateDocument, type OyamaEmailBlock } from "../../services/oyama-email/email-render-service.js";
import { object, string } from "../domain.js";
import { parseStored } from "../legacy.js";
import { productionLayout } from "../../services/letter-production-contract.js";
import type { StudioDesign, StudioDoc, StudioNode } from "./types.js";

export type Conversion = { design: StudioDesign; diagnostics: string[]; originalHtml: string };
export function convertLegacy(record: EmailCampaign | LetterTemplate, channel: "EMAIL" | "LETTER", sourceRevisionId = ""): Conversion {
  const design = defaultDesign(); design.version = 3; design.channels = {};
  const diagnostics: string[] = [];
  let sequence = 0;
  const id = () => `import-${++sequence}`;
  const htmlDoc = (html: string) => { const converted = htmlToStudio(html, id()); diagnostics.push(...converted.diagnostics); return converted.document; };
  let originalHtml = "";
  if (channel === "EMAIL") {
    const email = record as EmailCampaign, stored = parseStored(email.templateJson);
    const template = normalizeEmailTemplateDocument(stored.template);
    const hasBlocks = Array.isArray(object(stored.template).blocks) && template.blocks.length > 0;
    originalHtml = email.bodyHtml || (hasBlocks ? renderEmailTemplateDocument(template, normalizeEmailTemplateSettings(stored.settings)).html : "");
    design.email.subject = email.subject; design.email.previewText = email.previewText || "";
    design.styles.color = template.textColor; design.styles.font = /serif|Georgia|Times/i.test(template.fontFamily) ? "Noto Serif" : "Inter";
    design.styles.fontSize = template.baseFontSize * .75; design.styles.lineHeight = template.lineHeight;
    design.presentation = { emailWidth: template.contentWidth, emailBackground: template.backgroundColor, suppressEmailChrome: true, emailIncludesFooter: !hasBlocks && /\{\{(?:unsubscribeUrl|managePreferencesUrl|preferencesUrl)\}\}/.test(originalHtml) };
    const block = (item: OyamaEmailBlock): StudioNode[] => {
      const attrs = { studioId: id() };
      if (item.type === "text") return htmlDoc(item.content || "").content;
      if (item.type === "html") return [{ type: "studioHtml", attrs: { ...attrs, html: sanitizeStudioHtml(item.html || ""), reviewedHtml: "" } }];
      if (item.type === "image") return [{ type: "image", attrs: { ...attrs, src: item.src || "", alt: item.alt || "", width: item.imageWidthPercent || 100, href: item.imageLinkUrl || "" } }];
      if (["button", "donationButton", "eventButton", "fileLink"].includes(item.type)) return [{ type: item.type === "fileLink" ? "studioFile" : "studioButton", attrs: { ...attrs, label: item.label || item.fileLabel || "Open link", href: item.href || item.fileUrl || "", color: item.color || "#245ec7" } }];
      if (item.type === "divider") return [{ type: "horizontalRule", attrs }];
      if (item.type === "spacer") return [{ type: "letterSpacer", attrs: { ...attrs, height: item.height || 12 } }];
      if (item.type === "video") return [{ type: "studioVideo", attrs: { ...attrs, label: item.videoTitle || item.videoCtaLabel || "Watch video", href: item.videoUrl || "", thumbnail: item.thumbnailUrl || "" } }];
      if (item.type === "social") return [{ type: "studioSocial", attrs: { ...attrs, linksJson: JSON.stringify(item.links || []) } }];
      if (item.type === "columns") {
        const columns = item.columns?.length ? item.columns : [[], []];
        return [{ type: "studioColumns", attrs, content: columns.slice(0, 3).map((items, index) => ({ type: "studioColumn", attrs: { studioId: id(), width: 100 / columns.length }, content: items.length ? items.flatMap(block) : htmlDoc(index ? item.rightHtml || "<p></p>" : item.leftHtml || "<p></p>").content })) }];
      }
      // Header layouts carry logos, padding and backgrounds. Preserve them together.
      const rendered = `<table role="presentation" width="100%"><tbody>${renderEmailTemplateBody({ ...template, blocks: [item] })}</tbody></table>`;
      return [{ type: "studioHtml", attrs: { ...attrs, html: sanitizeStudioHtml(rendered), reviewedHtml: "" } }];
    };
    design.body = hasBlocks ? { type: "doc", content: template.blocks.flatMap(block) } : htmlDoc(originalHtml || (email.bodyText ? `<p>${email.bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<p></p>"));
    const sourceSettings=normalizeEmailTemplateSettings(stored.settings);
    if(hasBlocks&&sourceSettings.footerBrandingText)design.body.content.push({type:"paragraph",attrs:{studioId:id()},content:[{type:"text",text:sourceSettings.footerBrandingText}]});
    diagnostics.push("Email layout converted; compare the original, including its header, footer, typography and links.");
    if (!hasBlocks) { design.presentation.suppressEmailChrome = true; for (const region of Object.values(design.regions)) region.mode = "none"; }
  } else {
    const letter = record as LetterTemplate; originalHtml = letter.printBody;
    const layout = productionLayout(letter.printLayoutJson);
    design.page.paper = layout.paper === "Letter" ? "LETTER" : layout.paper === "Legal" ? "LEGAL" : "A4";
    design.page.margins = layout.margins;
    design.regions.firstHeader.presetId = design.regions.header.presetId = letter.headerPresetId || "";
    design.regions.firstFooter.presetId = design.regions.footer.presetId = letter.footerPresetId || "";
    if (letter.documentSchemaVersion === 2 && letter.documentJson) {
      const remap = (node: StudioNode): StudioNode => node.type === "mergeField"
        ? { type: "text", text: /^(?:\{[^{}]+\}|\{\{[^{}]+\}\}|\/\/\w+)$/.test(string(node.attrs?.token)) ? string(node.attrs?.token) : `{{${string(node.attrs?.token)}}}` }
        : { ...node, ...(node.type !== "text" ? { attrs: { ...node.attrs, studioId: id() } } : {}), ...(node.content ? { content: node.content.map(remap) } : {}) };
      try { design.body = normalizeDoc(remap(letter.documentJson as StudioDoc)); } catch { design.body = htmlDoc(originalHtml); diagnostics.push("Some structured letter features require preserved HTML; compare the original."); }
    } else design.body = htmlDoc(originalHtml);
    if (letter.emailBody?.trim()) {
      const adapted = htmlDoc(letter.emailBody); design.channels!.EMAIL = { document: adapted, reviewedSource: null };
      design.email.subject = letter.emailSubject || letter.printSubject || letter.name;
    }
  }
  if (walkNodes(design.body).some(node => node.type === "studioHtml")) diagnostics.push("Preserved HTML requires explicit layout review before release.");
  try { return { design: normalizeDesign(design), diagnostics: [...new Set(diagnostics)], originalHtml }; }
  catch (error) {
    // Large or unfamiliar originals are referenced, never truncated into an apparently complete document.
    design.body = { type: "doc", content: [{ type: "studioHtml", attrs: { studioId: "preserved-source", html: "", sourceRevisionId, reviewedHtml: "" } }] };
    design.channels = {}; diagnostics.push(error instanceof Error ? error.message : "Structured conversion requires review.");
    diagnostics.push("Original retained in source history; open its preserved HTML to review or edit.");
    return { design, diagnostics: [...new Set(diagnostics)], originalHtml };
  }
}
