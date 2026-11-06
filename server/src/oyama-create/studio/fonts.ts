import type { StudioDesign } from "./types.js";
export const STUDIO_FONTS = ["Inter", "Noto Serif", "Georgia", "Arial", "Times New Roman", "Aptos"] as const;
export type StudioFont = string;
export const FONT_FILES: Record<StudioFont, string> = { Inter: "inter-latin-variable.woff2", "Noto Serif": "noto-serif-latin.woff2", Georgia: "create/georgia.woff2", Arial: "create/arial.woff2", "Times New Roman": "create/times-new-roman.woff2", Aptos: "create/aptos.woff2" };
export function studioFont(value: unknown): StudioFont {
  const family = typeof value === "string" ? value.split(",")[0].trim().replace(/^["']|["']$/g, "") : "";
  if (!family) return "Noto Serif";
  const generic: Record<string, string> = { serif: "Noto Serif", "sans-serif": "Inter", "system-ui": "Inter" };
  return STUDIO_FONTS.find(font => font.toLowerCase() === family.toLowerCase()) || generic[family.toLowerCase()] || (/^[\p{L}\p{N} _-]{1,80}$/u.test(family) ? family : "Noto Serif");
}
export function fontFile(name: string) {
  return Object.prototype.hasOwnProperty.call(FONT_FILES, name)
    ? FONT_FILES[name]
    : `create/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.woff2`;
}
export function designFonts(design: StudioDesign): StudioFont[] {
  const fonts = new Set<StudioFont>([studioFont(design.styles.font)]);
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "fontFamily" && typeof item === "string") fonts.add(studioFont(item));
      else if (key === "html" && typeof item === "string") for (const match of item.matchAll(/font-family\s*:\s*([^;<>]+)/gi)) fonts.add(studioFont(match[1]));
      else inspect(item);
    }
  };
  inspect(design.channels?.LETTER?.document || design.body);
  for(const region of Object.values(design.regions))if(region.mode!=="none")inspect(region.content);
  if(design.pack.replySlip.enabled)inspect(design.pack.replySlip.content);
  return [...fonts];
}
