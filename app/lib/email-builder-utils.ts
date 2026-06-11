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
  HeadingBlock,
  TextBlock,
  QuoteBlock,
  ImpactStatBlock,
  StatisticsBlock,
  ImpactStoryBlock,
  ImpactGridBlock,
  ProgressBlock,
  TimelineBlock,
  CalloutBlock,
  FeatureListBlock,
  DonorThankYouBlock,
  DonationReceiptBlock,
  GivingSummaryBlock,
  DonationCtaBlock,
  MonthlyDonorInvitationBlock,
  LapsedDonorReengagementBlock,
  FirstTimeDonorWelcomeBlock,
  StaffSignatureBlock,
  FooterComplianceBlock,
  EventDetailsBlock,
  PartnerLogosBlock,
  ContactCardBlock,
  ImageBlock,
  VideoBlock,
  ButtonBlock,
  AiTextBlock,
  AiButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  ColumnsBlock,
  CustomHtmlBlock,
} from './email-builder-types';

interface RichTextRenderOptions {
  textColor?: string;
  baseFontSizePx?: number;
  linkColor?: string;
  quoteAccentColor?: string;
  fontFamily?: string;
}

function appendInlineStyleToTag(html: string, tagName: string, inlineStyle: string): string {
  const pattern = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'gi');
  return html.replace(pattern, (match, attrs = '') => {
    if (/style\s*=\s*['"]/i.test(attrs)) {
      return match.replace(/style\s*=\s*(['"])(.*?)\1/i, (_styleMatch, quote: string, current: string) => {
        const nextStyle = `${String(current || '').trim().replace(/;?$/, ';')} ${inlineStyle}`.trim();
        return `style=${quote}${nextStyle}${quote}`;
      });
    }
    return `<${tagName}${attrs} style="${inlineStyle}">`;
  });
}

/** Applies inline, email-safe defaults to Tiptap-authored rich text so saved HTML survives email clients. */
export function formatRichTextHtml(html: string, options: RichTextRenderOptions = {}): string {
  const {
    textColor = '#1f2937',
    baseFontSizePx = 16,
    linkColor = '#166534',
    quoteAccentColor = '#16a34a',
    fontFamily,
  } = options;
  const fontStyle = fontFamily ? `font-family:${fontFamily};` : '';

  let formatted = String(html || '').trim();
  if (!formatted) {
    return `<p style="margin:0;font-size:${baseFontSizePx}px;line-height:1.6;color:${textColor};${fontStyle}">&nbsp;</p>`;
  }

  formatted = appendInlineStyleToTag(formatted, 'p', `margin:0 0 12px;font-size:${baseFontSizePx}px;line-height:1.6;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'h1', `margin:0 0 14px;font-size:32px;line-height:1.2;font-weight:700;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'h2', `margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'h3', `margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:700;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'ul', `margin:0 0 12px 24px;padding:0;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'ol', `margin:0 0 12px 24px;padding:0;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'li', `margin:0 0 8px;font-size:${baseFontSizePx}px;line-height:1.6;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'blockquote', `margin:0 0 12px;padding:0 0 0 16px;border-left:4px solid ${quoteAccentColor};font-style:italic;color:${textColor};${fontStyle}`);
  formatted = appendInlineStyleToTag(formatted, 'a', `color:${linkColor};text-decoration:underline;${fontStyle}`);

  return formatted;
}

// ─── Block Factory ────────────────────────────────────────────────────────────

/**
 * Creates a new EmailBlock of the given type with sensible default values.
 * Callers should store the returned block in template.blocks.
 */
export function createDefaultBlock(type: BlockType): EmailBlock {
  const id = uuidv4();

  switch (type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        eyebrow: 'Impact Update',
        title: 'Together, We Reached More Families',
        subtitle: 'Here is what your generosity made possible this month.',
        align: 'left',
        textColor: '#111827',
        padding: 18,
      } satisfies HeadingBlock;

    case 'text':
      return {
        id,
        type: 'text',
        content: '',
        htmlEditingEnabled: false,
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
        accentColor: '#16a34a',
        padding: 16,
      } satisfies QuoteBlock;

    case 'impactStat':
      return {
        id,
        type: 'impactStat',
        value: '327',
        label: 'Families Served This Quarter',
        timePeriod: 'This Quarter',
        icon: '❤',
        sublabel: 'Because of generous donors like you',
        bgColor: '#ecfdf3',
        textColor: '#14532d',
        padding: 16,
      } satisfies ImpactStatBlock;

    case 'statistics':
      return {
        id,
        type: 'statistics',
        title: 'By the Numbers',
        intro: 'A quick look at what your support made possible.',
        items: [
          { value: '327', label: 'Families served', detail: 'Across local programs' },
          { value: '1,240', label: 'Meals provided', detail: 'For neighbors in crisis' },
          { value: '86%', label: 'Goal reached', detail: 'Toward this campaign' },
          { value: '54', label: 'New volunteers', detail: 'Trained this month' },
        ],
        columnCount: 2,
        bgColor: '#f8fafc',
        cardColor: '#ffffff',
        textColor: '#0f172a',
        accentColor: '#2563eb',
        padding: 16,
      } satisfies StatisticsBlock;

    case 'impactStory':
      return {
        id,
        type: 'impactStory',
        headline: 'A Story of Real Impact',
        story: 'After receiving emergency assistance, a young mother gained stability and entered parenting support classes.',
        pseudonym: 'Shared with permission; name changed for privacy.',
        imageUrl: '',
        outcome: 'Now she has consistent support, practical resources, and a hopeful path forward.',
        ctaLabel: 'Read More Stories',
        ctaUrl: 'https://',
        ctaColor: '#16a34a',
        bgColor: '#f8fafc',
        textColor: '#1f2937',
        padding: 16,
      } satisfies ImpactStoryBlock;

    case 'impactGrid':
      return {
        id,
        type: 'impactGrid',
        title: 'This Month in Numbers',
        items: [
          { value: '327', label: 'Families Served' },
          { value: '54', label: 'New Volunteers' },
          { value: '91%', label: 'Programs On Track' },
        ],
        bgColor: '#ecfdf3',
        textColor: '#14532d',
        accentColor: '#16a34a',
        padding: 16,
      } satisfies ImpactGridBlock;

    case 'progress':
      return {
        id,
        type: 'progress',
        label: 'Scholarship Campaign',
        current: 18500,
        goal: 25000,
        barColor: '#16a34a',
        trackColor: '#d1fae5',
        textColor: '#14532d',
        padding: 16,
      } satisfies ProgressBlock;

    case 'timeline':
      return {
        id,
        type: 'timeline',
        title: 'Recent Milestones',
        items: [
          { title: 'Community Pantry Expansion', detail: 'Opened two additional service nights.' },
          { title: 'Youth Mentoring Launch', detail: 'Paired 40 students with trained mentors.' },
          { title: 'Volunteer Training Day', detail: 'Certified 65 returning volunteers.' },
        ],
        accentColor: '#16a34a',
        textColor: '#1f2937',
        padding: 16,
      } satisfies TimelineBlock;

    case 'callout':
      return {
        id,
        type: 'callout',
        title: 'A Story of Real Impact',
        body: 'After receiving emergency assistance, Maria secured stable housing and enrolled in our job-readiness program within six weeks.',
        bgColor: '#eff6ff',
        borderColor: '#2563eb',
        textColor: '#1e3a8a',
        padding: 16,
      } satisfies CalloutBlock;

    case 'featureList':
      return {
        id,
        type: 'featureList',
        title: 'What Your Support Funds',
        items: [
          'Nutritious meals for families in crisis',
          'After-school tutoring and mentoring',
          'Transportation assistance to medical appointments',
        ],
        dollarFraming: '$50 helps provide one week of family essentials.',
        bulletColor: '#16a34a',
        textColor: '#1f2937',
        padding: 16,
      } satisfies FeatureListBlock;

    case 'donorThankYou':
      return {
        id,
        type: 'donorThankYou',
        headline: 'Thank You for Your Generosity',
        thankYouMessage: 'Your support helps provide real care to families in our community.',
        giftAmountToken: '{{lastGiftAmount}}',
        giftDateToken: '{{lastGiftDate}}',
        campaignToken: '{{campaignName}}',
        staffSignature: '{{staffName}}',
        bgColor: '#ecfdf3',
        textColor: '#14532d',
        padding: 16,
      } satisfies DonorThankYouBlock;

    case 'donationReceipt':
      return {
        id,
        type: 'donationReceipt',
        donorNameToken: '{{fullName}}',
        giftAmountToken: '{{lastGiftAmount}}',
        giftDateToken: '{{lastGiftDate}}',
        receiptNumberToken: '{{receiptNumber}}',
        taxDeductibleToken: '{{taxDeductibleAmount}}',
        designationToken: '{{campaignName}}',
        organizationTaxIdToken: '{{organizationTaxId}}',
        goodsServicesStatement: 'No goods or services were provided in exchange for this contribution unless noted.',
        bgColor: '#ffffff',
        borderColor: '#d1d5db',
        textColor: '#111827',
        padding: 16,
      } satisfies DonationReceiptBlock;

    case 'givingSummary':
      return {
        id,
        type: 'givingSummary',
        yearToken: '{{currentYear}}',
        totalGivingToken: '{{totalYtdGiving}}',
        giftCountToken: '{{giftCount}}',
        firstGiftDateToken: '{{firstGiftDate}}',
        lastGiftDateToken: '{{lastGiftDate}}',
        campaignsSupportedToken: '{{campaignsSupported}}',
        bgColor: '#f0fdf4',
        textColor: '#14532d',
        accentColor: '#16a34a',
        padding: 16,
      } satisfies GivingSummaryBlock;

    case 'donationCta':
      return {
        id,
        type: 'donationCta',
        headline: 'Help More Families Thrive',
        appealText: 'Your gift today helps provide practical support, compassionate care, and long-term guidance.',
        buttonLabel: 'Give Now',
        buttonUrl: 'https://',
        suggestedAmounts: ['$25', '$50', '$100', '$250', 'Other'],
        bgColor: '#ecfdf3',
        textColor: '#14532d',
        buttonColor: '#16a34a',
        buttonTextColor: '#ffffff',
        padding: 16,
      } satisfies DonationCtaBlock;

    case 'monthlyDonorInvitation':
      return {
        id,
        type: 'monthlyDonorInvitation',
        headline: 'Become a Monthly Life Partner',
        message: 'Your monthly gift helps us serve families consistently all year long.',
        suggestedMonthlyAmounts: ['$15/mo', '$30/mo', '$50/mo'],
        benefitBullets: [
          'Provides consistent program support',
          'Helps plan services with confidence',
          'Creates sustained local impact',
        ],
        ctaLabel: 'Start Monthly Giving',
        ctaUrl: 'https://',
        buttonColor: '#16a34a',
        bgColor: '#f0f9ff',
        textColor: '#1e3a8a',
        padding: 16,
      } satisfies MonthlyDonorInvitationBlock;

    case 'lapsedDonorReengagement':
      return {
        id,
        type: 'lapsedDonorReengagement',
        greeting: 'We have missed you, {{preferredName}}.',
        lastGiftDateToken: '{{lastGiftDate}}',
        message: 'It has been a while since your last gift, and we wanted to share what your past support helped make possible.',
        impactReminder: 'Families are still receiving life-affirming care because of donors like you.',
        ctaLabel: 'Reconnect with a Gift',
        ctaUrl: 'https://',
        buttonColor: '#16a34a',
        bgColor: '#fff7ed',
        textColor: '#9a3412',
        padding: 16,
      } satisfies LapsedDonorReengagementBlock;

    case 'firstTimeDonorWelcome':
      return {
        id,
        type: 'firstTimeDonorWelcome',
        headline: 'Welcome to the Mission',
        missionIntro: 'We are grateful you chose to stand with us and support local families.',
        whatToExpect: 'You can expect thoughtful updates, impact stories, and clear ways to stay involved.',
        contactPerson: '{{staffName}}',
        ctaLabel: 'See Your Impact',
        ctaUrl: 'https://',
        buttonColor: '#16a34a',
        bgColor: '#eff6ff',
        textColor: '#1e3a8a',
        padding: 16,
      } satisfies FirstTimeDonorWelcomeBlock;

    case 'staffSignature':
      return {
        id,
        type: 'staffSignature',
        nameToken: '{{staffName}}',
        titleToken: '{{staffTitle}}',
        phoneToken: '{{organizationPhone}}',
        emailToken: '{{staffEmail}}',
        organizationToken: '{{organizationName}}',
        signatureImageUrl: '',
        headshotUrl: '',
        textColor: '#1f2937',
        padding: 16,
      } satisfies StaffSignatureBlock;

    case 'footerCompliance':
      return {
        id,
        type: 'footerCompliance',
        organizationNameToken: '{{organizationName}}',
        addressToken: '{{addressBlock}}',
        phoneToken: '{{organizationPhone}}',
        websiteToken: '{{organizationWebsite}}',
        unsubscribeToken: '{{unsubscribeUrl}}',
        managePreferencesToken: '{{managePreferencesUrl}}',
        taxIdToken: '{{organizationTaxId}}',
        bgColor: '#f9fafb',
        textColor: '#4b5563',
        padding: 16,
      } satisfies FooterComplianceBlock;

    case 'eventDetails':
      return {
        id,
        type: 'eventDetails',
        title: 'Join Us for an Upcoming Event',
        date: '{{eventDate}}',
        time: '{{eventTime}}',
        location: '{{eventLocation}}',
        description: 'Gather with the community, hear ministry updates, and learn how to stay involved.',
        ctaLabel: 'RSVP Today',
        ctaUrl: 'https://',
        bgColor: '#eff6ff',
        textColor: '#1e3a8a',
        accentColor: '#2563eb',
        padding: 16,
      } satisfies EventDetailsBlock;

    case 'partnerLogos':
      return {
        id,
        type: 'partnerLogos',
        title: 'With Thanks to Our Partners',
        logos: [
          { name: 'Community Partner', imageUrl: '' },
          { name: 'Local Sponsor', imageUrl: '' },
          { name: 'Mission Ally', imageUrl: '' },
        ],
        bgColor: '#ffffff',
        textColor: '#1f2937',
        borderColor: '#e5e7eb',
        padding: 16,
      } satisfies PartnerLogosBlock;

    case 'contactCard':
      return {
        id,
        type: 'contactCard',
        heading: 'Questions? Reply or contact us directly.',
        name: '{{staffName}}',
        role: '{{staffTitle}}',
        phone: '{{organizationPhone}}',
        email: '{{staffEmail}}',
        note: 'We would be glad to help with giving, event details, or prayer requests.',
        imageUrl: '',
        bgColor: '#f8fafc',
        textColor: '#1f2937',
        accentColor: '#2563eb',
        padding: 16,
      } satisfies ContactCardBlock;

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
        htmlEditingEnabled: false,
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
        title: 'Stay connected',
        intro: 'Follow along for field stories, campaign progress, and ministry updates.',
        links: [
          { platform: 'facebook',  url: 'https://facebook.com' },
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'linkedin',  url: 'https://linkedin.com' },
          { platform: 'tiktok',    url: 'https://tiktok.com/@yourorg' },
        ],
        variant: 'card',
        colorMode: 'brand',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        accentColor: '#2563ff',
        borderColor: '#e6e9f2',
        showLabels: true,
        align: 'center',
        padding: 20,
      } satisfies SocialBlock;

    case 'columns':
      return {
        id,
        type: 'columns',
        columnCount: 2,
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

    case 'customHtml':
      return {
        id,
        type: 'customHtml',
        html: '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;">Custom HTML block</td></tr></table>',
        padding: 16,
      } satisfies CustomHtmlBlock;
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
    case 'heading':
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};text-align:${block.align};color:${block.textColor};">
    ${block.eyebrow ? `<div style="font-size:12px;line-height:1.3;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">${block.eyebrow}</div>` : ''}
    <div style="font-size:30px;line-height:1.2;font-weight:700;margin-top:${block.eyebrow ? 6 : 0}px;">${block.title}</div>
    ${block.subtitle ? `<div style="font-size:15px;line-height:1.5;margin-top:8px;opacity:.92;">${block.subtitle}</div>` : ''}
  </td>
</tr>`;

    case 'text':
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};font-size:${block.fontSize}px;color:${block.color};text-align:${block.align};line-height:1.5;">
    ${formatRichTextHtml(block.content, {
      textColor: block.color,
      baseFontSizePx: block.fontSize,
      linkColor: block.color,
      fontFamily,
    })}
  </td>
</tr>`;

    case 'quote':
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};font-family:${fontFamily};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid ${block.accentColor ?? '#16a34a'};background:#f8fafc;">
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
          <div style="font-size:14px;line-height:1.4;margin-top:4px;font-weight:600;">${block.icon ? `${block.icon} ` : ''}${block.label}</div>
          ${block.timePeriod ? `<div style="font-size:11px;line-height:1.4;margin-top:3px;opacity:0.85;text-transform:uppercase;letter-spacing:.06em;">${block.timePeriod}</div>` : ""}
          ${block.sublabel ? `<div style="font-size:12px;line-height:1.4;margin-top:4px;opacity:0.9;">${block.sublabel}</div>` : ""}
        </td>
      </tr>
    </table>
  </td>
</tr>`;

    case 'impactStory':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;overflow:hidden;">
      ${block.imageUrl ? `<tr><td><img src="${block.imageUrl}" alt="Impact story" width="100%" style="display:block;width:100%;height:auto;border:0;" /></td></tr>` : ''}
      <tr>
        <td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
          <div style="font-size:20px;line-height:1.3;font-weight:700;">${block.headline}</div>
          ${block.pseudonym ? `<div style="font-size:11px;line-height:1.4;margin-top:6px;opacity:.8;">${block.pseudonym}</div>` : ''}
          <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.story}</div>
          <div style="font-size:14px;line-height:1.6;margin-top:10px;font-weight:600;">Outcome: ${block.outcome}</div>
          ${block.ctaLabel && block.ctaUrl ? `<div style="margin-top:14px;"><a href="${block.ctaUrl}" style="display:inline-block;background:${block.ctaColor ?? '#16a34a'};color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:6px;">${block.ctaLabel}</a></div>` : ''}
        </td>
      </tr>
    </table>
  </td>
</tr>`;

    case 'impactGrid': {
      const safeItems = Array.isArray(block.items) ? block.items : [];
      const cells = safeItems.slice(0, 4).map((item) => `
        <td style="width:${Math.round(100 / Math.max(safeItems.length, 1))}%;padding:12px 10px;text-align:center;border-right:1px solid ${block.accentColor}33;">
          <div style="font-family:${fontFamily};font-size:24px;font-weight:700;line-height:1.2;color:${block.textColor};">${item.value}</div>
          <div style="font-family:${fontFamily};font-size:12px;line-height:1.4;color:${block.textColor};opacity:.9;margin-top:4px;">${item.label}</div>
        </td>`).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.accentColor};border-radius:10px;">
      ${block.title ? `<tr><td colspan="4" style="padding:14px 14px 0;font-family:${fontFamily};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${block.textColor};">${block.title}</td></tr>` : ''}
      <tr>${cells}</tr>
    </table>
  </td>
</tr>`;
    }

    case 'statistics': {
      const safeItems = Array.isArray(block.items) ? block.items.slice(0, 6) : [];
      const columnCount = block.columnCount === 3 ? 3 : 2;
      const rows: string[] = [];
      for (let i = 0; i < safeItems.length; i += columnCount) {
        const rowItems = safeItems.slice(i, i + columnCount);
        const cells = rowItems.map((item) => `<td width="${Math.floor(100 / columnCount)}%" valign="top" style="padding:4px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.cardColor};border:1px solid ${block.accentColor}33;border-radius:8px;">
            <tr><td style="padding:12px 10px;font-family:${fontFamily};color:${block.textColor};">
              <div style="font-size:25px;line-height:1.1;font-weight:800;color:${block.accentColor};">${item.value}</div>
              <div style="font-size:13px;line-height:1.35;font-weight:700;margin-top:5px;">${item.label}</div>
              ${item.detail ? `<div style="font-size:12px;line-height:1.4;margin-top:4px;opacity:.78;">${item.detail}</div>` : ''}
            </td></tr>
          </table>
        </td>`).join('');
        const fillers = Array.from({ length: columnCount - rowItems.length }, () => `<td width="${Math.floor(100 / columnCount)}%" style="padding:4px;">&nbsp;</td>`).join('');
        rows.push(`<tr>${cells}${fillers}</tr>`);
      }
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.accentColor};border-radius:8px;">
      <tr><td style="padding:14px 14px 10px;font-family:${fontFamily};color:${block.textColor};">
        ${block.title ? `<div style="font-size:18px;line-height:1.3;font-weight:700;">${block.title}</div>` : ''}
        ${block.intro ? `<div style="font-size:13px;line-height:1.5;margin-top:${block.title ? 6 : 0}px;opacity:.86;">${block.intro}</div>` : ''}
      </td></tr>
      <tr><td style="padding:0 10px 10px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr>
    </table>
  </td>
