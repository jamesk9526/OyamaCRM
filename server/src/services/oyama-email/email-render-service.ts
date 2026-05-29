/**
 * Shared OyamaEmail renderer used by builder preview, publish, test-send, and campaign send.
 * Converts template JSON into final HTML and plain-text output.
 */

export type OyamaEmailBlockType =
  | "header"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "social"
  | "video"
  | "fileLink"
  | "donationButton"
  | "eventButton"
  | "html";

export interface OyamaEmailBlock {
  id: string;
  type: OyamaEmailBlockType;
  headerTitle?: string;
  headerSubtitle?: string;
  headerBackgroundColor?: string;
  logoUrl?: string;
  logoWidth?: number;
  align?: "left" | "center" | "right";
  paddingY?: number;
  content?: string;
  src?: string;
  alt?: string;
  label?: string;
  href?: string;
  color?: string;
  textColor?: string;
  thickness?: number;
  height?: number;
  leftHtml?: string;
  rightHtml?: string;
  links?: Array<{ label: string; url: string }>;
  socialMode?: "follow" | "share";
  socialLayout?: "row" | "column";
  socialIconStyle?: "pill" | "outline" | "plain";
  socialTrackingLabel?: string;
  socialShowLabels?: boolean;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoCtaLabel?: string;
  videoAlt?: string;
  videoFallbackText?: string;
  videoTrackingLabel?: string;
  caption?: string;
  fileLabel?: string;
  fileUrl?: string;
  fileDescription?: string;
  fileTrackingLabel?: string;
  html?: string;
}

export interface OyamaEmailTemplateDocument {
  version: number;
  contentWidth: number;
  backgroundColor: string;
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  blocks: OyamaEmailBlock[];
}

export interface OyamaEmailTemplateSettings {
  includeUnsubscribeLink: boolean;
  includePhysicalAddress: boolean;
  enablePlainTextVersion: boolean;
  physicalAddress: string;
  footerBrandingText: string;
}

export interface RenderEmailTemplateResult {
  html: string;
  text: string;
  mergeFieldsUsed: string[];
}

