/**
 * Email Builder Types
 *
 * Defines all block types, the email template structure, and
 * discriminated-union helpers used throughout the email builder.
 */

// ─── Block Type Discriminant ──────────────────────────────────────────────────

export type BlockType =
  | 'heading'
  | 'text'
  | 'quote'
  | 'impactStat'
  | 'impactStory'
  | 'impactGrid'
  | 'progress'
  | 'timeline'
  | 'callout'
  | 'featureList'
  | 'donorThankYou'
  | 'donationReceipt'
  | 'givingSummary'
  | 'donationCta'
  | 'monthlyDonorInvitation'
  | 'lapsedDonorReengagement'
  | 'firstTimeDonorWelcome'
  | 'staffSignature'
  | 'footerCompliance'
  | 'image'
  | 'video'
  | 'button'
  | 'aiText'
  | 'aiButton'
  | 'divider'
  | 'spacer'
  | 'social'
  | 'columns';

// ─── Base ─────────────────────────────────────────────────────────────────────

export interface BaseBlock {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Discriminant — must match the concrete type. */
  type: BlockType;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export interface TextBlock extends BaseBlock {
  type: 'text';
  /** HTML content (supports inline styles). */
  content: string;
  /** Whether raw HTML editing is enabled for this specific block. */
  htmlEditingEnabled?: boolean;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  padding: number;
}

// ─── Heading ─────────────────────────────────────────────────────────────────

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align: 'left' | 'center' | 'right';
  textColor: string;
  padding: number;
}

// ─── Quote ────────────────────────────────────────────────────────────────────

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  quote: string;
  attribution: string;
  align: 'left' | 'center' | 'right';
  /** Brand accent color for the quote rule. */
  accentColor?: string;
  padding: number;
}

// ─── Impact Stat ──────────────────────────────────────────────────────────────