</tr>`;
    }

    case 'progress': {
      const safeGoal = block.goal <= 0 ? 1 : block.goal;
      const pct = Math.max(0, Math.min(100, Math.round((block.current / safeGoal) * 100)));
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};color:${block.textColor};">
    <div style="font-size:13px;font-weight:700;line-height:1.4;margin-bottom:8px;">${block.label}</div>
    <div style="font-size:12px;line-height:1.4;margin-bottom:8px;">$${block.current.toLocaleString()} raised of $${block.goal.toLocaleString()} goal (${pct}%)</div>
    <div style="background:${block.trackColor};border-radius:999px;height:12px;overflow:hidden;">
      <div style="width:${pct}%;background:${block.barColor};height:12px;border-radius:999px;"></div>
    </div>
  </td>
</tr>`;
    }

    case 'timeline': {
      const rows = (Array.isArray(block.items) ? block.items : []).slice(0, 6).map((item) => `<tr>
        <td style="width:18px;vertical-align:top;padding:2px 10px 12px 0;">
          <div style="width:10px;height:10px;border-radius:999px;background:${block.accentColor};margin-top:4px;"></div>
        </td>
        <td style="font-family:${fontFamily};padding:0 0 12px;color:${block.textColor};">
          <div style="font-size:14px;line-height:1.4;font-weight:700;">${item.title}</div>
          ${item.detail ? `<div style="font-size:13px;line-height:1.5;opacity:.92;margin-top:2px;">${item.detail}</div>` : ''}
        </td>
      </tr>`).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    ${block.title ? `<div style="font-family:${fontFamily};font-size:16px;font-weight:700;line-height:1.4;color:${block.textColor};margin-bottom:10px;">${block.title}</div>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </td>
</tr>`;
    }

    case 'callout':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-left:4px solid ${block.borderColor};border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontFamily};color:${block.textColor};">
          <div style="font-size:16px;line-height:1.4;font-weight:700;">${block.title}</div>
          <div style="font-size:14px;line-height:1.6;margin-top:6px;">${block.body}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

    case 'featureList': {
      const items = (Array.isArray(block.items) ? block.items : []).slice(0, 8).map((item) => `<tr>
        <td style="font-family:${fontFamily};font-size:14px;line-height:1.5;color:${block.textColor};padding:0 0 8px;">
          <span style="color:${block.bulletColor};font-weight:700;">•</span> ${item}
        </td>
      </tr>`).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    ${block.dollarFraming ? `<div style="font-family:${fontFamily};font-size:12px;line-height:1.4;color:${block.textColor};opacity:.85;margin-bottom:8px;">${block.dollarFraming}</div>` : ''}
    ${block.title ? `<div style="font-family:${fontFamily};font-size:16px;line-height:1.4;font-weight:700;color:${block.textColor};margin-bottom:8px;">${block.title}</div>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
  </td>
</tr>`;
    }

    case 'donorThankYou':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:22px;line-height:1.3;font-weight:700;">${block.headline}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">Thank you for your gift of <strong>${block.giftAmountToken}</strong> on <strong>${block.giftDateToken}</strong>.</div>
        <div style="font-size:14px;line-height:1.6;margin-top:6px;">Campaign/Fund: ${block.campaignToken}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.thankYouMessage}</div>
        <div style="font-size:13px;line-height:1.5;margin-top:12px;">With gratitude,<br/>${block.staffSignature}</div>
      </td></tr>
    </table>
  </td>
