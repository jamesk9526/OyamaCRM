import { defaultDesign, normalizeDesign } from "./design.js";
import { newBlock, paragraph, textNode } from "./registry.js";
import type { StudioDesign, StudioNode } from "./types.js";
export const STUDIO_PRESETS = [
  { id: "classic", name: "Classic appeal", description: "A personal letter, clear ask and reply pack", category: "Appeals" },
  { id: "story", name: "Photo & story appeal", description: "A community story with a photo and giving action", category: "Appeals" },
  { id: "year-end", name: "Year-end appeal", description: "A year in review and an invitation to give", category: "Appeals" },
  { id: "win-back", name: "Donor win-back", description: "A warm invitation for a selected returning-donor audience", category: "Appeals" },
  { id: "monthly", name: "Monthly giving", description: "An invitation to become a sustaining supporter", category: "Appeals" },
  { id: "thanks", name: "Thank-you letter", description: "An acknowledgment using real gift details", category: "Stewardship" },
  { id: "receipt", name: "Gift receipt", description: "Selected-gift facts and an approved receipt statement", category: "Stewardship" },
  { id: "annual", name: "Annual giving statement", description: "Giving totals and the actual dated gift table", category: "Stewardship" },
  { id: "pledge", name: "Pledge reminder", description: "An actual pledge balance with an optional giving action", category: "Stewardship" },
] as const;
export function studioPreset(id: string): StudioDesign {
  if (!STUDIO_PRESETS.some(preset => preset.id === id)) throw new Error("Choose a supported Studio preset.");
  const design = defaultDesign(); const block = (type: string, key: string) => newBlock(type, `${id}-${key}`);
  const heading = block("heading", "heading"); heading.content = [textNode(id === "thanks" || id === "receipt" ? "Thank you for your generosity" : id === "annual" ? "Your annual giving statement" : id === "pledge" ? "A reminder of your commitment" : "Together, we can do more")];
  const body: StudioNode[] = [block("studioSalutation", "salutation"), heading];
  if (id === "story") body.push(block("image", "photo"));
  body.push(paragraph(`${id}-story`, id === "win-back" ? "We would love to reconnect and share what your support makes possible. Add a recent story and a specific invitation here." : id === "monthly" ? "A dependable monthly gift helps us plan ahead. Tell your community what sustained support makes possible." : id === "year-end" ? "Reflect on the year with a real story from your organization, then invite your reader to help with the work ahead." : id === "thanks" ? "Your gift matters to our community. Add a personal acknowledgment and describe the difference it will make." : id === "receipt" ? "Please retain the following acknowledgment with your records." : id === "annual" ? "Thank you for your support during the selected period. Your recorded gifts are listed below." : id === "pledge" ? "Thank you for your commitment. The following balance comes from your current CRM pledge records." : "Share your organization's story, explain the need, and invite the reader to take part. Replace this starter copy with your own appeal."));
  if (["thanks", "receipt"].includes(id)) body.push(block("studioReceipt", "gift"));
  else if (id === "annual") { const summary = block("studioHistory", "summary"), table = block("studioHistory", "gifts"); table.attrs!.mode = "table"; body.push(summary, table); }
  else if (id === "pledge") body.push(block("studioPledge", "balance"), block("studioGiving", "give"));
  else body.push(block("studioAsk", "ask"), block("studioGiving", "give"));
  body.push(block("studioSignature", "signature"));
  if (!["receipt", "annual"].includes(id)) body.push(paragraph(`${id}-ps`, "P.S. Add a short personal reminder or invitation here."));
  design.body.content = body;
  if (["classic", "story", "year-end", "win-back", "monthly"].includes(id)) {
    design.pack.replySlip.enabled = true; design.pack.replySlip.content = { type: "doc", content: [block("studioResponse", "reply"), block("studioQr", "qr")] };
    design.pack.outerEnvelope.enabled = true; design.pack.returnEnvelope.enabled = true;
  }
  if (id === "monthly") design.data.frequency = "monthly";
  if (id === "receipt") design.data.giftPolicy = "selected";
  design.email.subject = STUDIO_PRESETS.find(preset => preset.id === id)!.name;
  return normalizeDesign(design);
}
