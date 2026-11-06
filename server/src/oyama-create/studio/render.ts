import { restoreLegacyLogoBounds, sanitizeStudioHtml } from "./html.js";
import { escapeHtml, string } from "../domain.js";
import { collectMergeFieldKeys, renderMergeFields } from "../../services/letters-merge.js";
import { color, emailReviewRequired, number, walkNodes, channelDesign, channelReviewRequired } from "./design.js";
import type { BrandDocument, DonorContext, StudioDesign, StudioIssue, StudioNode, StudioRender, ArtifactKind } from "./types.js";

export function emptyDonor(asOf = new Date().toISOString()): DonorContext { return { available: false, sensitiveAllowed: false, constituentId: null, name: "", salutation: "", address: "", entityKind: "", gift: null, giving: null, pledge: null, campaign: null, tags: [], recurring: null, responseCode: "", asOf }; }
export function plainText(html: string): string { return html.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)").replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, "[$1]").replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|tr|li|blockquote)>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim(); }
export function designSensitive(design: StudioDesign): boolean { if ([design.body,...Object.values(design.channels||{}).map(channel=>channel.document),design.pack.replySlip.content,...Object.values(design.email.overrides),...Object.values(design.regions).map(region=>region.content)].flatMap(walkNodes).some(node=>(node.type==="text"||node.type==="studioHtml")&&collectMergeFieldKeys(node.text||string(node.attrs?.html)).some(key=>/^(gift\.|year\.|donor\.(?:total|lifetime))/.test(key)))) return true; return [design.body, ...Object.values(design.channels||{}).map(channel=>channel.document), design.pack.replySlip.content, ...Object.values(design.regions).map(region => region.content), ...Object.values(design.email.overrides)].flatMap(walkNodes).some(node => ["studioReceipt", "studioHistory", "studioPledge"].includes(node.type) || node.type === "studioAsk" && node.attrs?.basis !== "fixed" || node.type === "studioField" && /^(gift|giving|pledge)\./.test(string(node.attrs?.field)) || node.type === "studioCondition" && ["hasGiving", "hasGift", "hasPledge", "recurring", "givingTotal", "lastGiftBefore"].includes(string(node.attrs?.field))); }
export function givingLink(design: StudioDesign, amount?: number, responseCode?: string): string {
  if (!design.data.givingUrl) return "";
  const url = new URL(design.data.givingUrl, "https://studio.invalid");
  if (amount) url.searchParams.set("amount", String(amount));
  url.searchParams.set("giftType", design.data.frequency);
  if (design.data.designation) url.searchParams.set("designation", design.data.designation);
  if (responseCode) url.searchParams.set("createResponse", responseCode);
  return design.data.givingUrl.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
}
export function renderStudio(design: StudioDesign, donor: DonorContext, brand: BrandDocument, options: { channel: "LETTER" | "EMAIL" | "WEB" | "SMS" | "SOCIAL"; artifact?: ArtifactKind; qrImages?: Record<string, string>; sample?: boolean } = { channel: "LETTER" }): StudioRender {
  const adaptationNeedsReview = channelReviewRequired(design, options.channel);
  design = channelDesign(design, options.channel);
  const issues: StudioIssue[] = [], adaptations: StudioIssue[] = [], decisions: StudioRender["decisions"] = [];
  const email = options.channel === "EMAIL", isPublic = ["WEB", "SMS", "SOCIAL"].includes(options.channel), e = (value: unknown) => escapeHtml(value == null ? "" : String(value));
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: donor.currency || string(brand.identity.currency) || "USD" }).format(value);
  const date = (value: string) => value ? new Date(value).toLocaleDateString("en-US", { timeZone: "UTC" }) : "";
  const issue = (node: StudioNode, code: string, message: string, blocking = true) => { if (!issues.some(item => item.code === code && item.nodeId === node.attrs?.studioId)) issues.push({ code, message, blocking, nodeId: string(node.attrs?.studioId), channel: options.channel }); return `<span data-studio-missing="true" style="color:#a23a28;background:#fff1ed;padding:3px">${e(message)}</span>`; };
  const adapt = (node: StudioNode, message: string) => adaptations.push({ code: "CHANNEL_ADAPTATION", nodeId: string(node.attrs?.studioId), channel: options.channel, message, blocking: false });
  const needsSensitive = (node: StudioNode) => donor.sensitiveAllowed ? "" : issue(node, "DONOR_PERMISSION", "Giving details require sensitive donor-data permission.");
  function field(node: StudioNode, key: string): string {
    if (isPublic && !["campaign.name", "asOf"].includes(key)) return issue(node, "PRIVATE_CHANNEL", "Recipient data is restricted to the letter and email versions.");
    if (/^(gift|giving|pledge)\./.test(key) && !donor.sensitiveAllowed) return needsSensitive(node);
    const values: Record<string, string | number | null | undefined> = { name: donor.name, salutation: donor.salutation, address: donor.address, entityKind: donor.entityKind, "gift.amount": donor.gift ? money(donor.gift.amount) : null, "gift.date": donor.gift ? date(donor.gift.date) : null, "gift.fund": donor.gift?.fund, "gift.receiptNumber": donor.gift?.receiptNumber, "gift.deductible": donor.gift?.deductible == null ? null : money(donor.gift.deductible), "giving.total": donor.giving ? money(donor.giving.total) : null, "giving.count": donor.giving?.count, "giving.lastAmount": donor.giving?.lastAmount == null ? null : money(donor.giving.lastAmount), "giving.lastDate": donor.giving?.lastDate ? date(donor.giving.lastDate) : null, "pledge.balance": donor.pledge ? money(donor.pledge.balance) : null, "campaign.name": donor.campaign?.name, responseCode: donor.responseCode, asOf: date(donor.asOf) };
    const value = values[key]; return value === null || value === undefined || value === "" ? issue(node, "MISSING_DONOR_VALUE", `Choose recipient/context for ${key}.`) : e(String(value)).replace(/\n/g, "<br>");
  }
  function asks(node: StudioNode): number[] {
    const a = node.attrs || {}; const basis = string(a.basis) || "fixed";
    if (basis !== "fixed" && (!Array.isArray(a.fallback) || !a.fallback.length)) issue(node,"ASK_FALLBACK","Configure a required no-history fallback for this donor-based ask ladder.");
    if (basis !== "fixed" && !donor.sensitiveAllowed) { needsSensitive(node); return []; }
    const previous = basis === "lastGift" ? donor.giving?.lastAmount : donor.giving?.largest;
    const source = basis === "fixed" ? a.amounts : previous ? (Array.isArray(a.multipliers) ? a.multipliers : []).map(multiplier => previous * Number(multiplier)) : a.fallback;
    const step = number(a.rounding, 5, .01, 1000), minimum = number(a.minimum, 1, .01, 1_000_000), maximum = number(a.maximum, 100000, minimum, 1_000_000);
    const amounts = [...new Set((Array.isArray(source) ? source : []).map(value => Math.round(Math.min(maximum, Math.max(minimum, Math.round(Number(value) / step) * step)) * 100) / 100))].filter(value => value > 0 && Number.isFinite(value)).sort((a, b) => a - b);
    decisions.push({ nodeId: string(a.studioId), rule: basis === "fixed" ? "Configured amounts" : previous ? `${basis}: ${money(previous)}` : "No-history fallback", result: amounts.map(money).join(" · ") || "Configure amounts" });
    if (!amounts.length) issue(node, "ASK_AMOUNTS", "Configure ask amounts and a no-history fallback.");
    return amounts;
  }
  function condition(node: StudioNode): boolean {
    const a = node.attrs || {}, key = string(a.field), expected = string(a.value), op = string(a.operator);
    if(!donor.available){issue(node,"CONDITION_CONTEXT","Choose a CRM recipient before resolving donor conditions.");return false;}
    if (["hasGiving", "hasGift", "hasPledge", "recurring", "givingTotal", "lastGiftBefore"].includes(key) && !donor.sensitiveAllowed) { needsSensitive(node); return false; }
    const value = key === "hasGiving" ? donor.giving ? donor.giving.count > 0 : null : key === "hasGift" ? !!donor.gift : key === "hasPledge" ? !!donor.pledge : key === "recurring" ? donor.recurring : key === "entityKind" ? donor.entityKind : key === "tag" ? donor.tags.includes(expected) : key === "givingTotal" ? donor.giving?.total : key === "lastGiftBefore" ? donor.giving?.lastDate ? donor.giving.lastDate.slice(0, 10) < expected : true : null;
    if (value == null) { issue(node, "CONDITION_CONTEXT", "Choose a recipient with available condition data."); return false; }
    const result = key === "tag" || key === "lastGiftBefore" ? value === true : op === "greaterThan" ? Number(value) > Number(expected) : op === "lessThan" ? Number(value) < Number(expected) : String(value) === expected;
    const matched = op === "isNot" ? !result : result; decisions.push({ nodeId: string(a.studioId), rule: `${key} ${op} ${expected}`, result: matched ? "Shown" : "Hidden" }); return matched;
  }
  function legacyMerge(node: StudioNode, source: string, html = false): string {
    const keys = collectMergeFieldKeys(source).filter(key => !email || !["unsubscribeUrl", "managePreferencesUrl", "preferencesUrl"].includes(key));
    const sensitive = keys.some(key=>/^(gift\.|year\.|donor\.(?:total|lifetime))/.test(key));
    if (keys.length && isPublic && keys.some(key=>!key.startsWith("organization.") && key!=="campaign.name" && key!=="currentDate")) return issue(node,"PRIVATE_CHANNEL","Recipient merge fields cannot appear in a public version.");
    if (sensitive && !donor.sensitiveAllowed) { const warning = needsSensitive(node); if (donor.available) return warning; }
      const mergeValues:Record<string,string> = {...donor.mergeValues,"donor.fullName":donor.name,"donor.salutation":donor.salutation,"donor.addressBlock":donor.address,"donor.entityKind":donor.entityKind,"household.name":donor.entityKind==="HOUSEHOLD"?donor.name:"","campaign.name":donor.campaign?.name||"","year":String(design.data.year),"currentDate":date(donor.asOf),"organization.name":string(brand.identity.organizationDisplayName),"organization.mission":string(brand.identity.missionStatement),"organization.address":[brand.identity.streetAddress1,brand.identity.streetAddress2,brand.identity.city,brand.identity.stateProvince,brand.identity.postalCode].filter(Boolean).join(", "),"organization.phone":string(brand.identity.contactPhone),"organization.email":string(brand.identity.contactEmail),"organization.website":string(brand.identity.websiteUrl),"organization.taxId":string(brand.identity.taxId)};
      if(donor.sensitiveAllowed){if(donor.gift)Object.assign(mergeValues,{"gift.amount":money(donor.gift.amount),"gift.date":date(donor.gift.date),"gift.fund":donor.gift.fund,"gift.receiptNumber":donor.gift.receiptNumber,"gift.taxDeductibleAmount":donor.gift.deductible==null?"":money(donor.gift.deductible)});if(donor.giving)Object.assign(mergeValues,{"year.totalGiving":money(donor.giving.total),"year.numberOfGifts":String(donor.giving.count),"year.firstGiftDate":donor.giving.firstDate||"","year.lastGiftDate":donor.giving.lastDate||""});}
    if (!donor.sensitiveAllowed) for (const key of Object.keys(mergeValues)) if (/^(gift\.|year\.|donor\.(?:total|lifetime))/.test(key)) delete mergeValues[key];
    const missing = new Set<string>();
    const values = html ? Object.fromEntries(Object.entries(mergeValues).map(([key, value]) => [key, e(value).replace(/\n/g, "<br>")])) : mergeValues;
    const merged = renderMergeFields(source, values, { missingFields: missing, missingMode: donor.available ? "blank" : "preserve" });
    for (const key of keys) if (!(key in mergeValues) || missing.has(key)) issue(node,"MERGE_CONTEXT",`Review recipient/context for legacy merge field ${key}.`);
    return html ? sanitizeStudioHtml(merged) : e(merged).replace(/\n/g, "<br>");
  }
  function render(node: StudioNode, applyOverride = true): string {
    const sourceId = string(node.attrs?.studioId);
    if (applyOverride && email && sourceId && Object.prototype.hasOwnProperty.call(design.email.overrides,sourceId)) node = design.email.overrides[sourceId];
    const a = node.attrs || {}, id = sourceId || string(a.studioId), type = node.type;
    if (options.channel !== "LETTER" && a.printOnly === true || !email && a.emailOnly === true) { adapt(node, `${type} is explicitly limited to the other format.`); return ""; }
    const attrs = node.attrs || {}, children = () => (node.content || []).map(child=>render(child)).join("");
    const attributeKeys=collectMergeFieldKeys(JSON.stringify(Object.fromEntries(Object.entries(attrs).filter(([key])=>!["html","reviewedHtml","sourceRevisionId","studioId"].includes(key)))))
      .concat((node.marks||[]).flatMap(mark=>collectMergeFieldKeys(JSON.stringify(mark.attrs||{}))));
    if(attributeKeys.length&&isPublic&&attributeKeys.some(key=>!key.startsWith("organization.")&&!["campaign.name","currentDate"].includes(key)))return issue(node,"PRIVATE_CHANNEL","Recipient fields in links, images and block settings cannot appear in public content.");
    if(attributeKeys.length)issue(node,"MERGE_ATTRIBUTE","Review merge fields in this block's link or settings. Use a preserved HTML block for dynamic legacy links.");
    const style = [attrs.textAlign ? `text-align:${e(attrs.textAlign)}` : "", attrs.indent ? `margin-left:${number(attrs.indent, 0, 0, 6) * 12}pt` : "", attrs.spacing !== undefined ? `margin-bottom:${number(attrs.spacing, 9, 0, 72)}pt` : "", attrs.keepTogether ? "break-inside:avoid" : "", attrs.keepWithNext ? "break-after:avoid" : ""].filter(Boolean).join(";");
    const attributes = (extra = "") => `${id ? ` data-studio-id="${e(id)}"` : ""}${style || extra ? ` style="${[style, extra].filter(Boolean).join(";")}"` : ""}`;
    const common = attributes();
    if (type === "studioHtml") {
      if (!attrs.html) return issue(node, "SOURCE_HTML", attrs.sourceRevisionId ? "Open the preserved original HTML to review this source." : "Add the preserved HTML or restore its original before release.");
      if (attrs.reviewedHtml !== (attrs.sourceRevisionId || attrs.html)) issue(node, "HTML_REVIEW", "Compare and review the preserved HTML before release.");
      if (isPublic && collectMergeFieldKeys(string(attrs.html)).some(key => !key.startsWith("organization.") && !["campaign.name", "currentDate"].includes(key))) return issue(node, "PRIVATE_CHANNEL", "Private recipient fields cannot appear in public HTML.");
      const html = legacyMerge(node, sanitizeStudioHtml(string(attrs.html)), true);
      return `<div${common}>${sanitizeStudioHtml(html)}</div>`;
    }
    if (["studioButton", "studioFile", "studioVideo"].includes(type)) {
      if (!attrs.href) return issue(node, "LINK_REQUIRED", "Set the destination link for this block.");
      return `<p${common}><a href="${e(attrs.href)}"${type === "studioButton" ? ` style="display:inline-block;padding:10px 18px;background:${color(attrs.color, design.styles.primary)};color:#ffffff;text-decoration:none"` : ""}>${type === "studioVideo" && attrs.thumbnail ? `<img src="${e(attrs.thumbnail)}" alt="${e(attrs.label || "Video")}" style="max-width:100%;height:auto"><br>` : ""}${e(attrs.label || "Open link")}</a></p>`;
    }
    if (type === "studioSocial") {
      let links: Array<{label?:string;url?:string}> = []; try { const parsed = JSON.parse(string(attrs.linksJson) || "[]"); if (Array.isArray(parsed)) links = parsed.slice(0,20); } catch { /* surfaced below */ }
      if (!links.length) return issue(node, "SOCIAL_LINKS", "Add social profile links in block settings.");
      return sanitizeStudioHtml(`<p${common}>${links.map(link=>`<a href="${e(link.url)}">${e(link.label || link.url)}</a>`).join(" · ")}</p>`);
    }
    if (type === "doc") return children();
    if (type === "text") {
      let html = legacyMerge(node, node.text || "");
      for (const mark of node.marks || []) {
        const values = mark.attrs || {};
        if (["bold", "italic", "underline", "strike", "code", "superscript", "subscript"].includes(mark.type)) { const tags: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", superscript: "sup", subscript: "sub" }; html = `<${tags[mark.type]}>${html}</${tags[mark.type]}>`; }
        if (mark.type === "link") html = `<a href="${e(values.href)}">${html}</a>`;
        if (mark.type === "highlight") html = `<span style="background:${color(values.color, "#fff2b2")}">${html}</span>`;
        if (mark.type === "textStyle") { const declarations = [values.color ? `color:${color(values.color, design.styles.color)}` : "", values.fontFamily ? `font-family:${email ? /Noto/.test(string(values.fontFamily)) ? "Georgia,serif" : "Arial,sans-serif" : /Noto/.test(string(values.fontFamily)) ? "'Noto Serif'" : "Inter"}` : "", values.fontSize ? `font-size:${number(parseFloat(string(values.fontSize)), design.styles.fontSize, 8, 48)}pt` : "", values.lineHeight ? `line-height:${number(parseFloat(string(values.lineHeight)), 1.5, 1, 2.5)}` : ""].filter(Boolean).join(";"); html = `<span style="${declarations}">${html}</span>`; }
      } return html;
    }
    if (type === "hardBreak") return "<br>";
    if (["paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem"].includes(type)) { const tag = type === "heading" ? `h${number(attrs.level, 2, 1, 3)}` : ({ paragraph: "p", blockquote: "blockquote", bulletList: "ul", orderedList: "ol", listItem: "li" } as Record<string, string>)[type]; return `<${tag}${common}>${children() || "<br>"}</${tag}>`; }
    if (type === "horizontalRule") return `<hr${common}>`;
    if (type === "letterPageBreak") { if (email || isPublic) { adapt(node, "Page breaks become natural spacing in this format."); return email ? "<div style=\"height:12px\"></div>" : ""; } return `<div data-letter-page-break="true"${common}></div>`; }
    if (type === "letterSpacer") return `<div${attributes(`height:${number(attrs.height, 12, 0, 144)}pt`)}></div>`;
    if (type === "image") {
      if (!attrs.src) return issue(node, "IMAGE_REQUIRED", "Choose an image or remove this block.");
      if(!string(attrs.alt).trim())issue(node,"IMAGE_ALT","Add alternative text, or explicitly review this image as decorative.",false);
      if(email&&attrs.crop==="cover"&&attrs.height)issue(node,"EMAIL_IMAGE_CROP","Apply the image crop in the letter inspector so email clients receive the same immutable image.");
      const alignment = attrs.textAlign === "center" ? "margin-left:auto;margin-right:auto;" : attrs.textAlign === "right" ? "margin-left:auto;" : "";
      const image = `<img src="${e(attrs.src)}" alt="${e(attrs.alt)}" style="display:block;max-width:100%;width:${number(attrs.width, 100, 5, 100)}%;${alignment}${attrs.height ? `height:${number(attrs.height, 0, 0, 900)}px;object-fit:${attrs.crop === "cover" ? "cover" : "contain"};object-position:${number(attrs.focalX, 50, 0, 100)}% ${number(attrs.focalY, 50, 0, 100)}%;` : "height:auto;"}">`;
      return `<div${attributes("break-inside:avoid")}>${attrs.href ? `<a href="${e(attrs.href)}">${image}</a>` : image}${attrs.caption ? `<p style="font-size:9pt;color:#526078">${e(attrs.caption)}</p>` : ""}</div>`;
    }
    if(type==="table"){const rows=[...(node.content||[])];let html="";if(rows[0]?.content?.every(cell=>cell.type==="tableHeader"))html+=`<thead>${render(rows.shift()!)}</thead>`;for(let start=0;start<rows.length;){let end=start;for(let index=start;index<=end&&index<rows.length;index++)for(const cell of rows[index].content||[])end=Math.max(end,index+number(cell.attrs?.rowspan,1,1,25)-1);if(end>=rows.length){issue(node,"TABLE_SPAN","A merged cell extends beyond the table. Split or repair it before production.");end=rows.length-1;}html+=`<tbody${end>start?' style="break-inside:avoid"':""}>${rows.slice(start,end+1).map(row=>render(row)).join("")}</tbody>`;start=end+1;}return `<table${attributes("width:100%;border-collapse:collapse;table-layout:fixed")}>${html}</table>`;}
    if (type === "tableRow") return `<tr${common}>${children()}</tr>`;
    if (type === "tableCell" || type === "tableHeader") { const tag = type === "tableHeader" ? "th" : "td", widths = Array.isArray(attrs.colwidth) ? attrs.colwidth : []; return `<${tag} colspan="${number(attrs.colspan, 1, 1, 25)}" rowspan="${number(attrs.rowspan, 1, 1, 25)}" style="border:1px solid ${color(attrs.borderColor, "#c7d3df")};padding:6pt;vertical-align:top;${attrs.background ? `background:${color(attrs.background, "#ffffff")};` : ""}${widths[0] ? `width:${number(widths[0], 100, 20, 1000)}px;` : ""}${style}">${children()}</${tag}>`; }
    if (["studioGroup", "studioCallout", "studioImpact", "studioColumns", "studioColumn"].includes(type)) {
      if (type === "studioColumns") { adapt(node, "Columns stack on small email screens."); return `<table${attributes("width:100%;table-layout:fixed")} role="presentation" width="100%"><tr>${(node.content || []).map(child => `<td class="studio-email-column" style="width:${number(child.attrs?.width, 100, 1, 100) / Math.max(1, (node.content || []).reduce((sum, column) => sum + number(column.attrs?.width, 100, 1, 100), 0)) * 100}%;vertical-align:top;padding:0 8pt">${render(child)}</td>`).join("")}</tr></table>`; }
      return `<div${attributes(type === "studioCallout" || type === "studioImpact" ? `padding:12pt;background:${color(attrs.color, "#edf4fc")};border-left:3pt solid ${design.styles.primary}` : "")}>${children()}</div>`;
    }
    if (type === "studioCondition") { if (isPublic) return issue(node, "PRIVATE_CHANNEL", "Donor conditions are restricted to letter and email."); return condition(node) ? `<div${common}>${children()}</div>` : ""; }
    if (type === "studioAddress") { if (email || isPublic) { adapt(node, "The postal address is omitted from the email/public version."); return ""; } return `<p${common}>${field(node, "name")}<br>${field(node, "address")}</p>`; }
    if (type === "studioSalutation") return `<p${common}>${field(node, "salutation")}</p>`;
    if (type === "studioField") return `<span${common}>${field(node, string(attrs.field))}</span>`;
    if (type === "studioSignature") {
      const signerProfile=brand.profiles.find(item=>item.id===design.profileId&&(item.channel==="LETTER"||item.channel===options.channel))||brand.profiles.find(item=>item.channel===options.channel&&!item.resourceId)||brand.profiles.find(item=>item.channel==="LETTER"&&!item.resourceId);
      const signers = [string(attrs.signerId) || string(signerProfile?.values.signerId) || brand.defaultSignerId, string(attrs.secondSignerId)].filter(Boolean).map(id => brand.signers.find(signer => signer.id === id && signer.active));
      if(new Set(signers.map(signer=>signer?.id)).size<signers.length)return issue(node,"DUPLICATE_SIGNER","Select different first and second signers.");
      if (!signers.length || signers.some(signer => !signer)) return issue(node, "SIGNER_REQUIRED", "Choose an active signer in Brand Hub.");
      return `<div${attributes("break-inside:avoid;margin-top:12pt")} data-letter-signature="true"><p>${e(attrs.closing || signers[0]?.closingPhrase || "With gratitude,")}</p>${signers.map(signer => signer ? `<div style="display:inline-block;vertical-align:top;margin-right:24pt">${signer.signatureImageUrl ? `<img src="${e(signer.signatureImageUrl)}" alt="${e(signer.signerName)} signature" style="max-width:170px;height:48px;object-fit:contain">` : signer.typedSignature ? `<p style="font-style:italic;font-size:17pt">${e(signer.typedSignature)}</p>` : ""}<p><strong>${e(signer.signerName)}</strong><br>${e(signer.signerTitle)}${signer.email ? `<br>${e(signer.email)}` : ""}${signer.phone ? `<br>${e(signer.phone)}` : ""}</p></div>` : "").join("")}</div>`;
    }
    if (type === "studioAsk") { if (isPublic && attrs.basis !== "fixed") return issue(node, "PRIVATE_CHANNEL", "Donor-based ask amounts cannot appear on public channels."); const amounts = asks(node); if (!amounts.length) return `<p${common}>${e("Configure ask amounts and a no-history fallback.")}</p>`; const link = givingLink(design, undefined, donor.responseCode); if (!link) issue(node, "GIVING_URL", "Choose a configured giving destination."); return `<div${common}><p><strong>${e(attrs.label || "Your gift makes a difference")}</strong></p><p>${amounts.map(amount => email ? `<a style="display:inline-block;padding:8px 12px;margin:3px;border:1px solid ${design.styles.primary};color:${design.styles.primary};text-decoration:none" href="${e(givingLink(design, amount, donor.responseCode))}">${money(amount)}</a>` : `<span style="display:inline-block;margin-right:12pt">☐ ${money(amount)}</span>`).join("")}</p></div>`; }
    if (type === "studioGiving" || type === "studioQr") { const url = givingLink(design, undefined, donor.responseCode); if (!url) return issue(node, "GIVING_URL", "Choose a configured giving destination."); if (type === "studioQr" && !email) { const image = options.qrImages?.[url]; return image ? `<div${attributes("break-inside:avoid")}><img src="${image}" alt="Scan to give" style="width:${number(attrs.size, 96, 64, 240)}px;height:auto"><p style="font-size:8pt">${e(design.data.givingUrl)}</p></div>` : `<div${attributes("width:96px;border:1px dashed #9aaac0;padding:8px;font-size:9pt")} data-studio-qr="${e(url)}">QR code · render a proof</div>`; } if (type === "studioQr") adapt(node, "The printed QR code becomes a clickable giving link in email."); return email ? `<p${common}><a href="${e(url)}" style="display:inline-block;background:${design.styles.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:4px">${e(attrs.label || "Make a gift")}</a></p>` : `<p${common}><strong>${e(attrs.label || "Give online")}</strong><br><a href="${e(url)}">${e(design.data.givingUrl)}</a></p>`; }
    if (["studioHistory", "studioReceipt", "studioPledge"].includes(type)) {
      if (isPublic) return issue(node, "PRIVATE_CHANNEL", "Private giving details are restricted to letter and email.");
      if (!donor.sensitiveAllowed) return needsSensitive(node);
      if (type === "studioHistory") { if (!donor.giving) return issue(node, "GIVING_CONTEXT", "Choose a recipient to resolve actual giving."); return attrs.mode === "table" ? `<table${attributes("width:100%;border-collapse:collapse")}><thead><tr><th>Date</th><th>Amount</th><th>Fund</th></tr></thead><tbody>${donor.giving.gifts.map(gift => `<tr><td>${date(gift.date)}</td><td>${money(gift.amount)}</td><td>${e(gift.fund)}</td></tr>`).join("")}</tbody></table>` : `<div${common}><p><strong>Giving in the selected period</strong></p><p>${money(donor.giving.total)} across ${donor.giving.count} recorded gift${donor.giving.count === 1 ? "" : "s"}.</p></div>`; }
      if (type === "studioReceipt") { if (!donor.gift) return issue(node, "GIFT_CONTEXT", "Select an actual gift for this recipient."); if (!attrs.statement) issue(node, "RECEIPT_STATEMENT", "Add your approved receipt statement."); return `<div${attributes("border:1px solid #c7d3df;padding:12pt")}><p><strong>Gift acknowledgment</strong></p><p>${field(node, "name")}<br>Amount: ${money(donor.gift.amount)}<br>Date: ${date(donor.gift.date)}<br>Fund: ${e(donor.gift.fund)}<br>Receipt: ${e(donor.gift.receiptNumber)}${donor.gift.deductible !== null ? `<br>Recorded deductible amount: ${money(donor.gift.deductible)}` : ""}</p><p>${e(attrs.statement)}</p></div>`; }
      if (!donor.pledge) return issue(node, "PLEDGE_CONTEXT", "Choose a recipient with an available pledge."); return `<div${common}><p><strong>Pledge balance: ${money(donor.pledge.balance)}</strong></p><p>Commitment: ${money(donor.pledge.amount)} · Recorded payments: ${money(donor.pledge.paid)}${donor.pledge.due ? `<br>Due: ${date(donor.pledge.due)}` : ""}</p></div>`;
    }
    if (type === "studioProgress") { if (!donor.campaign||donor.campaign.goal==null) return issue(node, "CAMPAIGN_CONTEXT", "Link a fundraising campaign to show its real results."); return `<div${common}><p><strong>${e(donor.campaign.name)}</strong></p><p>${money(donor.campaign.raised)} recorded${donor.campaign.goal > 0 ? ` toward ${money(donor.campaign.goal)}` : " · no goal configured"}.</p></div>`; }
    if (type === "studioResponse") { if (email) { adapt(node, "Reply-slip choices become online giving actions."); return render({ ...node, type: "studioGiving", attrs: { ...attrs, label: "Respond online" } },false); } return `<div${attributes("border-top:1px dashed #8294aa;padding-top:12pt;break-inside:avoid")}><p><strong>${e(attrs.label || "Yes, I want to help")}</strong></p><p>${(Array.isArray(attrs.amounts) ? attrs.amounts : []).map(amount => `☐ ${money(Number(amount))}`).join(" &nbsp; ")} &nbsp; ☐ Other: __________</p><p>☐ One-time gift &nbsp; ☐ Monthly gift</p><p>Response code: ${donor.responseCode ? e(donor.responseCode) : options.sample ? "SAMPLE — not activated" : issue(node, "RESPONSE_CODE", "A response code is assigned on approval.", false)}</p><p>Return to: ${e(brand.identity.organizationDisplayName)}<br>${e([brand.identity.streetAddress1, brand.identity.streetAddress2, [brand.identity.city, brand.identity.stateProvince, brand.identity.postalCode].filter(Boolean).join(" ")].filter(Boolean).join("\n")).replace(/\n/g, "<br>")}</p></div>`; }
    if (type === "studioLegacy") return issue(node, "LEGACY_REVIEW", "Review and convert the preserved legacy HTML before releasing this design.");
    return issue(node, "UNSUPPORTED_BLOCK", `Unsupported block: ${type}.`);
  }
  if (adaptationNeedsReview) issues.push({ code: "CHANNEL_REVIEW", message: "Review this channel adaptation against the current shared content.", blocking: true, channel: options.channel });
  if (email && emailReviewRequired(design)) issues.push({ code: "EMAIL_REVIEW", message: "Review customized email blocks against the latest shared design.", blocking: true, channel: "EMAIL" });
  const ids = new Set(walkNodes(design.body).map(node => string(node.attrs?.studioId)).filter(Boolean));
  for (const id of email?Object.keys(design.email.overrides):[]) if (!ids.has(id)) issues.push({ code: "ORPHANED_EMAIL_BLOCK", nodeId: id, message: "A customized email block no longer has a shared source. Restore or remove it explicitly.", blocking: true, channel: "EMAIL" });
  let html = render(options.artifact === "REPLY_SLIP" ? design.pack.replySlip.content : design.body);
  if (!email && options.artifact !== "REPLY_SLIP" && design.pack.replySlip.enabled && design.pack.replySlip.placement === "attached") html += `<div style="margin-top:20pt">${render(design.pack.replySlip.content)}</div>`;
  if (email && design.pack.replySlip.enabled) { adaptations.push({ code: "REPLY_SLIP_ADAPTED", message: "The printed reply slip and envelopes stay in the appeal pack; the email retains online giving actions.", blocking: false, channel: "EMAIL" }); }
  return { html, text: plainText(html), issues, adaptations, decisions };
}
export function renderRegion(design: StudioDesign, donor: DonorContext, brand: BrandDocument, key: keyof StudioDesign["regions"], options: { authoring?: boolean } = {}): string {
  const region = design.regions[key], footer = key.toLowerCase().includes("footer"), e = (value: unknown) => escapeHtml(value == null ? "" : String(value));
  if (region.mode === "none"||region.mode==="custom"&&!region.content.content.length) return "";
  const profile = brand.profiles.find(item => item.id === design.profileId && item.channel === "LETTER") || brand.profiles.find(item => item.channel === "LETTER" && !item.resourceId);
  const selectedId = region.presetId || string(profile?.values[footer ? "footerPresetId" : "headerPresetId"]);
  const preset = selectedId ? brand.presets.find(item => item.id === selectedId && item.active && item.kind === (footer ? "footer" : "header")) : brand.presets.find(item => item.kind === (footer ? "footer" : "header") && item.active && item.isDefault);
  const doc = region.mode === "custom" ? region.content : preset?.content;
  if (doc?.content.length) return `<div class="studio-content">${renderStudio({ ...design, channels:undefined, body: doc, pack: { ...design.pack, replySlip: { ...design.pack.replySlip, enabled: false } } }, options.authoring ? emptyDonor(donor.asOf) : donor, brand).html}</div>`;
  const identity = { ...brand.identity, ...profile?.values };
  if (region.mode === "brand" && preset?.legacyHtml) {
    const html = footer ? preset.legacyHtml : restoreLegacyLogoBounds(preset.legacyHtml, string(identity.logoUrl));
    if (options.authoring) return html;
    return renderStudio({ ...design, channels: undefined, body: { type: "doc", content: [{ type: "studioHtml", attrs: { html, reviewedHtml: html } }] }, pack: { ...design.pack, replySlip: { ...design.pack.replySlip, enabled: false } } }, donor, brand).html;
  }
  if (footer) return `<div style="font-family:Inter,Arial,sans-serif;font-size:8pt">${e(identity.footerLegalText || identity.legalOrganizationName || identity.organizationDisplayName)}<span style="float:right">Page <span data-studio-page-number>1</span> of <span data-studio-total-pages>1</span></span></div>`;
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:9pt">${identity.logoUrl ? `<img src="${e(identity.logoUrl)}" alt="${e(identity.organizationDisplayName)}" style="max-width:140px;max-height:42px;object-fit:contain;vertical-align:middle;margin-right:12px">` : ""}<strong>${e(identity.organizationDisplayName)}</strong><div>${e([identity.streetAddress1, [identity.city, identity.stateProvince, identity.postalCode].filter(Boolean).join(" "), identity.contactPhone].filter(Boolean).join(" · "))}</div></div>`;
}
export function regionIssues(design:StudioDesign,donor:DonorContext,brand:BrandDocument):StudioIssue[]{
  const issues:StudioIssue[]=[];
  const profile=brand.profiles.find(item=>item.id===design.profileId&&item.channel==="LETTER")||brand.profiles.find(item=>item.channel==="LETTER"&&!item.resourceId);
  for(const [key,region] of Object.entries(design.regions)){
    if(region.mode==="none")continue;const footer=key.toLowerCase().includes("footer"),selected=region.presetId||string(profile?.values[footer?"footerPresetId":"headerPresetId"]),preset=selected?brand.presets.find(item=>item.id===selected&&item.active&&item.kind===(footer?"footer":"header")):brand.presets.find(item=>item.kind===(footer?"footer":"header")&&item.active&&item.isDefault);
    if(selected&&!preset)issues.push({code:"REGION_PRESET",message:`${key}: the explicitly selected brand preset is unavailable.`,blocking:true});
    const doc=region.mode==="custom"?region.content:preset?.content;
    if(doc){issues.push(...renderStudio({...design,channels:undefined,body:doc,pack:{...design.pack,replySlip:{...design.pack.replySlip,enabled:false}}},donor,brand).issues.map(issue=>({...issue,message:`${key}: ${issue.message}`})));if(walkNodes(doc).some(node=>node.type==="studioSignature"))issues.push({code:"REGION_SIGNATURE",message:"Place the signature in the letter body so it appears once, rather than in repeated page furniture.",blocking:true});}
    if(region.mode==="brand"&&preset?.legacyHtml)issues.push(...renderStudio({...design,channels:undefined,body:{type:"doc",content:[{type:"studioHtml",attrs:{html:preset.legacyHtml,reviewedHtml:preset.legacyHtml}}]},pack:{...design.pack,replySlip:{...design.pack.replySlip,enabled:false}}},donor,brand).issues.map(issue=>({...issue,message:`${key}: ${issue.message}`})));
  }
  return issues;
}
export function renderEmailDocument(design: StudioDesign, donor: DonorContext, brand: BrandDocument): StudioRender {
  const rendered = renderStudio(design, donor, brand, { channel: "EMAIL" }), e = (value: unknown) => escapeHtml(value == null ? "" : String(value));
  design=channelDesign(design,"EMAIL");
  const profile = brand.profiles.find(item => item.id === design.profileId && item.channel === "EMAIL") || brand.profiles.find(item => item.channel === "EMAIL" && !item.resourceId);
  const identity = { ...brand.identity, ...profile?.values }, address = [identity.streetAddress1, identity.streetAddress2, identity.city, identity.stateProvince, identity.postalCode, identity.country].filter(Boolean).join(", ");
  if (!address) rendered.issues.push({ code: "EMAIL_ADDRESS", message: "Configure the organization's physical address in Brand Hub.", blocking: true, channel: "EMAIL" });
  const subject=renderStudio({...design,channels:undefined,body:{type:"doc",content:[{type:"paragraph",content:design.email.subject?[{type:"text",text:design.email.subject}]:[]}]},pack:{...design.pack,replySlip:{...design.pack.replySlip,enabled:false}},email:{...design.email,overrides:{}}},donor,brand,{channel:"EMAIL"});rendered.subject=subject.text;rendered.issues.push(...subject.issues);
  const header = design.presentation?.suppressEmailChrome ? "" : string(identity.globalHeaderHtml) || `${identity.logoUrl ? `<img src="${e(identity.logoUrl)}" alt="${e(identity.organizationDisplayName)}" style="max-width:160px;height:auto"><br>` : ""}<strong>${e(identity.organizationDisplayName)}</strong>`;
  const footer = design.presentation?.suppressEmailChrome ? "" : string(identity.globalFooterHtml) || e(identity.footerLegalText || identity.legalOrganizationName || identity.organizationDisplayName);
  for (const id of Object.keys(design.email.overrides)) if (!walkNodes(design.body).some(node => node.attrs?.studioId === id)) rendered.issues.push({code:"ORPHAN_EMAIL_OVERRIDE", message:"A customized email block was removed from the letter. Review and explicitly discard its customization.",nodeId:id,blocking:true,channel:"EMAIL"});
  if(design.presentation?.emailIncludesFooter){rendered.html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${rendered.html}</body></html>`;return rendered;}
  rendered.html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><style>@media(max-width:600px){.studio-email-column{display:block!important;width:100%!important;padding:8px 0!important}.studio-email-main{padding:20px!important}}img{max-width:100%;height:auto}table{max-width:100%}td,th{overflow-wrap:anywhere}</style></head><body style="margin:0;padding:0;background:${color(design.presentation?.emailBackground || identity.emailBackgroundColor, "#edf4fc")};color:${design.styles.color};font-family:${design.styles.emailFont};font-size:${design.styles.fontSize + 1}pt;line-height:${design.styles.lineHeight}"><div style="display:none;max-height:0;overflow:hidden">${e(design.email.previewText)}</div><table role="presentation" width="100%"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="100%" style="max-width:${number(design.presentation?.emailWidth || identity.emailContentWidth, 640, 320, 1200)}px;background:${design.styles.background}"><tr><td style="padding:20px 28px;border-bottom:1px solid #d7e2ef">${header}</td></tr><tr><td class="studio-email-main" style="padding:28px">${rendered.html}</td></tr><tr><td style="padding:20px 28px;font-family:Arial,sans-serif;font-size:11px;line-height:1.5;border-top:1px solid #d7e2ef">${footer}<p>${e(address)}</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a> · <a href="{{preferencesUrl}}">Email preferences</a></p></td></tr></table></td></tr></table></body></html>`;
  rendered.text = `${rendered.text}\n\n${plainText(footer)}\n${address}\nUnsubscribe: {{unsubscribeUrl}}\nPreferences: {{preferencesUrl}}`;
  return rendered;
}
