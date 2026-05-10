import type { Page, SectionInstance, SiteProject } from "../schema";

/** Templates module for full-site, page, and section template assets. */
export interface SiteTemplate {
  id: string;
  name: string;
  category: "nonprofit" | "ministry" | "campaign" | "event" | "business" | "author";
  site: SiteProject;
}

export interface PageTemplate {
  id: string;
  name: string;
  page: Page;
}

export interface SectionTemplate {
  id: string;
  name: string;
  section: SectionInstance;
  synced: boolean;
}