</tr>`;

    case 'donationReceipt':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${block.borderColor};border-radius:10px;background:${block.bgColor};font-family:${fontFamily};color:${block.textColor};">
      <tr><td style="padding:14px 16px;border-bottom:1px solid ${block.borderColor};font-size:14px;font-weight:700;">Donation Receipt Summary</td></tr>
      <tr><td style="padding:14px 16px;font-size:13px;line-height:1.65;">
        <div><strong>Donor:</strong> ${block.donorNameToken}</div>
        <div><strong>Gift Amount:</strong> ${block.giftAmountToken}</div>
        <div><strong>Gift Date:</strong> ${block.giftDateToken}</div>
        <div><strong>Receipt #:</strong> ${block.receiptNumberToken}</div>
        <div><strong>Tax-Deductible:</strong> ${block.taxDeductibleToken}</div>
        <div><strong>Designation:</strong> ${block.designationToken}</div>
        <div><strong>Tax ID:</strong> ${block.organizationTaxIdToken}</div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed ${block.borderColor};font-size:12px;">${block.goodsServicesStatement}</div>
      </td></tr>
    </table>
  </td>
</tr>`;

    case 'givingSummary':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.accentColor};border-radius:10px;">
      <tr><td style="padding:14px 16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:18px;font-weight:700;line-height:1.3;">Your ${block.yearToken} Giving Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:13px;line-height:1.5;">
          <div><strong>Total Giving:</strong> ${block.totalGivingToken}</div>
          <div><strong>Number of Gifts:</strong> ${block.giftCountToken}</div>
          <div><strong>First Gift:</strong> ${block.firstGiftDateToken}</div>
          <div><strong>Last Gift:</strong> ${block.lastGiftDateToken}</div>
        </div>
        <div style="font-size:12px;line-height:1.5;margin-top:8px;opacity:.9;">Campaigns supported: ${block.campaignsSupportedToken}</div>
      </td></tr>
    </table>
  </td>
