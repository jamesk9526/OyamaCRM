import { readFile } from "node:fs/promises";
import { fontFile, STUDIO_FONTS, designFonts, studioFont } from "./fonts.js";
import type { StudioDesign, StudioIssue } from "./types.js";

export async function fontInventory(extra: string[] = []) {
  return Promise.all([...new Set([...STUDIO_FONTS,...extra.map(studioFont)])].map(async name => ({ name, available: await readFile(`public/fonts/${fontFile(name)}`).then(() => true, () => false), url: `/fonts/${fontFile(name)}` })));
}
export async function printFontAssets(design: StudioDesign, html: string[] = []): Promise<{ assets: Record<string, string>; issues: StudioIssue[] }> {
  const names = new Set(designFonts(design));
  for (const part of html) for (const match of part.matchAll(/font-family\s*:\s*([^;<>]+)/gi)) names.add(studioFont(match[1]));
  const assets: Record<string, string> = {}, issues: StudioIssue[] = [];
  // Both bundled fonts remain available for default chrome and inherited rich text.
  names.add("Inter"); names.add("Noto Serif");
  for (const name of names) {
    try { assets[`font:${name}`] = (await readFile(`public/fonts/${fontFile(name)}`)).toString("base64"); }
    catch { issues.push({ code: "PRINT_FONT_UNAVAILABLE", message: `${name} is not installed for verified printing. Install an authorized font at public/fonts/${fontFile(name)} or explicitly choose an available font.`, blocking: true, channel: "LETTER" }); }
  }
  return { assets, issues };
}
