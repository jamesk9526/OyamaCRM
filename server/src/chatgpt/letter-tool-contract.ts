import { DONOR_FIELDS } from "../oyama-create/studio/design.js";
import { CreateError } from "../oyama-create/domain.js";

type Schema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: false;
  enum?: readonly string[];
  items?: Schema;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
};

const obj = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const str = (maxLength: number, minLength = 1): Schema => ({ type: "string", maxLength, minLength });
const choice = (values: readonly string[]): Schema => ({ type: "string", enum: values });
const range = (minimum: number, maximum: number, type: "number" | "integer" = "number"): Schema => ({ type, minimum, maximum });
const bool = { type: "boolean" } as const;
const id = str(191), revision = range(1, 2_147_483_647, "integer"), requestKey = str(100, 8);
const paperSizes = ["LETTER", "A4", "LEGAL"] as const;
const orientations = ["portrait", "landscape"] as const;
const fonts = ["Noto Serif", "Inter"] as const;
const envelopeSizes = ["#10", "#9", "DL"] as const;
export const LETTER_BLOCKS = {
  image: "image", field: "studioField", salutation: "studioSalutation", address: "studioAddress",
  signature: "studioSignature", giving_link: "studioGiving", giving_qr: "studioQr", page_break: "letterPageBreak",
  spacer: "letterSpacer", divider: "horizontalRule",
} as const;
const blockTypes = Object.keys(LETTER_BLOCKS);
const margins = range(.125, 1.5);
const region = obj({ mode: choice(["brand", "none"]), presetId: str(191, 0) });
const envelope = obj({ enabled: bool, size: choice(envelopeSizes), window: bool, addressX: range(0, 8), addressY: range(0, 4), addressWidth: range(1, 6), offsetX: range(-.5, .5), offsetY: range(-.5, .5) });
const layout = obj({
  paper: choice(paperSizes), orientation: choice(orientations), margins: obj({ top: margins, right: margins, bottom: margins, left: margins }),
  headerHeight: range(0, 1.25), footerHeight: range(0, 1.25),
  font: choice(fonts), fontSize: range(8, 24), lineHeight: range(1, 2.5), paragraphSpacing: range(0, 36), textColor: { ...str(7, 7), description: "Hex color such as #172b4d." },
  firstHeader: region, header: region, firstFooter: region, footer: region,
  givingUrl: { ...str(2000, 0), description: "An HTTPS giving link or /give/<token> for this CRM. Empty clears the link." },
  giftFrequency: choice(["one-time", "monthly"]),
  replySlip: obj({ enabled: bool, placement: choice(["attached", "separate"]), html: str(30000) }),
  outerEnvelope: envelope, returnEnvelope: envelope,
});
const blocks: Schema = { type: "array", maxItems: 24, items: obj({
  type: choice(blockTypes),
  afterBlock: { ...range(0, 6000, "integer"), description: "Insert after this 1-based top-level block in the body before insertions. Use 0 for the start. Omit to append." },
  assetId: { ...id, description: "For image. Use a Studio asset ID from list_letter_images, import_letter_image or get_letter_image_job." },
  alt: { ...str(300, 0), description: "Required for image. Use an empty string for decorative artwork." },
  caption: str(500, 0), widthPercent: range(5, 100), align: choice(["left", "center", "right"]),
  heightPixels: { ...range(0, 900), description: "Use 0 for natural height. Cropping with cover requires a positive height." }, fit: choice(["contain", "cover"]), focalX: range(0, 100), focalY: range(0, 100),
  field: choice(DONOR_FIELDS), signerId: id, closing: str(200, 0), label: str(200), heightPoints: range(0, 144),
}, ["type"]) };

export const LETTER_DESIGN_OPTIONS = { paperSizes, orientations, fonts, envelopeSizes, blockTypes, marginsInches: { minimum: .125, maximum: 1.5 } };
export const IMAGE_SHAPES = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" } as const;

type LetterTool = {
  name: string;
  scope: "letters.read" | "letters.write";
  description: string;
  inputSchema: Schema;
  read: boolean;
  destructive?: boolean;
  openWorld?: boolean;
  fileInput?: "file";
};

