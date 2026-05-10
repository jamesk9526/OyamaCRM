import type { SiteProject } from "../schema";

/** Sites module contract for creating/listing/loading website projects. */
export interface SitesModule {
  listSites: () => Promise<SiteProject[]>;
  createSite: (input: Pick<SiteProject, "name" | "slug" | "type">) => Promise<SiteProject>;
  archiveSite: (siteId: string) => Promise<void>;
}