</tr>`;

    case 'donationCta': {
      const amountButtons = block.suggestedAmounts.slice(0, 6).map((amount) =>
        `<a href="${block.buttonUrl}" style="display:inline-block;margin:4px 4px 0 0;border:1px solid ${block.buttonColor};color:${block.buttonColor};text-decoration:none;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;">${amount}</a>`
      ).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};text-align:center;">
        <div style="font-size:20px;font-weight:700;line-height:1.3;">${block.headline}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.appealText}</div>
        <div style="margin-top:10px;">${amountButtons}</div>
        <div style="margin-top:14px;"><a href="${block.buttonUrl}" style="display:inline-block;background:${block.buttonColor};color:${block.buttonTextColor};text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:700;">${block.buttonLabel}</a></div>
      </td></tr>
    </table>
  </td>
</tr>`;
    }

    case 'monthlyDonorInvitation': {
      const monthlyAmounts = block.suggestedMonthlyAmounts.slice(0, 6).map((amount) => `<span style="display:inline-block;margin:0 5px 5px 0;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #bfdbfe;font-size:12px;font-weight:700;">${amount}</span>`).join('');
      const benefits = block.benefitBullets.slice(0, 6).map((line) => `<div style="font-size:13px;line-height:1.5;margin-top:4px;">• ${line}</div>`).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:20px;font-weight:700;line-height:1.3;">${block.headline}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.message}</div>
        <div style="margin-top:10px;">${monthlyAmounts}</div>
        <div style="margin-top:8px;">${benefits}</div>
        <div style="margin-top:14px;"><a href="${block.ctaUrl}" style="display:inline-block;background:${block.buttonColor ?? '#16a34a'};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:700;">${block.ctaLabel}</a></div>
      </td></tr>
    </table>
  </td>
</tr>`;
    }

    case 'lapsedDonorReengagement':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:18px;font-weight:700;line-height:1.3;">${block.greeting}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">It has been a while since your last gift on ${block.lastGiftDateToken}.</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.message}</div>
        <div style="font-size:13px;line-height:1.5;margin-top:8px;font-weight:600;">${block.impactReminder}</div>
        <div style="margin-top:12px;"><a href="${block.ctaUrl}" style="display:inline-block;background:${block.buttonColor ?? '#16a34a'};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:700;">${block.ctaLabel}</a></div>
      </td></tr>
    </table>
  </td>
</tr>`;

    case 'firstTimeDonorWelcome':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border-radius:10px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:20px;font-weight:700;line-height:1.3;">${block.headline}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.missionIntro}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:8px;">${block.whatToExpect}</div>
        <div style="font-size:13px;line-height:1.5;margin-top:10px;">Your contact person: ${block.contactPerson}</div>
        <div style="margin-top:12px;"><a href="${block.ctaUrl}" style="display:inline-block;background:${block.buttonColor ?? '#16a34a'};color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:700;">${block.ctaLabel}</a></div>
      </td></tr>
    </table>
  </td>
</tr>`;

    case 'staffSignature':
      return `<tr>
  <td style="padding:${block.padding}px;font-family:${fontFamily};color:${block.textColor};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${block.headshotUrl ? `<td style="width:72px;vertical-align:top;padding-right:12px;"><img src="${block.headshotUrl}" alt="Staff photo" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:999px;object-fit:cover;" /></td>` : ''}
        <td style="vertical-align:top;">
          ${block.signatureImageUrl ? `<div style="margin-bottom:6px;"><img src="${block.signatureImageUrl}" alt="Signature" style="max-width:180px;height:auto;display:block;" /></div>` : ''}
          <div style="font-size:14px;font-weight:700;line-height:1.4;">${block.nameToken}</div>
          <div style="font-size:13px;line-height:1.5;">${block.titleToken}</div>
          <div style="font-size:12px;line-height:1.5;margin-top:4px;">${block.phoneToken} • ${block.emailToken}</div>
          <div style="font-size:12px;line-height:1.5;">${block.organizationToken}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

    case 'footerCompliance':
      return `<tr>
  <td style="padding:${block.padding}px;background:${block.bgColor};font-family:${fontFamily};color:${block.textColor};font-size:11px;line-height:1.6;text-align:center;">
    <div style="font-weight:700;">${block.organizationNameToken}</div>
    <div>${block.addressToken}</div>
    <div>${block.phoneToken} • <a href="${block.websiteToken}" style="color:${block.textColor};text-decoration:underline;">${block.websiteToken}</a></div>
    ${block.taxIdToken ? `<div>Tax ID: ${block.taxIdToken}</div>` : ''}
    <div style="margin-top:6px;"><a href="${block.unsubscribeToken}" style="color:${block.textColor};text-decoration:underline;">Unsubscribe</a> · <a href="${block.managePreferencesToken}" style="color:${block.textColor};text-decoration:underline;">Manage Preferences</a></div>
  </td>
</tr>`;

    case 'eventDetails': {
      const detailRows = [
        ['Date', block.date],
        ['Time', block.time],
        ['Location', block.location],
      ].map(([label, value]) => `<tr>
        <td width="86" style="padding:8px 10px 8px 0;border-top:1px solid ${block.accentColor}26;font-family:${fontFamily};font-size:12px;line-height:1.4;font-weight:700;color:${block.accentColor};text-transform:uppercase;">${label}</td>
        <td style="padding:8px 0;border-top:1px solid ${block.accentColor}26;font-family:${fontFamily};font-size:14px;line-height:1.45;color:${block.textColor};">${value}</td>
      </tr>`).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.accentColor};border-radius:8px;">
      <tr><td style="padding:16px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:20px;line-height:1.3;font-weight:700;">${block.title}</div>
        ${block.description ? `<div style="font-size:14px;line-height:1.55;margin-top:7px;">${block.description}</div>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">${detailRows}</table>
        ${block.ctaLabel && block.ctaUrl ? `<div style="margin-top:12px;"><a href="${block.ctaUrl}" style="display:inline-block;background:${block.accentColor};color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 16px;border-radius:6px;">${block.ctaLabel}</a></div>` : ''}
      </td></tr>
    </table>
  </td>
</tr>`;
    }

    case 'partnerLogos': {
      const logos = (Array.isArray(block.logos) ? block.logos : []).slice(0, 6);
      const rows: string[] = [];
      for (let i = 0; i < logos.length; i += 3) {
        const rowLogos = logos.slice(i, i + 3);
        const cells = rowLogos.map((logo) => {
          const image = logo.imageUrl
            ? `<img src="${logo.imageUrl}" alt="${logo.name}" style="display:block;max-width:100%;max-height:44px;height:auto;border:0;margin:0 auto;" />`
            : `<span style="font-family:${fontFamily};font-size:12px;font-weight:700;color:${block.textColor};">${logo.name}</span>`;
          const inner = logo.linkUrl ? `<a href="${logo.linkUrl}" style="text-decoration:none;">${image}</a>` : image;
          return `<td width="33%" style="padding:4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid ${block.borderColor};border-radius:7px;">
              <tr><td align="center" valign="middle" style="height:70px;padding:10px;text-align:center;">${inner}</td></tr>
            </table>
          </td>`;
        }).join('');
        const fillers = Array.from({ length: 3 - rowLogos.length }, () => '<td width="33%" style="padding:4px;">&nbsp;</td>').join('');
        rows.push(`<tr>${cells}${fillers}</tr>`);
      }
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.borderColor};border-radius:8px;">
      <tr><td style="padding:14px;font-family:${fontFamily};color:${block.textColor};">
        ${block.title ? `<div style="font-size:14px;line-height:1.4;font-weight:700;margin-bottom:8px;">${block.title}</div>` : ''}
        ${logos.length > 0 ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>` : '<div style="font-size:13px;line-height:1.5;opacity:.75;">Add partner logo URLs in the editor.</div>'}
      </td></tr>
    </table>
  </td>
