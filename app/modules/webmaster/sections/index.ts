import type { SectionInstance } from "../schema";
import type { SectionManifest } from "../section-registry";

/** Sections module wraps registry access and section instance lifecycle. */
export interface SectionsModule {
  manifests: SectionManifest[];
  createFromManifest: (type: string) => SectionInstance;
  validateSection: (section: SectionInstance) => Array<{ code: string; message: string }>;
}
