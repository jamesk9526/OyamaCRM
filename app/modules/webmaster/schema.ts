/** Canonical website-builder schema for OyamaWebMaster. */

export type SiteType = "nonprofit" | "ministry" | "business" | "author" | "event" | "custom";
export type SiteStatus = "draft" | "published" | "archived";
export type PageType = "home" | "standard" | "landing" | "blog" | "dynamic" | "system";
export type PageStatus = "draft" | "review" | "published";

export interface SeoSettings {
  title: string;
  description: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  socialImageAssetId?: string;
}

export interface SocialPreviewSettings {
  title?: string;
  description?: string;
  imageAssetId?: string;
}

export interface PageVisibility {
  requireLogin?: boolean;
  audience?: "public" | "members" | "staff";
}

export interface ResponsiveSettings {
  hideOnDesktop?: boolean;
  hideOnTablet?: boolean;
  hideOnMobile?: boolean;
  paddingDesktop?: string;
  paddingTablet?: string;
  paddingMobile?: string;
}

export interface VisibilitySettings {
  hidden?: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
}

export interface AccessibilitySettings {
  ariaLabel?: string;
  altText?: string;
}

export interface CmsBinding {
  collectionId: string;
  field: string;
}

export interface BlockInstance {
  id: string;
  type: string;
  content: Record<string, unknown>;
  style?: Record<string, unknown>;
  bindings?: CmsBinding[];
  accessibility?: AccessibilitySettings;
}

export interface SectionInstance {
  id: string;
  type: string;
  variant: string;
  label?: string;
  settings: Record<string, unknown>;
  blocks: BlockInstance[];
  responsive?: ResponsiveSettings;
  visibility?: VisibilitySettings;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  path: string;
  type: PageType;
  status: PageStatus;
  sections: SectionInstance[];
  seo: SeoSettings;
  social: SocialPreviewSettings;
  visibility: PageVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface BrandTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSize: string;
    scale: "compact" | "comfortable" | "editorial";
  };
  spacing: {
    sectionY: string;
    containerWidth: string;
    gap: string;
  };
  radius: {
    card: string;
    button: string;
    image: string;
  };
}

export interface Asset {
  id: string;
  filename: string;
  originalFilename: string;
  type: "image" | "video" | "pdf" | "document" | "other";
  url: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  folderId?: string;
  usedBy: Array<{ scope: "page" | "section" | "block"; targetId: string }>;
  createdAt: string;
}

export interface CmsCollection {
  id: string;
  name: string;
  slug: string;
  fields: Array<{ id: string; name: string; type: string; required?: boolean }>;
}

export interface FormDefinition {
  id: string;
  name: string;
  type: string;
  fields: Array<{ id: string; label: string; type: string; required?: boolean }>;
}

export interface PublishingConfig {
  target: "local" | "zip" | "preview" | "sftp" | "ssh";
  previewUrl?: string;
  domain?: string;
}

export interface SiteProject {
  id: string;
  name: string;
  slug: string;
  type: SiteType;
  status: SiteStatus;
  brandKitId: string;
  pages: Page[];
  collections: CmsCollection[];
  assets: Asset[];
  forms: FormDefinition[];
  integrations: Array<{ id: string; provider: string; config: Record<string, unknown> }>;
  publishing: PublishingConfig;
  seoDefaults: SeoSettings;
  createdAt: string;
  updatedAt: string;
}
