/**
 * Email Builder Types
 *
 * Defines all block types, the email template structure, and
 * discriminated-union helpers used throughout the email builder.
 */

// ─── Block Type Discriminant ──────────────────────────────────────────────────

export type BlockType =
  | 'text'
  | 'image'
  | 'video'
  | 'button'
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
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
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
  | TextBlock
  | ImageBlock
  | VideoBlock
  | ButtonBlock
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
  section: 'Content' | 'Media' | 'Layout' | 'Elements';
}

export const PALETTE_ITEMS: PaletteItem[] = [
  // Content
  { blockType: 'text',    label: 'Text',    description: 'Add formatted text',        icon: 'T',  section: 'Content'  },
  { blockType: 'image',   label: 'Image',   description: 'Upload or link an image',    icon: '🖼', section: 'Content'  },
  { blockType: 'button',  label: 'Button',  description: 'Call-to-action button',      icon: '🖱', section: 'Content'  },
  // Media
  { blockType: 'video',   label: 'Video',   description: 'YouTube, Vimeo, OneDrive',   icon: '▶', section: 'Media'    },
  // Layout
  { blockType: 'columns', label: 'Columns', description: 'Two-column layout',          icon: '⊞', section: 'Layout'   },
  { blockType: 'divider', label: 'Divider', description: 'Horizontal rule',            icon: '—', section: 'Layout'   },
  { blockType: 'spacer',  label: 'Spacer',  description: 'Vertical spacing',           icon: '↕', section: 'Layout'   },
  // Elements
  { blockType: 'social',  label: 'Social',  description: 'Social media links',         icon: '⇄', section: 'Elements' },
];