export const LETTER_TOOLS = [
  { name: "get_letter_design_options", scope: "letters.read", read: true,
    description: "Discover Studio page sizes, print options, valid merge fields, and available header, footer and signature IDs. Pass a Studio letter ID to see its pinned brand choices. Use this before configuring letters or inventing merge tokens.",
    inputSchema: obj({ id }) },
  { name: "list_letter_images", scope: "letters.read", read: true,
    description: "Search this organization's active Studio image library. Returns asset IDs for insertion, along with dimensions and preview links. Continue with nextCursor.",
    inputSchema: obj({ query: str(100, 0), cursor: id }) },
  { name: "create_letter_draft", scope: "letters.write", read: false,
    description: "Save a new editable Studio letter from HTML. Supports inline merge tokens, page layout, letterhead, reply slips and editable image/signature/QR blocks. Use one requestKey per intent. Returns the saved revision and editor URL for review.",
    inputSchema: obj({ name: id, html: str(200000), requestKey, layout, insertBlocks: blocks }, ["name", "html", "requestKey"]) },
  { name: "update_letter_draft", scope: "letters.write", read: false, destructive: true,
    description: "Configure your own standalone MCP-created letter draft before approval. Use its current revision. Change layout, insert images or merge blocks, or replace the body with HTML while keeping its previous revision. Omit html to keep existing text. Use a stable requestKey for retries.",
    inputSchema: obj({ id, revision, requestKey, html: str(200000), layout, insertBlocks: blocks }, ["id", "revision", "requestKey"]) },
  { name: "preview_letter_draft", scope: "letters.read", read: true,
    description: "Check a Studio letter's merge fields, assets and print settings. Returns a text preview using fictional donor values and a link to the CRM editor for the PDF proof. Open the CRM for real-recipient proofs.",
    inputSchema: obj({ id, revision }, ["id"]) },
  { name: "import_letter_image", scope: "letters.write", read: false, openWorld: true, fileInput: "file",
    description: "Save an attached ChatGPT PNG, JPEG or WebP up to 5 MB to the organization's Studio image library. Use shareable artwork only. Returns an asset ID to insert with create_letter_draft or update_letter_draft.",
    inputSchema: obj({ name: id, requestKey, file: obj({ download_url: str(8192), file_id: str(512), mime_type: str(128, 0), file_name: str(512, 0) }, ["download_url", "file_id"]) }, ["name", "requestKey", "file"]) },
  { name: "generate_letter_image", scope: "letters.write", read: false, openWorld: true,
    description: "Queue one AI illustration for the Studio image library using the organization's configured OpenAI API billing. Use a visual brief only, without donor information or merge values. Keep the requestKey stable and check the returned job ID using get_letter_image_job.",
    inputSchema: obj({ name: id, requestKey, prompt: str(2000), shape: choice(Object.keys(IMAGE_SHAPES)) }, ["name", "requestKey", "prompt"]) },
  { name: "get_letter_image_job", scope: "letters.write", read: true,
    description: "Check your queued image generation. A completed job returns a Studio asset ID ready to insert. A pending or running job can be checked again later.",
    inputSchema: obj({ id }, ["id"]) },
] as const satisfies readonly LetterTool[];

export type LetterToolName = (typeof LETTER_TOOLS)[number]["name"];

/** Use the same bounds and property names in discovery and on the server. */
export function validateLetterArguments(schema: Schema, value: unknown, path = "arguments"): void {
  const invalid = () => { throw new CreateError(400, `Invalid ${path}. Check the tool's input schema.`); };
  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
      const fields = value as Record<string, unknown>, properties = schema.properties!;
      for (const name of schema.required || []) if (!Object.prototype.hasOwnProperty.call(fields, name)) throw new CreateError(400, `Missing ${path}.${name}.`);
      for (const [name, field] of Object.entries(fields)) {
        if (!Object.prototype.hasOwnProperty.call(properties, name)) throw new CreateError(400, `Unexpected ${path}.${name}.`);
        validateLetterArguments(properties[name], field, `${path}.${name}`);
      }
      return;
    }
    case "array":
      if (!Array.isArray(value) || value.length > schema.maxItems!) return invalid();
      value.forEach((item, index) => validateLetterArguments(schema.items!, item, `${path}[${index}]`));
      return;
    case "string":
      if (typeof value !== "string" || value.length > (schema.maxLength ?? Infinity) || value.trim().length < (schema.minLength ?? 0) || schema.enum && !schema.enum.includes(value)) invalid();
      return;
    case "boolean":
      if (typeof value !== "boolean") invalid();
      return;
    default:
      if (typeof value !== "number" || !Number.isFinite(value) || schema.type === "integer" && !Number.isInteger(value) || value < schema.minimum! || value > schema.maximum!) invalid();
  }
}