</tr>`;
    }

    case 'contactCard':
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${block.bgColor};border:1px solid ${block.accentColor};border-radius:8px;">
      <tr><td style="padding:14px;font-family:${fontFamily};color:${block.textColor};">
        <div style="font-size:15px;line-height:1.4;font-weight:700;margin-bottom:10px;">${block.heading}</div>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="68" valign="top" style="padding-right:12px;">
              ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.name}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:28px;object-fit:cover;border:0;" />` : `<div style="width:56px;height:56px;line-height:56px;border-radius:28px;background:${block.accentColor};color:#fff;text-align:center;font-size:18px;font-weight:800;">${block.name.trim().slice(0, 1) || 'O'}</div>`}
            </td>
            <td valign="top">
              <div style="font-size:16px;line-height:1.35;font-weight:700;">${block.name}</div>
              ${block.role ? `<div style="font-size:13px;line-height:1.4;margin-top:2px;">${block.role}</div>` : ''}
              ${block.phone ? `<div style="font-size:12px;line-height:1.4;margin-top:5px;">${block.phone}</div>` : ''}
              ${block.email ? `<div style="font-size:12px;line-height:1.4;margin-top:2px;"><a href="mailto:${block.email}" style="color:${block.accentColor};text-decoration:underline;">${block.email}</a></div>` : ''}
            </td>
          </tr>
        </table>
        ${block.note ? `<div style="font-size:13px;line-height:1.5;margin-top:10px;">${block.note}</div>` : ''}
      </td></tr>
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
    ${formatRichTextHtml(block.content, {
      textColor: '#1f2937',
      baseFontSizePx: 16,
      linkColor: '#166534',
      fontFamily,
    })}
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
      const escapeText = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const platformLabels: Record<string, string> = {
        facebook: 'Facebook', twitter: 'Twitter', instagram: 'Instagram',
        linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok',
      };
      const platformBadges: Record<string, string> = {
        facebook: 'f', twitter: 'X', instagram: 'IG',
        linkedin: 'in', youtube: 'YT', tiktok: 'TT',
      };
      const platformColors: Record<string, string> = {
        facebook: '#1877f2', twitter: '#1da1f2', instagram: '#e1306c',
        linkedin: '#0a66c2', youtube: '#ff0000', tiktok: '#111111',
      };
      const variant = block.variant ?? 'card';
      const colorMode = block.colorMode ?? 'brand';
      const showLabels = block.showLabels !== false;
      const title = block.title?.trim();
      const intro = block.intro?.trim();
      const textColor = block.textColor ?? '#0f172a';
      const borderColor = block.borderColor ?? '#e6e9f2';
      const backgroundColor = block.backgroundColor ?? '#ffffff';
      const accentColor = block.accentColor ?? '#2563ff';
      const links = (Array.isArray(block.links) ? block.links : []).map(
        (l) => {
          const brandColor = platformColors[l.platform] ?? accentColor;
          const badgeColor = colorMode === 'brand' ? brandColor : colorMode === 'accent' ? accentColor : textColor;
          const pillBackground = colorMode === 'neutral' ? backgroundColor : badgeColor;
          const pillText = colorMode === 'neutral' ? textColor : '#ffffff';

          if (variant === 'minimal') {
            return `<a href="${l.url}" style="display:inline-block;margin:0 6px 8px 0;color:${textColor};font-family:${fontFamily};font-size:13px;text-decoration:none;">
  <span style="display:inline-block;min-width:34px;height:34px;line-height:34px;border-radius:17px;background:${badgeColor};color:#ffffff;font-weight:700;text-align:center;vertical-align:middle;">${platformBadges[l.platform] ?? '?'}</span>
  ${showLabels ? `<span style="display:inline-block;margin-left:8px;vertical-align:middle;">${escapeText(platformLabels[l.platform] ?? l.platform)}</span>` : ''}
</a>`;
          }

          if (variant === 'pill') {
            return `<a href="${l.url}" style="display:inline-block;margin:0 6px 8px 0;background:${pillBackground};color:${pillText};font-family:${fontFamily};font-size:13px;font-weight:600;text-decoration:none;padding:10px 14px;border-radius:999px;border:${colorMode === 'neutral' ? `1px solid ${borderColor}` : 'none'};">
  <span style="display:inline-block;min-width:22px;height:22px;line-height:22px;border-radius:11px;background:${colorMode === 'neutral' ? badgeColor : 'rgba(255,255,255,0.18)'};color:${colorMode === 'neutral' ? '#ffffff' : pillText};font-size:11px;font-weight:700;text-align:center;vertical-align:middle;">${platformBadges[l.platform] ?? '?'}</span>
  ${showLabels ? `<span style="display:inline-block;margin-left:8px;vertical-align:middle;">${escapeText(platformLabels[l.platform] ?? l.platform)}</span>` : ''}
</a>`;
          }

          return `<a href="${l.url}" style="display:inline-block;vertical-align:top;width:170px;margin:0 8px 10px 0;background:${backgroundColor};color:${textColor};font-family:${fontFamily};text-decoration:none;padding:12px 14px;border-radius:12px;border:1px solid ${borderColor};box-shadow:0 8px 20px rgba(15,23,42,0.06);">
  <span style="display:inline-block;min-width:32px;height:32px;line-height:32px;border-radius:10px;background:${badgeColor};color:#ffffff;font-size:12px;font-weight:700;text-align:center;vertical-align:middle;">${platformBadges[l.platform] ?? '?'}</span>
  <span style="display:inline-block;vertical-align:middle;margin-left:10px;">
    ${showLabels ? `<span style="display:block;font-size:13px;font-weight:700;color:${textColor};">${escapeText(platformLabels[l.platform] ?? l.platform)}</span>` : ''}
    <span style="display:block;font-size:11px;color:#64748b;">Follow for updates</span>
  </span>
</a>`;
        }
      ).join('');
      const headingHtml = title
        ? `<div style="font-family:${fontFamily};font-size:20px;line-height:28px;font-weight:700;color:${textColor};margin-bottom:${intro ? 6 : 12}px;">${escapeText(title)}</div>`
        : '';
      const introHtml = intro
        ? `<div style="font-family:${fontFamily};font-size:13px;line-height:20px;color:${textColor};opacity:0.82;margin-bottom:14px;">${escapeText(intro)}</div>`
        : '';
      return `<tr>
  <td style="padding:${block.padding}px;text-align:${block.align};">
    ${headingHtml}
    ${introHtml}
    ${links || `<span style="font-family:${fontFamily};font-size:13px;color:#94a3b8;">No social links added</span>`}
  </td>
</tr>`;
    }

    case 'columns': {
      const safeColumns = Array.isArray(block.columns) ? block.columns : [];
      const requestedCount = block.columnCount ?? safeColumns.length;
      const totalColumns = requestedCount >= 3 ? 3 : 2;
      const cols = Array.from({ length: totalColumns }, (_, index) => {
        const content = safeColumns[index]?.map((child) => renderBlockHtml(child, fontFamily)).join('') ?? '';
        const width = Math.floor(100 / totalColumns);
        return `<td width="${width}%" valign="top" style="vertical-align:top;${index === 0 ? '' : 'padding-left:8px;'}">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${content}
          </table>
        </td>`;
      }).join('');
      return `<tr>
  <td style="padding:${block.padding}px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${cols}
      </tr>
    </table>
  </td>
</tr>`;
    }

    case 'customHtml':
      return `<tr>
  <td style="padding:${block.padding}px;">
    ${block.html}
  </td>
</tr>`;
  }
}

