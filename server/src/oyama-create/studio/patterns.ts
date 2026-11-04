import { newBlock, paragraph } from "./registry.js";
import type { StudioNode } from "./types.js";

export const STUDIO_PATTERNS = [
  { id: "photo-story", name: "Photo and story", description: "A photo, editable caption and story paragraph", icon: "image" },
  { id: "impact-ask", name: "Impact and giving request", description: "Connect the difference a gift makes with an ask", icon: "studioImpact" },
  { id: "acknowledgment", name: "Personal acknowledgment", description: "A donor greeting, thank-you and saved signature", icon: "studioSalutation" },
  { id: "pledge", name: "Pledge reminder", description: "Authoritative pledge details and a giving action", icon: "studioPledge" },
  { id: "signatures", name: "Signature group", description: "A closing with your selected organization signer", icon: "studioSignature" },
  { id: "reply", name: "Reply choices", description: "Printed response choices and a giving QR code", icon: "studioResponse" },
  { id: "letterhead", name: "Contact letterhead", description: "Organization identity and editable contact details", icon: "letterPageBreak" },
] as const;

export function studioPattern(id: string, identity: () => string): StudioNode[] {
  const block = (type: string) => newBlock(type, identity());
  switch (id) {
    case "photo-story": return [
      { ...block("heading"), content: [{ type: "text", text: "A story of possibility" }] },
      block("image"), paragraph(identity(), "Share a specific story that shows the difference your donors make."),
    ];
    case "impact-ask": return [block("studioImpact"), block("studioAsk"), block("studioGiving")];
    case "acknowledgment": return [block("studioSalutation"), paragraph(identity(), "Thank you for your generosity and care for our community."), block("studioSignature")];
    case "pledge": return [block("studioPledge"), paragraph(identity(), "Thank you for your commitment. Your continued support makes this work possible."), block("studioGiving")];
    case "signatures": return [block("studioSignature")];
    case "reply": return [block("studioResponse"), block("studioQr")];
    case "letterhead": return [
      { ...block("heading"), content: [{ type: "text", text: "Organization name" }] },
      paragraph(identity(), "Add your organization’s address, phone and website."),
    ];
    default: throw new Error("Choose an available Studio pattern.");
  }
}
