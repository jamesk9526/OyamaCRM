import type { Page, SectionInstance } from "../schema";

/** Builder module state for selection and editing. */
export interface BuilderState {
  page: Page;
  selectedSectionId?: string;
  selectedBlockId?: string;
  previewDevice: "desktop" | "tablet" | "mobile";
}

export interface BuilderModule {
  setPage: (page: Page) => void;
  addSection: (section: SectionInstance, index?: number) => void;
  removeSection: (sectionId: string) => void;
  reorderSection: (sectionId: string, direction: "up" | "down") => void;
  savePage: () => Promise<void>;
}