/** Ensures generated output always contains a valid footer compliance block with unsubscribe/manage-preferences tokens. */
function ensureComplianceFooterBlock(template: EmailTemplate): EmailTemplate {
  const normalizedBlocks = template.blocks.map((block) => {
    if (block.type !== 'footerCompliance') return block;
    return {
      ...block,
      unsubscribeToken: block.unsubscribeToken.trim() || '{{unsubscribeUrl}}',
      managePreferencesToken: block.managePreferencesToken.trim() || '{{managePreferencesUrl}}',
    };
  });

  const hasFooterCompliance = normalizedBlocks.some((block) => block.type === 'footerCompliance');
  if (hasFooterCompliance) {
    return { ...template, blocks: normalizedBlocks };
  }

  return {
    ...template,
    blocks: [...normalizedBlocks, createDefaultBlock('footerCompliance')],
  };
}

/**
 * Generates a complete, table-based HTML email from an EmailTemplate.
 * Includes MSO (Outlook) conditional comments for best compatibility.
 */
export function generateEmailHtml(template: EmailTemplate): string {
  const normalizedTemplate = ensureComplianceFooterBlock(template);
  const { blocks, backgroundColor, contentWidth, fontFamily } = normalizedTemplate;
  const blockRows = blocks.map((b) => renderBlockHtml(b, fontFamily)).join('\n');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
  <!--[if mso]>
  <style type="text/css">body,table,td,a{font-family:${fontFamily}!important;}</style>
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
  const normalizedTemplate = ensureComplianceFooterBlock(template);
  return normalizedTemplate.blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `${block.eyebrow ? `${block.eyebrow}\n` : ''}${block.title}${block.subtitle ? `\n${block.subtitle}` : ''}`;
        case 'text':    return stripHtml(block.content);
        case 'quote':   return `"${block.quote}"${block.attribution ? ` - ${block.attribution}` : ''}`;
        case 'impactStat': return `${block.value} - ${block.label}${block.sublabel ? ` - ${block.sublabel}` : ''}`;
        case 'statistics': return [block.title, block.intro, ...block.items.map((i) => `${i.value} - ${i.label}${i.detail ? ` - ${i.detail}` : ''}`)].filter(Boolean).join(' | ');
        case 'impactStory': return `${block.headline} - ${block.story} - Outcome: ${block.outcome}`;
        case 'impactGrid': return [block.title, ...block.items.map((i) => `${i.value} - ${i.label}`)].filter(Boolean).join(' | ');
        case 'progress': {
          const safeGoal = block.goal <= 0 ? 1 : block.goal;
          const pct = Math.max(0, Math.min(100, Math.round((block.current / safeGoal) * 100)));
          return `${block.label}: ${block.current}/${block.goal} (${pct}%)`;
        }
        case 'timeline': return [block.title, ...block.items.map((i) => `${i.title}${i.detail ? ` - ${i.detail}` : ''}`)].filter(Boolean).join(' | ');
        case 'callout': return `${block.title} - ${block.body}`;
        case 'featureList': return [block.title, ...block.items].filter(Boolean).join(' | ');
        case 'donorThankYou': return `${block.headline} - ${block.giftAmountToken} - ${block.giftDateToken} - ${block.thankYouMessage}`;
        case 'donationReceipt': return `Donation Receipt: ${block.donorNameToken} | ${block.giftAmountToken} | ${block.giftDateToken} | Receipt ${block.receiptNumberToken}`;
        case 'givingSummary': return `Giving Summary ${block.yearToken}: ${block.totalGivingToken}, ${block.giftCountToken} gifts`;
        case 'donationCta': return [block.headline, block.appealText, ...block.suggestedAmounts, `[${block.buttonLabel}] → ${block.buttonUrl}`].join(' | ');
        case 'monthlyDonorInvitation': return [block.headline, block.message, ...block.suggestedMonthlyAmounts, ...block.benefitBullets, `[${block.ctaLabel}] → ${block.ctaUrl}`].join(' | ');
        case 'lapsedDonorReengagement': return [block.greeting, block.lastGiftDateToken, block.message, block.impactReminder, `[${block.ctaLabel}] → ${block.ctaUrl}`].join(' | ');
        case 'firstTimeDonorWelcome': return [block.headline, block.missionIntro, block.whatToExpect, block.contactPerson, `[${block.ctaLabel}] → ${block.ctaUrl}`].join(' | ');
        case 'staffSignature': return `${block.nameToken} | ${block.titleToken} | ${block.phoneToken} | ${block.emailToken}`;
        case 'footerCompliance': return `${block.organizationNameToken} | ${block.addressToken} | Unsubscribe: ${block.unsubscribeToken}`;
        case 'eventDetails': return [block.title, block.description, `Date: ${block.date}`, `Time: ${block.time}`, `Location: ${block.location}`, block.ctaLabel && block.ctaUrl ? `[${block.ctaLabel}] -> ${block.ctaUrl}` : ''].filter(Boolean).join(' | ');
        case 'partnerLogos': return [block.title, ...block.logos.map((logo) => logo.name)].filter(Boolean).join(' | ');
        case 'contactCard': return [block.heading, block.name, block.role, block.phone, block.email, block.note].filter(Boolean).join(' | ');
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
            .map((col: EmailBlock[]) => col.map((b: EmailBlock) => {
              if (b.type === 'text' || b.type === 'aiText') return stripHtml(b.content ?? '');
              if (b.type === 'heading') return `${b.eyebrow ? `${b.eyebrow}\n` : ''}${b.title}${b.subtitle ? `\n${b.subtitle}` : ''}`;
              if (b.type === 'button' || b.type === 'aiButton') return `[${b.label}] → ${b.href}`;
              return '';
            }).filter(Boolean).join('\n'))
            .join('\n\n');
        case 'customHtml':
          return stripHtml(block.html);
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
        createDefaultBlock('footerCompliance'),
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
        createDefaultBlock('footerCompliance'),
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
      createDefaultBlock('footerCompliance'),
    ],
  };
}

/** Returns a fresh EmailTemplate with one blank TextBlock. */
export function createDefaultTemplate(): EmailTemplate {
  return {
    backgroundColor: '#f5f5f5',
    contentWidth: 600,
    fontFamily: 'Arial, Helvetica, sans-serif',
    blocks: [createDefaultBlock('text'), createDefaultBlock('footerCompliance')],
  };
}
