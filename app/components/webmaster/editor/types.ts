/** Shared editor types for OyamaWebMaster visual editing workspace. */
import type { SectionInstance } from "@/app/modules/webmaster/schema";

export interface WebmasterSite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  lastPublishedAt: string | null;
  publishedVersionId: string | null;
}

export interface WebmasterPage {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  status: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  contentJson: Record<string, unknown> | null;
  updatedAt: string;
}

export interface WebmasterDocument {
  version: number;
  sections: SectionInstance[];
}

export interface PageSettingsState {
  title: string;
  slug: string;
  path: string;
  status: WebmasterPage["status"];
  seoTitle: string;
  seoDescription: string;
}

export interface SaveState {
  status: "idle" | "dirty" | "saving" | "saved" | "error";
  detail?: string;
}

export type DeviceMode = "desktop" | "tablet" | "mobile";

export type LeftRailPanel = "pages" | "add-section" | "layers" | "assets" | "theme" | "forms" | "seo" | "settings";

export interface PublishReadinessCheck {
  id: string;
  label: string;
  status: "Working" | "Partially Working" | "Broken" | "Not Implemented";
  detail: string;
}

export interface PublishReadinessData {
  status: "Working" | "Partially Working" | "Broken" | "Not Implemented";
  summary: string;
  checks: PublishReadinessCheck[];
  preflightPassed: boolean;
  pagesMissingSeo: Array<{ id: string; title: string; path: string }>;
  pagesWithInvalidPath: Array<{ id: string; title: string; path: string }>;
  draftChangesSinceLastPublish: number;
  previewLink: string | null;
  publishExecutionStatus: "Not Implemented" | "Working";
  rollbackStatus: "Not Implemented" | "Working";
  lastPublishedVersionId: string | null;
  lastPublishedAt: string | null;
}

export interface WebmasterPublishVersion {
  id: string;
  siteId: string;
  versionLabel: string;
  note: string | null;
  rollbackFromVersionId: string | null;
  createdAt: string;
}
