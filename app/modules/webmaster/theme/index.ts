import type { BrandTheme } from "../schema";

/** Theme module for brand kit and design-token management. */
export interface ThemeModule {
  getTheme: () => Promise<BrandTheme | null>;
  saveTheme: (theme: BrandTheme) => Promise<BrandTheme>;
}
