import type { StudioNode } from "./types.js";
export type BlockDefinition = { type: string; name: string; category: "Writing" | "Layout" | "Brand" | "Donor" | "Fundraising"; description: string; sensitive?: boolean; printOnly?: boolean; attrs?: Record<string, unknown> };
export const STUDIO_BLOCKS: BlockDefinition[] = [
  { type: "paragraph", name: "Text", category: "Writing", description: "A fully formatted paragraph" },
  { type: "heading", name: "Heading", category: "Writing", description: "A section title", attrs: { level: 2 } },
  { type: "bulletList", name: "Bulleted list", category: "Writing", description: "An editable list" },
  { type: "blockquote", name: "Quotation", category: "Writing", description: "A donor or community story" },
  { type: "studioCallout", name: "Callout", category: "Layout", description: "Highlight a message", attrs: { color: "#edf4fc" } },
  { type: "studioImpact", name: "Impact story", category: "Fundraising", description: "Explain the difference a gift makes" },
  { type: "image", name: "Image", category: "Layout", description: "Photo, caption, crop and link", attrs: { src: "", alt: "", width: 100, crop: "contain", focalX: 50, focalY: 50, caption: "" } },
  { type: "table", name: "Table", category: "Layout", description: "Editable rows, columns and repeated headings" },
  { type: "studioColumns", name: "Two columns", category: "Layout", description: "Structured side-by-side content that stacks in email" },
  { type: "studioGroup", name: "Keep-together group", category: "Layout", description: "Keep related content together", attrs: { keepTogether: true } },
  { type: "horizontalRule", name: "Divider", category: "Layout", description: "Separate sections" },
  { type: "letterSpacer", name: "Spacer", category: "Layout", description: "Controlled breathing room", attrs: { height: 12 } },
  { type: "letterPageBreak", name: "Page break", category: "Layout", description: "Start a new printed page", printOnly: true },
  { type: "studioSignature", name: "Signature", category: "Brand", description: "Closing, signature image, signer and title", attrs: { signerId: "", secondSignerId: "", closing: "", keepTogether: true } },
  { type: "studioSalutation", name: "Salutation", category: "Donor", description: "Use the CRM's individual, household or organization greeting" },
  { type: "studioAddress", name: "Mailing address", category: "Donor", description: "The recipient's postal address", printOnly: true },
  { type: "studioField", name: "Donor field", category: "Donor", description: "Insert an approved CRM field", attrs: { field: "name" } },
  { type: "studioCondition", name: "Conditional section", category: "Donor", description: "Show content when a configured donor rule matches", attrs: { field: "hasGiving", operator: "is", value: "true" } },
  { type: "studioAsk", name: "Ask amounts", category: "Fundraising", description: "Fixed or staff-defined donor-based ask ladder", sensitive: true, attrs: { basis: "fixed", amounts: [], multipliers: [1, 1.5, 2], fallback: [], minimum: 1, maximum: 100000, rounding: 5, label: "Your gift makes a difference" } },
  { type: "studioGiving", name: "Give now", category: "Fundraising", description: "A configured giving destination and frequency", attrs: { label: "Make a gift" } },
  { type: "studioHistory", name: "Giving summary", category: "Fundraising", description: "Actual giving totals or a dated gift table", sensitive: true, attrs: { mode: "summary" } },
  { type: "studioReceipt", name: "Gift receipt", category: "Fundraising", description: "Selected gift facts and an approved statement", sensitive: true, attrs: { statement: "" } },
  { type: "studioPledge", name: "Pledge reminder", category: "Fundraising", description: "An actual pledge balance and due date", sensitive: true },
  { type: "studioProgress", name: "Campaign progress", category: "Fundraising", description: "The linked fundraising campaign's actual goal and giving" },
  { type: "studioQr", name: "Giving QR code", category: "Fundraising", description: "A scannable code for the configured giving page", attrs: { size: 96 } },
  { type: "studioResponse", name: "Reply choices", category: "Fundraising", description: "Gift choices, response code and return instructions", attrs: { label: "Yes, I want to help", amounts: [] } },
];
export function textNode(text: string): StudioNode { return { type: "text", text }; }
export function paragraph(id: string, text = ""): StudioNode { return { type: "paragraph", attrs: { studioId: id }, content: text ? [textNode(text)] : [] }; }
export function newBlock(type: string, id: string): StudioNode {
  const definition = STUDIO_BLOCKS.find(item => item.type === type);
  if (!definition) throw new Error("Unsupported Studio block.");
  const node: StudioNode = { type, attrs: { ...definition.attrs, studioId: id } };
  if (["paragraph", "heading"].includes(type)) node.content = [];
  if (type === "bulletList") node.content = [{ type: "listItem", content: [paragraph(`${id}-text`)] }];
  if (["blockquote", "studioGroup", "studioCallout", "studioImpact", "studioCondition"].includes(type)) node.content = [paragraph(`${id}-text`)];
  if (type === "studioColumns") node.content = [0, 1].map(index => ({ type: "studioColumn", content: [paragraph(`${id}-${index}`)] }));
  if (type === "table") node.content = [0, 1, 2].map(row => ({ type: "tableRow", content: [0, 1].map(col => ({ type: row ? "tableCell" : "tableHeader", attrs: { colspan: 1, rowspan: 1 }, content: [paragraph(`${id}-${row}-${col}`, row ? "" : `Column ${col + 1}`)] })) }));
  return node;
}