export interface ImpactStatBlock extends BaseBlock {
  type: 'impactStat';
  value: string;
  label: string;
  timePeriod?: string;
  icon?: string;
  sublabel?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface ImpactStoryBlock extends BaseBlock {
  type: 'impactStory';
  headline: string;
  story: string;
  pseudonym?: string;
  imageUrl?: string;
  outcome: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Brand-derived color for the optional story CTA. */
  ctaColor?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface ImpactGridItem {
  value: string;
  label: string;
}

export interface ImpactGridBlock extends BaseBlock {
  type: 'impactGrid';
  title?: string;
  items: ImpactGridItem[];
  bgColor: string;
  textColor: string;
  accentColor: string;
  padding: number;
}

export interface ProgressBlock extends BaseBlock {
  type: 'progress';
  label: string;
  current: number;
  goal: number;
  barColor: string;
  trackColor: string;
  textColor: string;
  padding: number;
}

export interface TimelineItem {
  title: string;
  detail?: string;
}

export interface TimelineBlock extends BaseBlock {
  type: 'timeline';
  title?: string;
  items: TimelineItem[];
  accentColor: string;
  textColor: string;
  padding: number;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  title: string;
  body: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  padding: number;
}

export interface FeatureListBlock extends BaseBlock {
  type: 'featureList';
  title?: string;
  items: string[];
  dollarFraming?: string;
  bulletColor: string;
  textColor: string;
  padding: number;
}

export interface DonorThankYouBlock extends BaseBlock {
  type: 'donorThankYou';
  headline: string;
  thankYouMessage: string;
  giftAmountToken: string;
  giftDateToken: string;
  campaignToken: string;
  staffSignature: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface DonationReceiptBlock extends BaseBlock {
  type: 'donationReceipt';
  donorNameToken: string;
  giftAmountToken: string;
  giftDateToken: string;
  receiptNumberToken: string;
  taxDeductibleToken: string;
  designationToken: string;
  organizationTaxIdToken: string;
  goodsServicesStatement: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  padding: number;
}

export interface GivingSummaryBlock extends BaseBlock {
  type: 'givingSummary';
  yearToken: string;
  totalGivingToken: string;
  giftCountToken: string;
  firstGiftDateToken: string;
  lastGiftDateToken: string;
  campaignsSupportedToken: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  padding: number;
}

export interface DonationCtaBlock extends BaseBlock {
  type: 'donationCta';
  headline: string;
  appealText: string;
  buttonLabel: string;
  buttonUrl: string;
  suggestedAmounts: string[];
  bgColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  padding: number;
}

export interface MonthlyDonorInvitationBlock extends BaseBlock {
  type: 'monthlyDonorInvitation';
  headline: string;
  message: string;
  suggestedMonthlyAmounts: string[];
  benefitBullets: string[];
  ctaLabel: string;
  ctaUrl: string;
  buttonColor?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface LapsedDonorReengagementBlock extends BaseBlock {
  type: 'lapsedDonorReengagement';
  greeting: string;
  lastGiftDateToken: string;
  message: string;
  impactReminder: string;
  ctaLabel: string;
  ctaUrl: string;
  buttonColor?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface FirstTimeDonorWelcomeBlock extends BaseBlock {
  type: 'firstTimeDonorWelcome';
  headline: string;
  missionIntro: string;
  whatToExpect: string;
  contactPerson: string;
  ctaLabel: string;
  ctaUrl: string;
  buttonColor?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

export interface StaffSignatureBlock extends BaseBlock {
  type: 'staffSignature';
  nameToken: string;
  titleToken: string;
  phoneToken: string;
  emailToken: string;
  organizationToken: string;
  signatureImageUrl?: string;
  headshotUrl?: string;
  textColor: string;
  padding: number;
}

export interface FooterComplianceBlock extends BaseBlock {
  type: 'footerCompliance';
  organizationNameToken: string;
  addressToken: string;
  phoneToken: string;
  websiteToken: string;
  unsubscribeToken: string;
  managePreferencesToken: string;
  taxIdToken?: string;
  bgColor: string;
  textColor: string;
  padding: number;
}

// ─── Image ────────────────────────────────────────────────────────────────────

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt: string;
  /** Width as a percentage (1-100). */
  width: number;
  align: 'left' | 'center' | 'right';
  /** Optional click-through URL. */
  link?: string;
  padding: number;
}

// ─── Video ────────────────────────────────────────────────────────────────────

export interface VideoBlock extends BaseBlock {
  type: 'video';
  /** Original URL (YouTube / Vimeo / OneDrive / generic). */
  url: string;
  embedType: 'youtube' | 'vimeo' | 'onedrive' | 'generic';
  /** Auto-derived thumbnail URL (set by util helpers). */
  thumbnailUrl?: string;
  caption?: string;
  padding: number;
}

// ─── Button ───────────────────────────────────────────────────────────────────

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  label: string;
  href: string;
  bgColor: string;
  textColor: string;
  align: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
}

// ─── AI Text ──────────────────────────────────────────────────────────────────

export interface AiTextBlock extends BaseBlock {
  type: 'aiText';
  /** Prompt used to generate or regenerate this section. */
  prompt: string;
  /** Generated HTML content rendered like a regular text block. */
  content: string;
  /** Whether raw HTML editing is enabled for this specific block. */
  htmlEditingEnabled?: boolean;
  tone: 'warm' | 'urgent' | 'celebratory' | 'informative';
  padding: number;
}

// ─── AI Button ────────────────────────────────────────────────────────────────

export interface AiButtonBlock extends BaseBlock {
  type: 'aiButton';
  /** Prompt used to generate CTA copy and destination guidance. */
  prompt: string;
  label: string;
  href: string;
  bgColor: string;
  textColor: string;
  align: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export interface DividerBlock extends BaseBlock {
  type: 'divider';
  color: string;
  thickness: number;
  padding: number;
}

// ─── Spacer ───────────────────────────────────────────────────────────────────

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  /** Height in pixels. */
  height: number;
}

// ─── Social ───────────────────────────────────────────────────────────────────

export type SocialPlatform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'youtube';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface SocialBlock extends BaseBlock {
  type: 'social';
  links: SocialLink[];
  align: 'left' | 'center' | 'right';
  padding: number;
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  /** Two columns; each column is an array of EmailBlocks. */
  columns: EmailBlock[][];
  padding: number;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type EmailBlock =
  | HeadingBlock
  | TextBlock
  | QuoteBlock
  | ImpactStatBlock
  | ImpactStoryBlock
  | ImpactGridBlock
  | ProgressBlock
  | TimelineBlock
  | CalloutBlock
  | FeatureListBlock
  | DonorThankYouBlock
  | DonationReceiptBlock
  | GivingSummaryBlock
  | DonationCtaBlock
  | MonthlyDonorInvitationBlock
  | LapsedDonorReengagementBlock
  | FirstTimeDonorWelcomeBlock
  | StaffSignatureBlock
  | FooterComplianceBlock
  | ImageBlock
  | VideoBlock
  | ButtonBlock
  | AiTextBlock
  | AiButtonBlock
  | DividerBlock
  | SpacerBlock
  | SocialBlock
  | ColumnsBlock;

// ─── Template ─────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  blocks: EmailBlock[];
  backgroundColor: string;
  /** Max-width of the email content area in pixels. */
  contentWidth: number;
  fontFamily: string;
}

// ─── Palette meta (used by BlockPalette to render draggable cards) ─────────────

export interface PaletteItem {
  blockType: BlockType;
  label: string;
  description: string;
  /** Emoji or character used as the icon. */
  icon: string;
  section:
    | 'Basic'
    | 'Impact'
    | 'Donation & Giving'
    | 'Stewardship'
    | 'Stories'
    | 'Campaigns'
    | 'Events'
    | 'Ministry / Mission'
    | 'Personalization'
    | 'Layout'
    | 'Compliance'
    | 'Media'
    | 'AI';
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Basic
  { blockType: 'heading', label: 'Heading', description: 'Section heading and intro text', icon: 'H', section: 'Basic' },
  { blockType: 'text', label: 'Text', description: 'Rich text content area', icon: 'T', section: 'Basic' },
  { blockType: 'image', label: 'Image', description: 'Upload or link an image', icon: 'I', section: 'Basic' },
  { blockType: 'button', label: 'Button', description: 'Call-to-action button', icon: '>', section: 'Basic' },
  { blockType: 'quote', label: 'Quote', description: 'Donor quote or testimonial', icon: '"', section: 'Basic' },
  { blockType: 'callout', label: 'Callout', description: 'Highlighted content panel', icon: '!', section: 'Basic' },

  // Impact and stories
  { blockType: 'impactStat', label: 'Impact Stat', description: 'Large ministry metric card', icon: '#', section: 'Impact' },
  { blockType: 'impactGrid', label: 'Impact Grid', description: 'Multi-stat donor update grid', icon: 'G', section: 'Impact' },
  { blockType: 'impactStory', label: 'Impact Story', description: 'Story + outcome with privacy-safe reminder', icon: 'S', section: 'Stories' },
  { blockType: 'timeline', label: 'Impact Timeline', description: 'Milestones and outcomes', icon: 'M', section: 'Impact' },
  { blockType: 'featureList', label: 'What Your Support Funds', description: 'Donor-focused funding bullet list', icon: '•', section: 'Impact' },

  // Donation and giving
  { blockType: 'donorThankYou', label: 'Donor Thank-You', description: 'Gift acknowledgment section with merge tokens', icon: 'TY', section: 'Stewardship' },
  { blockType: 'donationReceipt', label: 'Donation Receipt Summary', description: 'Formal receipt-style mini invoice card', icon: 'R', section: 'Donation & Giving' },
  { blockType: 'givingSummary', label: 'Giving Summary', description: 'Year-end giving totals and cadence summary', icon: 'YS', section: 'Donation & Giving' },
  { blockType: 'donationCta', label: 'Donation CTA', description: 'Appeal block with suggested gift buttons', icon: '$', section: 'Donation & Giving' },
  { blockType: 'monthlyDonorInvitation', label: 'Monthly Donor Invitation', description: 'Invite one-time donors into recurring giving', icon: 'M+', section: 'Donation & Giving' },
  { blockType: 'progress', label: 'Campaign Progress', description: 'Show raised vs goal progress', icon: '%', section: 'Campaigns' },
  { blockType: 'lapsedDonorReengagement', label: 'Lapsed Donor Re-Engagement', description: 'Warm reconnect message with last-gift token', icon: 'RE', section: 'Stewardship' },
  { blockType: 'firstTimeDonorWelcome', label: 'First-Time Donor Welcome', description: 'Welcome and onboarding donor touchpoint', icon: 'W', section: 'Stewardship' },

  // Personalization and compliance
  { blockType: 'staffSignature', label: 'Staff Signature', description: 'Reusable relationship-owner signature block', icon: 'SG', section: 'Personalization' },
  { blockType: 'footerCompliance', label: 'Footer Compliance', description: 'Organization footer with unsubscribe/manage links', icon: 'F', section: 'Compliance' },

  // Existing media/layout/elements
  { blockType: 'video', label: 'Video', description: 'YouTube, Vimeo, OneDrive', icon: 'V', section: 'Media' },
  { blockType: 'columns', label: 'Columns', description: 'Two-column layout', icon: 'C', section: 'Layout' },
  { blockType: 'divider', label: 'Divider', description: 'Horizontal rule', icon: '-', section: 'Layout' },
  { blockType: 'spacer', label: 'Spacer', description: 'Vertical spacing', icon: '+', section: 'Layout' },
  { blockType: 'social', label: 'Social Follow', description: 'Social media links', icon: '@', section: 'Ministry / Mission' },

  // AI
  { blockType: 'aiText', label: 'AI Text', description: 'AI-generated narrative section', icon: 'AI', section: 'AI' },
  { blockType: 'aiButton', label: 'AI CTA', description: 'AI-generated call-to-action', icon: 'A>', section: 'AI' },
];