const MERGE_FIELD_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFontFamily(value: unknown): string {
  const input = asString(value).trim();
  if (!input) return "Arial, Helvetica, sans-serif";
  if (!/^[a-zA-Z0-9\s,\-"']+$/.test(input)) return "Arial, Helvetica, sans-serif";
  return input;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRichHtml(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['\"]).*?\1/gi, "");
}

function nextId(index: number): string {
  return `block_${index + 1}`;
}

function normalizeLinks(raw: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const normalized: Array<{ label: string; url: string }> = [];
  raw.forEach((row) => {
    const candidate = asObject(row);
    const label = asString(candidate.label).trim();
    const url = asString(candidate.url).trim();
    if (!url) return;
    normalized.push({ label: label || "Link", url });
  });
  return normalized.slice(0, 6);
}

function extractNestedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => extractNestedText(entry)).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";
  return Object.values(value as Record<string, unknown>)
    .map((entry) => extractNestedText(entry))
    .filter(Boolean)
    .join("\n");
}

function normalizeBlock(raw: unknown, index: number): OyamaEmailBlock {
  const input = asObject(raw);
  const legacyType = asString(input.type).trim();
  const mappedType = legacyType === "customHtml" ? "html" : legacyType;
  const supported: OyamaEmailBlockType[] = [
    "header",
    "text",
    "image",
    "button",
    "divider",
    "spacer",
    "columns",
    "social",
    "video",
    "fileLink",
    "donationButton",
    "eventButton",
    "html",
  ];

  const type = supported.includes(mappedType as OyamaEmailBlockType)
    ? (mappedType as OyamaEmailBlockType)
    : "text";

  const id = asString(input.id).trim() || nextId(index);

  if (type === "header") {
    const alignRaw = asString(input.align).trim().toLowerCase();
    const align = alignRaw === "left" || alignRaw === "right" ? alignRaw : "center";
    return {
      id,
      type,
      headerTitle: asString(input.headerTitle).trim() || "Your Organization",
      headerSubtitle: asString(input.headerSubtitle).trim(),
      headerBackgroundColor: asString(input.headerBackgroundColor).trim() || "#0f5c3c",
      logoUrl: asString(input.logoUrl).trim(),
      logoWidth: clamp(asNumber(input.logoWidth, 140), 60, 260),
      align,
      paddingY: clamp(asNumber(input.paddingY, 20), 8, 56),
    };
  }

  if (type === "text") {
    const content = asString(input.content).trim();
    const fallback = extractNestedText(input) || "Edit this text block.";
    return { id, type, content: content || fallback };
  }

  if (type === "image") {
    return {
      id,
      type,
      src: asString(input.src).trim(),
      alt: asString(input.alt).trim(),
    };
  }

  if (type === "button" || type === "donationButton" || type === "eventButton") {
    return {
      id,
      type,
      label: asString(input.label).trim() || asString(input.buttonLabel).trim() || "Learn More",
      href: asString(input.href).trim() || asString(input.buttonUrl).trim() || "",
      color: asString(input.color).trim() || asString(input.bgColor).trim() || "#0f5c3c",
      textColor: asString(input.textColor).trim() || asString(input.buttonTextColor).trim() || "#ffffff",
    };
  }

  if (type === "divider") {
    return {
      id,
      type,
      color: asString(input.color).trim() || "#d7e0dc",
      thickness: clamp(asNumber(input.thickness, 1), 1, 8),
    };
  }

  if (type === "spacer") {
    return {
      id,
      type,
      height: clamp(asNumber(input.height, 24), 4, 160),
    };
  }

  if (type === "columns") {
    const leftHtml = asString(input.leftHtml).trim();
    const rightHtml = asString(input.rightHtml).trim();
    if (leftHtml || rightHtml) {
      return {
        id,
        type,
        leftHtml: leftHtml || "<p>Add left column content.</p>",
        rightHtml: rightHtml || "<p>Add right column content.</p>",
      };
    }

    const legacyColumns = Array.isArray(input.columns) ? input.columns : [];
    const leftLegacy = extractNestedText(legacyColumns[0]);
    const rightLegacy = extractNestedText(legacyColumns[1]);

    return {
      id,
      type,
      leftHtml: leftLegacy ? `<p>${escapeHtml(leftLegacy)}</p>` : "<p>Add left column content.</p>",
      rightHtml: rightLegacy ? `<p>${escapeHtml(rightLegacy)}</p>` : "<p>Add right column content.</p>",
    };
  }

  if (type === "social") {
    return {
      id,
      type,
      links: normalizeLinks(input.links),
      socialMode: asString(input.socialMode).trim().toLowerCase() === "share" ? "share" : "follow",
      socialLayout: asString(input.socialLayout).trim().toLowerCase() === "column" ? "column" : "row",
      socialIconStyle: asString(input.socialIconStyle).trim().toLowerCase() === "outline"
        ? "outline"
        : asString(input.socialIconStyle).trim().toLowerCase() === "plain"
          ? "plain"
          : "pill",
      socialTrackingLabel: asString(input.socialTrackingLabel).trim(),
      socialShowLabels: asBoolean(input.socialShowLabels, true),
    };
  }

  if (type === "video") {
    return {
      id,
      type,
      thumbnailUrl: asString(input.thumbnailUrl).trim(),
      videoUrl: asString(input.videoUrl).trim() || asString(input.url).trim(),
      videoTitle: asString(input.videoTitle).trim(),
      videoCtaLabel: asString(input.videoCtaLabel).trim() || "Watch Video",
      videoAlt: asString(input.videoAlt).trim() || "Video thumbnail",
      videoFallbackText: asString(input.videoFallbackText).trim(),
      videoTrackingLabel: asString(input.videoTrackingLabel).trim(),
      caption: asString(input.caption).trim(),
    };
  }

  if (type === "fileLink") {
    return {
      id,
      type,
      fileLabel: asString(input.fileLabel).trim() || "Download Resource",
      fileUrl: asString(input.fileUrl).trim(),
      fileDescription: asString(input.fileDescription).trim(),
      fileTrackingLabel: asString(input.fileTrackingLabel).trim(),
    };
  }

  return {
    id,
    type: "html",
    html: asString(input.html).trim() || asString(input.content).trim() || "<p>Custom HTML block</p>",
  };
}

export function createDefaultEmailTemplateDocument(): OyamaEmailTemplateDocument {
  return {
    version: 1,
    contentWidth: 600,
    backgroundColor: "#f3f7f5",
    fontFamily: "Arial, Helvetica, sans-serif",
    baseFontSize: 16,
    lineHeight: 1.6,
    textColor: "#1f2937",
    linkColor: "#0f5c3c",
    blocks: [
      {
        id: "block_1",
        type: "text",
        content: "<h2>Thank you, {{ donor.firstName }}!</h2><p>Your generosity makes practical care possible every day.</p>",
      },
      {
        id: "block_2",
        type: "button",
        label: "Learn More",
        href: "https://",
        color: "#0f5c3c",
        textColor: "#ffffff",
      },
    ],
  };
}

export function normalizeEmailTemplateDocument(raw: unknown): OyamaEmailTemplateDocument {
  const input = asObject(raw);
  const blocksInput = Array.isArray(input.blocks) ? input.blocks : [];
  const blocks = blocksInput.map((row, index) => normalizeBlock(row, index));

  if (blocks.length === 0) {
    return createDefaultEmailTemplateDocument();
  }

  return {
    version: 1,
    contentWidth: clamp(asNumber(input.contentWidth, 600), 420, 760),
    backgroundColor: asString(input.backgroundColor).trim() || "#f3f7f5",
    fontFamily: sanitizeFontFamily(input.fontFamily),
    baseFontSize: clamp(asNumber(input.baseFontSize, 16), 12, 22),
    lineHeight: clamp(asNumber(input.lineHeight, 1.6), 1.2, 2.2),
    textColor: asString(input.textColor).trim() || "#1f2937",
    linkColor: asString(input.linkColor).trim() || "#0f5c3c",
    blocks,
  };
}

export function normalizeEmailTemplateSettings(raw: unknown): OyamaEmailTemplateSettings {
  const input = asObject(raw);
  return {
    includeUnsubscribeLink: asBoolean(input.includeUnsubscribeLink, true),
    includePhysicalAddress: asBoolean(input.includePhysicalAddress, true),
    enablePlainTextVersion: asBoolean(input.enablePlainTextVersion, true),
    physicalAddress: asString(input.physicalAddress).trim(),
    footerBrandingText: asString(input.footerBrandingText).trim(),
  };
}

interface RenderTheme {
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
}

function themeFromTemplate(template: OyamaEmailTemplateDocument): RenderTheme {
  return {
    fontFamily: sanitizeFontFamily(template.fontFamily),
    baseFontSize: clamp(asNumber(template.baseFontSize, 16), 12, 22),
    lineHeight: clamp(asNumber(template.lineHeight, 1.6), 1.2, 2.2),
    textColor: asString(template.textColor).trim() || "#1f2937",
    linkColor: asString(template.linkColor).trim() || "#0f5c3c",
  };
}

function renderTextBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const html = sanitizeRichHtml(asString(block.content).trim() || "<p>Add text</p>");
  return `
<tr>
  <td style="padding:14px 24px;font-family:${escapeHtml(theme.fontFamily)};font-size:${theme.baseFontSize}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">
    ${html}
  </td>
</tr>`;
}

function renderHeaderBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const title = escapeHtml(asString(block.headerTitle).trim() || "Your Organization");
  const subtitle = escapeHtml(asString(block.headerSubtitle).trim());
  const bg = escapeHtml(asString(block.headerBackgroundColor).trim() || "#0f5c3c");
  const logoUrl = asString(block.logoUrl).trim();
  const logoWidth = clamp(asNumber(block.logoWidth, 140), 60, 260);
  const align = block.align === "left" || block.align === "right" ? block.align : "center";
  const paddingY = clamp(asNumber(block.paddingY, 20), 8, 56);

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Organization logo" style="display:block;width:${logoWidth}px;max-width:100%;height:auto;margin:${align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"};" />`
    : "";

  return `
<tr>
  <td style="padding:${paddingY}px 24px;background:${bg};text-align:${align};font-family:${escapeHtml(theme.fontFamily)};">
    ${logoHtml ? `<div style=\"margin-bottom:10px;\">${logoHtml}</div>` : ""}
    <div style="font-size:${Math.max(theme.baseFontSize + 8, 24)}px;line-height:1.2;font-weight:700;color:#ffffff;">${title}</div>
    ${subtitle ? `<div style=\"margin-top:6px;font-size:${Math.max(theme.baseFontSize - 1, 12)}px;line-height:1.5;color:#ecfdf5;\">${subtitle}</div>` : ""}
  </td>
</tr>`;
}

function renderImageBlock(block: OyamaEmailBlock): string {
  const src = asString(block.src).trim();
  if (!src) {
    return `
<tr>
  <td style="padding:14px 24px;">
    <div style="border:1px dashed #cbd5e1;border-radius:10px;padding:18px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#64748b;">Image block has no source URL.</div>
  </td>
</tr>`;
  }

  const alt = escapeHtml(asString(block.alt).trim() || "Email image");
  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    <img src="${escapeHtml(src)}" alt="${alt}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />
  </td>
</tr>`;
}

function renderButtonBlock(block: OyamaEmailBlock): string {
  const label = escapeHtml(asString(block.label).trim() || "Open Link");
  const href = escapeHtml(asString(block.href).trim() || "#");
  const color = escapeHtml(asString(block.color).trim() || "#0f5c3c");
  const textColor = escapeHtml(asString(block.textColor).trim() || "#ffffff");

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${color};color:${textColor};padding:12px 20px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${label}</a>
  </td>
</tr>`;
}

function renderDividerBlock(block: OyamaEmailBlock): string {
  const color = escapeHtml(asString(block.color).trim() || "#d7e0dc");
  const thickness = clamp(asNumber(block.thickness, 1), 1, 8);
  return `
<tr>
  <td style="padding:12px 24px;">
    <hr style="margin:0;border:0;border-top:${thickness}px solid ${color};" />
  </td>
</tr>`;
}

function renderSpacerBlock(block: OyamaEmailBlock): string {
  const height = clamp(asNumber(block.height, 24), 4, 160);
  return `
<tr>
  <td style="height:${height}px;line-height:${height}px;font-size:${height}px;">&nbsp;</td>
</tr>`;
}

function renderColumnsBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const left = sanitizeRichHtml(asString(block.leftHtml).trim() || "<p>Add left column content.</p>");
  const right = sanitizeRichHtml(asString(block.rightHtml).trim() || "<p>Add right column content.</p>");

  return `
<tr>
  <td style="padding:14px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" valign="top" style="padding:0 8px 0 0;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 1)}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">${left}</td>
        <td width="50%" valign="top" style="padding:0 0 0 8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 1)}px;line-height:${theme.lineHeight};color:${escapeHtml(theme.textColor)};">${right}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderSocialBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const links = Array.isArray(block.links) ? block.links : [];
  const mode = block.socialMode === "share" ? "share" : "follow";
  const layout = block.socialLayout === "column" ? "column" : "row";
  const style = block.socialIconStyle === "outline"
    ? "outline"
    : block.socialIconStyle === "plain"
      ? "plain"
      : "pill";
  const showLabels = block.socialShowLabels !== false;

  if (links.length === 0) {
    return `
<tr>
  <td style="padding:14px 24px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;line-height:${theme.lineHeight};color:#64748b;text-align:center;">Add social links in the builder inspector.</td>
</tr>`;
  }

  const linkHtml = links
    .slice(0, 6)
    .map((link) => {
      const label = escapeHtml(link.label || "Link");
      const url = escapeHtml(link.url || "#");
      const content = showLabels ? label : "●";
      const styleTokens = style === "outline"
        ? `display:inline-block;margin:4px 6px;padding:6px 10px;border-radius:999px;border:1px solid ${escapeHtml(theme.linkColor)};color:${escapeHtml(theme.linkColor)};text-decoration:none;`
        : style === "plain"
          ? `display:inline-block;margin:4px 6px;color:${escapeHtml(theme.linkColor)};text-decoration:none;`
          : `display:inline-block;margin:4px 6px;padding:6px 10px;border-radius:999px;background:#ecfdf5;border:1px solid #bbf7d0;color:${escapeHtml(theme.linkColor)};text-decoration:none;`;
      return `<a href="${url}" style="${styleTokens}font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${content}</a>`;
    })
    .join("");

  const heading = mode === "share" ? "Share this campaign" : "Follow us";

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    <div style="margin-bottom:6px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(10, theme.baseFontSize - 4)}px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">${heading}</div>
    ${layout === "column" ? `<div>${linkHtml.split("</a>").filter(Boolean).map((entry) => `${entry}</a><br/>`).join("")}</div>` : linkHtml}
  </td>
</tr>`;
}

function renderVideoBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const thumbnailUrl = asString(block.thumbnailUrl).trim();
  const videoUrl = asString(block.videoUrl).trim();
  const videoTitle = escapeHtml(asString(block.videoTitle).trim());
  const videoCtaLabel = escapeHtml(asString(block.videoCtaLabel).trim() || "Watch Video");
  const videoAlt = escapeHtml(asString(block.videoAlt).trim() || "Video thumbnail");
  const fallbackText = escapeHtml(asString(block.videoFallbackText).trim());
  const caption = escapeHtml(asString(block.caption).trim());

  const imageHtml = thumbnailUrl
    ? `<img src="${escapeHtml(thumbnailUrl)}" alt="${videoAlt}" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />`
    : "<div style='border:1px dashed #f59e0b;background:#fffbeb;border-radius:10px;padding:18px;color:#92400e;'>Add a thumbnail URL for this video before sending.</div>";

  const wrapped = videoUrl
    ? `<a href="${escapeHtml(videoUrl)}" style="text-decoration:none;">${imageHtml}</a>`
    : imageHtml;

  const ctaHtml = videoUrl
    ? `<div style="margin-top:10px;"><a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#0f5c3c;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${videoCtaLabel}</a></div>`
    : "";

  const captionHtml = caption
    ? `<div style="margin-top:8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;color:#64748b;">${caption}</div>`
    : "";

  const fallbackHtml = fallbackText
    ? `<div style="margin-top:6px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;color:#64748b;">${fallbackText}</div>`
    : "";

  return `
<tr>
  <td style="padding:14px 24px;text-align:center;">
    ${videoTitle ? `<div style=\"margin-bottom:8px;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(14, theme.baseFontSize)}px;font-weight:700;color:${escapeHtml(theme.textColor)};\">${videoTitle}</div>` : ""}
    ${wrapped}
    ${ctaHtml}
    ${captionHtml}
    ${fallbackHtml}
  </td>
</tr>`;
}

function renderFileLinkBlock(block: OyamaEmailBlock, theme: RenderTheme): string {
  const label = escapeHtml(asString(block.fileLabel).trim() || "Download Resource");
  const href = escapeHtml(asString(block.fileUrl).trim() || "#");
  const description = escapeHtml(asString(block.fileDescription).trim());

  return `
<tr>
  <td style="padding:14px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe5df;border-radius:10px;background:#f8fafc;">
      <tr>
        <td style="padding:12px 14px;font-family:${escapeHtml(theme.fontFamily)};">
          <a href="${href}" style="display:inline-block;background:#0f5c3c;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-size:${Math.max(12, theme.baseFontSize - 2)}px;font-weight:700;">${label}</a>
          ${description ? `<div style=\"margin-top:8px;font-size:${Math.max(11, theme.baseFontSize - 3)}px;line-height:${theme.lineHeight};color:#64748b;\">${description}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function renderHtmlBlock(block: OyamaEmailBlock): string {
  const html = sanitizeRichHtml(asString(block.html).trim() || "<p>Custom HTML block</p>");
  return `
<tr>
  <td style="padding:14px 24px;">${html}</td>
</tr>`;
}

function renderFooter(settings: OyamaEmailTemplateSettings, theme: RenderTheme): string {
  const parts: string[] = [];

  if (settings.footerBrandingText.trim()) {
    parts.push(`<div>${escapeHtml(settings.footerBrandingText.trim())}</div>`);
  }

  if (settings.includePhysicalAddress && settings.physicalAddress.trim()) {
    parts.push(`<div>${escapeHtml(settings.physicalAddress.trim())}</div>`);
  }

  if (settings.includeUnsubscribeLink) {
    parts.push('<div><a href="{{unsubscribeUrl}}" style="color:#475569;text-decoration:underline;">Unsubscribe</a> · <a href="{{managePreferencesUrl}}" style="color:#475569;text-decoration:underline;">Manage Preferences</a></div>');
  }

  if (parts.length === 0) return "";

  return `
<tr>
  <td style="padding:18px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;font-family:${escapeHtml(theme.fontFamily)};font-size:${Math.max(11, theme.baseFontSize - 3)}px;line-height:${theme.lineHeight};color:#475569;">
    ${parts.join("")}
  </td>
</tr>`;
}

export function extractMergeFieldsFromContent(value: string): string[] {
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MERGE_FIELD_PATTERN.exec(value)) !== null) {
    tokens.add(match[1]);
  }
  return Array.from(tokens).sort();
}

export function applyMergeTokens(value: string, vars: Record<string, string>): string {
  return value.replace(MERGE_FIELD_PATTERN, (_token, rawKey: string) => {
    const key = String(rawKey || "").trim();
    if (!key) return "";
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? "";
    }
    return "";
  });
}

export function htmlToPlainText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function renderEmailTemplateDocument(
  template: OyamaEmailTemplateDocument,
  settings: OyamaEmailTemplateSettings,
): RenderEmailTemplateResult {
  const theme = themeFromTemplate(template);
  const body = template.blocks
    .map((block) => {
      if (block.type === "header") return renderHeaderBlock(block, theme);
      if (block.type === "text") return renderTextBlock(block, theme);
      if (block.type === "image") return renderImageBlock(block);
      if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") return renderButtonBlock(block);
      if (block.type === "divider") return renderDividerBlock(block);
      if (block.type === "spacer") return renderSpacerBlock(block);
      if (block.type === "columns") return renderColumnsBlock(block, theme);
      if (block.type === "social") return renderSocialBlock(block, theme);
      if (block.type === "video") return renderVideoBlock(block, theme);
      if (block.type === "fileLink") return renderFileLinkBlock(block, theme);
      return renderHtmlBlock(block);
    })
    .join("\n");

  const footer = renderFooter(settings, theme);
  const contentWidth = clamp(template.contentWidth, 420, 760);
  const bg = escapeHtml(template.backgroundColor || "#f3f7f5");
  const linkColor = escapeHtml(theme.linkColor);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${bg};">
    <style>
      .oyama-email-root a { color: ${linkColor}; }
      .oyama-email-root h1,
      .oyama-email-root h2,
      .oyama-email-root h3,
      .oyama-email-root h4,
      .oyama-email-root h5,
      .oyama-email-root h6 { margin: 0 0 0.55em 0; color: ${escapeHtml(theme.textColor)}; }
      .oyama-email-root h2 { font-size: ${Math.max(theme.baseFontSize + 8, 24)}px; line-height: 1.24; }
      .oyama-email-root h3 { font-size: ${Math.max(theme.baseFontSize + 4, 20)}px; line-height: 1.28; }
      .oyama-email-root p { margin: 0 0 0.95em 0; }
    </style>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table class="oyama-email-root" role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${contentWidth}px;max-width:100%;background:#ffffff;border:1px solid #dbe5df;border-radius:14px;overflow:hidden;">
            ${body}
            ${footer}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = settings.enablePlainTextVersion ? htmlToPlainText(html) : "";
  const mergeFieldsUsed = extractMergeFieldsFromContent(html);

  return {
    html,
    text,
    mergeFieldsUsed,
  };
}

export function renderEmailTemplateDocumentWithMerge(
  template: OyamaEmailTemplateDocument,
  settings: OyamaEmailTemplateSettings,
  vars: Record<string, string>,
): RenderEmailTemplateResult {
  const rendered = renderEmailTemplateDocument(template, settings);
  return {
    html: applyMergeTokens(rendered.html, vars),
    text: applyMergeTokens(rendered.text, vars),
    mergeFieldsUsed: rendered.mergeFieldsUsed,
  };
}
