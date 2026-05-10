import type { CmsCollection } from "../schema";

/** CMS module for collection and entry management in dynamic sections/pages. */
export interface CmsModule {
  listCollections: () => Promise<CmsCollection[]>;
  createCollection: (input: Pick<CmsCollection, "name" | "slug" | "fields">) => Promise<CmsCollection>;
}
