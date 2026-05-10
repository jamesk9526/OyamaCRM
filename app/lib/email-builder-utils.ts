/**
 * Email Builder Utilities
 *
 * - createDefaultBlock   — factory that produces a typed block with sane defaults
 * - parseVideoUrl        — detects embed type and thumbnail from a video URL
 * - generateEmailHtml    — renders an EmailTemplate as table-based HTML for email clients
 * - generatePlainText    — strips HTML to produce a plain-text fallback
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  BlockType,
  EmailBlock,
  EmailTemplate,
  TextBlock,
  QuoteBlock,
  ImpactStatBlock,
  ImageBlock,
  VideoBlock,
  ButtonBlock,
  AiTextBlock,
  AiButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  ColumnsBlock,
} from './email-builder-types';

// ─── Block Factory ────────────────────────────────────────────────────────────

/**
 * Creates a new EmailBlock of the given type with sensible default values.
 * Callers should store the returned block in template.blocks.
 */
export function createDefaultBlock(type: BlockType): EmailBlock {
  const id = uuidv4();

  switch (type) {
    case 'text':
      return {
        id,
        type: 'text',
        content: '<p>Edit this text block.</p>',
        fontSize: 16,
        color: '#333333',
        align: 'left',
        padding: 16,
      } satisfies TextBlock;

    case 'quote':
      return {
        id,
        type: 'quote',
        quote: 'Your support changed what was possible for our family.',
        attribution: 'Community Member',
        align: 'center',
        padding: 16,
      } satisfies QuoteBlock;

    case 'impactStat':
      return {
        id,
        type: 'impactStat',
        value: '327',
        label: 'Families Served This Quarter',
        sublabel: 'Because of generous donors like you',
        bgColor: '#ecfdf3',
        textColor: '#14532d',
        padding: 16,
      } satisfies ImpactStatBlock;

    case 'image':
      return {
        id,
        type: 'image',
        src: '',
        alt: 'Image',
        width: 100,
        align: 'center',
        padding: 16,
      } satisfies ImageBlock;

    case 'video':
      return {
        id,
        type: 'video',
        url: '',
        embedType: 'generic',
        padding: 16,
      } satisfies VideoBlock;

    case 'button':
      return {
        id,
        type: 'button',
        label: 'Click Here',
        href: 'https://',
        bgColor: '#16a34a',
        textColor: '#ffffff',
        align: 'center',
        padding: 16,
        borderRadius: 6,
      } satisfies ButtonBlock;

    case 'aiText':
      return {
        id,
        type: 'aiText',
        prompt: 'Write a concise donor update about this month\'s impact.',
        content: '<p>Use AI tools to generate a personalized donor update here.</p>',
        tone: 'warm',
        padding: 16,
      } satisfies AiTextBlock;

    case 'aiButton':
      return {
        id,
        type: 'aiButton',
        prompt: 'Generate a compelling call-to-action for recurring monthly giving.',
        label: 'Support This Work',
        href: 'https://',
        bgColor: '#16a34a',
        textColor: '#ffffff',
        align: 'center',
        padding: 16,
        borderRadius: 6,
      } satisfies AiButtonBlock;

    case 'divider':
      return {
        id,
        type: 'divider',
        color: '#e5e7eb',
        thickness: 1,
        padding: 16,
      } satisfies DividerBlock;

    case 'spacer':
      return {
        id,
        type: 'spacer',
        height: 32,
      } satisfies SpacerBlock;

    case 'social':
      return {
        id,
        type: 'social',
        links: [
          { platform: 'facebook',  url: 'https://facebook.com' },
          { platform: 'twitter',   url: 'https://twitter.com'  },
          { platform: 'instagram', url: 'https://instagram.com' },
        ],
        align: 'center',
        padding: 16,
      } satisfies SocialBlock;

    case 'columns':
      return {
        id,
        type: 'columns',
        columns: [
          [
            {
              id: uuidv4(),
              type: 'text',
              content: '<p>Column 1 text</p>',
              fontSize: 14,
              color: '#333333',
              align: 'left',
              padding: 8,
            },
          ],
          [
            {
              id: uuidv4(),
              type: 'text',
              content: '<p>Column 2 text</p>',
              fontSize: 14,
              color: '#333333',
              align: 'left',
              padding: 8,
            },
          ],
        ],
        padding: 16,
      } satisfies ColumnsBlock;
  }
}

// ─── Video URL Parser ─────────────────────────────────────────────────────────

export interface ParsedVideo {
  embedType: VideoBlock['embedType'];
  /** Resolved embed URL (iframe src). */
  embedUrl: string;
  /** Optional auto-derived thumbnail. */
  thumbnailUrl?: string;
}

/**
 * Analyses a raw video URL and returns the embed type, usable iframe src,
 * and an optional thumbnail URL.
 *
 * Supported providers:
 *   - YouTube  (youtube.com/watch?v=ID  |  youtu.be/ID)
 *   - Vimeo    (vimeo.com/ID)
 *   - OneDrive (onedrive.live.com  |  *.sharepoint.com)
 *   - Generic  (any other URL)
 */
export function parseVideoUrl(url: string): ParsedVideo {
  if (!url) return { embedType: 'generic', embedUrl: '' };

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (ytMatch) {
    const id = ytMatch[1];
    return {
      embedType: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      embedType: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // OneDrive / SharePoint
  if (url.includes('onedrive.live.com') || url.includes('sharepoint.com')) {
    return { embedType: 'onedrive', embedUrl: url };
  }

  return { embedType: 'generic', embedUrl: url };
}

// ─── HTML Email Generator ─────────────────────────────────────────────────────

/**
 * Renders a single EmailBlock as a <tr> snippet for use inside the
 * wrapper table. All styles are inlined for maximum email-client compat.
 */
function renderBlockHtml(block: EmailBlock, fontFamily: string): string {
  switch (block.type) {
    case 'text':
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};font-size:${block.fontSize}px;color:${block.color};text-align:${block.align};line-height:1.5;">
    ${block.content}
  </td>
</tr>`;

    case 'quote':
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};font-family:${fontFamily};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #16a34a;background:#f8fafc;">
      <tr>
        <td style="padding:14px 16px;font-size:16px;line-height:1.5;color:#1f2937;font-style:italic;">
          &ldquo;${block.quote}&rdquo;
        </td>
      </tr>
      ${block.attribution ? `<tr><td style="padding:0 16px 14px;font-size:12px;color:#6b7280;">- ${block.attribution}</td></tr>` : ""}
    </table>
  </td>
</tr>`;

    case 'impactStat':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:8px;">
      <tr>
        <td style="padding:18px 16px;text-align:center;font-family:${fontFamily};color:${block.textColor};">
          <div style="font-size:30px;line-height:1.15;font-weight:700;">${block.value}</div>
          <div style="font-size:14px;line-height:1.4;margin-top:4px;font-weight:600;">${block.label}</div>
          ${block.sublabel ? `<div style="font-size:12px;line-height:1.4;margin-top:4px;opacity:0.9;">${block.sublabel}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>`;

    case 'image': {
      const img = `<img src="${block.src}" alt="${block.alt}" width="${block.width}%" style="display:block;max-width:${block.width}%;height:auto;border:0;" />`;
      const inner = block.link
        ? `<a href="${block.link}" style="text-decoration:none;">${img}</a>`
        : img;
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};">
    ${inner}
  </td>
</tr>`;
    }

    case 'video': {
      const parsed = parseVideoUrl(block.url);
      const thumb = block.thumbnailUrl ?? parsed.thumbnailUrl ?? '';
      const imgTag = thumb
        ? `<img src="${thumb}" alt="${block.caption ?? 'Watch Video'}" width="100%" style="display:block;max-width:100%;height:auto;border:0;" />`
        : `<div style="background:#000;color:#fff;text-align:center;padding:40px;font-family:${fontFamily};">▶ Watch Video</div>`;
      return `<tr>
  <td style="padding:${block.padding}px;text-align:center;">
    <a href="${block.url}" style="text-decoration:none;">${imgTag}</a>
    ${block.caption ? `<p style="font-family:${fontFamily};font-size:13px;color:#666;text-align:center;margin:8px 0 0;">${block.caption}</p>` : ''}
  </td>
</tr>`;
    }

    case 'button':
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};">
    <a href="${block.href}" style="display:inline-block;background-color:${block.bgColor};color:${block.textColor};font-family:${fontFamily};font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:${block.borderRadius}px;line-height:1;">${block.label}</a>
  </td>
</tr>`;

    case 'aiText':
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};font-size:16px;color:#1f2937;line-height:1.5;">
    ${block.content}
  </td>
</tr>`;

    case 'aiButton':
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};">
    <a href="${block.href}" style="display:inline-block;background-color:${block.bgColor};color:${block.textColor};font-family:${fontFamily};font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:${block.borderRadius}px;line-height:1;">${block.label}</a>
  </td>
</tr>`;

    case 'divider':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <hr style="border:none;border-top:${block.thickness}px solid ${block.color};margin:0;" />
  </td>
</tr>`;

    case 'spacer':
      return `<tr>
  <td style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td>
</tr>`;

    case 'social': {
      const platformLabels: Record<string, string> = {
        facebook: 'Facebook', twitter: 'Twitter', instagram: 'Instagram',
        linkedin: 'LinkedIn', youtube: 'YouTube',
      };
      const platformColors: Record<string, string> = {
        facebook: '#1877f2', twitter: '#1da1f2', instagram: '#e1306c',
        linkedin: '#0a66c2', youtube: '#ff0000',
      };
      const links = block.links.map(
        (l) =>
          `<a href="${l.url}" style="display:inline-block;margin:0 4px;background-color:${platformColors[l.platform]};color:#fff;font-family:${fontFamily};font-size:12px;text-decoration:none;padding:6px 12px;border-radius:4px;">${platformLabels[l.platform]}</a>`
      ).join('');
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};">
    ${links}
  </td>
</tr>`;
    }

    case 'columns': {
      const col0 = block.columns[0]?.map((b) => renderBlockHtml(b, fontFamily)).join('') ?? '';
      const col1 = block.columns[1]?.map((b) => renderBlockHtml(b, fontFamily)).join('') ?? '';
      return `<tr>
  <td style="padding:${block.padding}px;">
    <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" valign="top"><![endif]-->
    <div style="display:inline-block;width:48%;vertical-align:top;min-width:200px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${col0}
      </table>
    </div>
    <!--[if mso]></td><td width="50%" valign="top"><![endif]-->
    <div style="display:inline-block;width:48%;vertical-align:top;min-width:200px;margin-left:4%;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${col1}
      </table>
    </div>
    <!--[if mso]></td></tr></table><![endif]-->
  </td>
</tr>`;
    }
  }
}

/**
 * Generates a complete, table-based HTML email from an EmailTemplate.
 * Includes MSO (Outlook) conditional comments for best compatibility.
 */
export function generateEmailHtml(template: EmailTemplate): string {
  const { blocks, backgroundColor, contentWidth, fontFamily } = template;
  const blockRows = blocks.map((b) => renderBlockHtml(b, fontFamily)).join('\n');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
  <!--[if mso]>
  <style type="text/css">body,table,td,a{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${backgroundColor};">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${backgroundColor};">
    <tr>
      <td align="center" style="padding:20px 0;">
        <!--[if mso]><table width="${contentWidth}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:${contentWidth}px;background-color:#ffffff;font-family:${fontFamily};">
          ${blockRows}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Plain-Text Generator ─────────────────────────────────────────────────────

/** Strips HTML tags from a string for use in the plain-text fallback. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Converts an EmailTemplate to a plain-text string.
 * Used as the `bodyText` payload when saving to the API.
 */
export function generatePlainText(template: EmailTemplate): string {
  return template.blocks
    .map((block) => {
      switch (block.type) {
        case 'text':    return stripHtml(block.content);
        case 'quote':   return `"${block.quote}"${block.attribution ? ` - ${block.attribution}` : ''}`;
        case 'impactStat': return `${block.value} - ${block.label}${block.sublabel ? ` - ${block.sublabel}` : ''}`;
        case 'image':   return `[Image: ${block.alt}]${block.link ? ` (${block.link})` : ''}`;
        case 'video':   return `[Video: ${block.url}]${block.caption ? ` — ${block.caption}` : ''}`;
        case 'button':  return `[${block.label}] → ${block.href}`;
        case 'aiText':  return stripHtml(block.content);
        case 'aiButton': return `[${block.label}] → ${block.href}`;
        case 'divider': return '─'.repeat(40);
        case 'spacer':  return '';
        case 'social':  return block.links.map((l) => `${l.platform}: ${l.url}`).join('  ');
        case 'columns':
          return block.columns
            .map((col) => col.map((b) => stripHtml((b as TextBlock).content ?? '')).join('\n'))
            .join('\n\n');
        default:        return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

// ─── Default Template ─────────────────────────────────────────────────────────

export type TemplatePreset = 'blank' | 'newsletter' | 'appeal' | 'event';

/**
 * Creates a full starter template from a named preset.
 * This accelerates campaign creation and gives users opinionated starting layouts.
 */
export function createTemplateFromPreset(preset: TemplatePreset): EmailTemplate {
  if (preset === 'blank') return createDefaultTemplate();

  if (preset === 'newsletter') {
    return {
      backgroundColor: '#f5f5f5',
      contentWidth: 640,
      fontFamily: 'Arial, Helvetica, sans-serif',
      blocks: [
        { ...createDefaultBlock('text'), content: '<h1>Monthly Update</h1><p>Share your impact highlights and upcoming opportunities.</p>' } as TextBlock,
        { ...createDefaultBlock('image'), src: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80', alt: 'Community impact', width: 100 } as ImageBlock,
        { ...createDefaultBlock('text'), content: '<h2>Program Spotlight</h2><p>This month we served 240 families across three neighborhoods.</p>' } as TextBlock,
        { ...createDefaultBlock('button'), label: 'Read Full Story', href: 'https://oyamacrm.org/story' } as ButtonBlock,
      ],
    };
  }

  if (preset === 'appeal') {
    return {
      backgroundColor: '#f3f4f6',
      contentWidth: 600,
      fontFamily: 'Arial, Helvetica, sans-serif',
      blocks: [
        { ...createDefaultBlock('text'), content: '<h1>Your Gift Changes Lives</h1><p>Help us reach more families this season.</p>', align: 'center' } as TextBlock,
        { ...createDefaultBlock('button'), label: 'Donate Now', href: 'https://oyamacrm.org/donate', bgColor: '#16a34a' } as ButtonBlock,
        { ...createDefaultBlock('divider') } as DividerBlock,
        { ...createDefaultBlock('text'), content: '<p><strong>$50</strong> funds one week of meals for a student.<br/><strong>$250</strong> funds a month of tutoring support.</p>' } as TextBlock,
      ],
    };
  }

  return {
    backgroundColor: '#f5f5f5',
    contentWidth: 620,
    fontFamily: 'Arial, Helvetica, sans-serif',
    blocks: [
      { ...createDefaultBlock('text'), content: '<h1>You&apos;re Invited</h1><p>Join us for our upcoming community event.</p>', align: 'center' } as TextBlock,
      { ...createDefaultBlock('image'), src: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80', alt: 'Event banner' } as ImageBlock,
      { ...createDefaultBlock('text'), content: '<p><strong>Date:</strong> September 21<br/><strong>Location:</strong> Hope Hall</p>' } as TextBlock,
      { ...createDefaultBlock('button'), label: 'RSVP Today', href: 'https://oyamacrm.org/rsvp' } as ButtonBlock,
    ],
  };
}

/** Returns a fresh EmailTemplate with one example TextBlock. */
export function createDefaultTemplate(): EmailTemplate {
  return {
    backgroundColor: '#f5f5f5',
    contentWidth: 600,
    fontFamily: 'Arial, Helvetica, sans-serif',
    blocks: [createDefaultBlock('text')],
  };
}
