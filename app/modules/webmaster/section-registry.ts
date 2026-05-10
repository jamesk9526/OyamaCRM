import type { BlockInstance, SectionInstance } from "./schema";

export type SectionCategory =
  | "hero"
  | "about"
  | "services"
  | "impact"
  | "donation"
  | "events"
  | "content"
  | "contact"
  | "navigation";

export interface SectionManifest {
  type: string;
  name: string;
  category: SectionCategory;
  description: string;
  defaultVariant: string;
  variants: string[];
  defaultSettings: Record<string, unknown>;
  defaultBlocks: BlockInstance[];
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function block(type: string, content: Record<string, unknown>): BlockInstance {
  return {
    id: createId(),
    type,
    content,
  };
}

const SECTION_MANIFESTS: SectionManifest[] = [
  {
    type: "header",
    name: "Header",
    category: "navigation",
    description: "Site navigation with primary actions.",
    defaultVariant: "standard",
    variants: ["standard", "minimal"],
    defaultSettings: { background: "#ffffff", spacing: "compact" },
    defaultBlocks: [
      block("text", { text: "Organization Name", level: "h4" }),
      block("button", { text: "Donate", href: "/donate" }),
    ],
  },
  {
    type: "hero",
    name: "Hero",
    category: "hero",
    description: "Large headline and supporting call to action.",
    defaultVariant: "nonprofit",
    variants: ["nonprofit", "split-image", "campaign", "event"],
    defaultSettings: { background: "#f4f7f8", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Serve your community with clarity.", level: "h1" }),
      block("text", { text: "Create, manage, publish, and export websites from one visual workspace.", level: "p" }),
      block("button", { text: "Start Building", href: "#" }),
    ],
  },
  {
    type: "split-image-text",
    name: "Split Image/Text",
    category: "about",
    description: "Two-column section for story and image.",
    defaultVariant: "left-copy",
    variants: ["left-copy", "right-copy"],
    defaultSettings: { background: "#ffffff", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Our mission in action", level: "h2" }),
      block("text", { text: "Share a clear story about your impact and values.", level: "p" }),
      block("image", { src: "", alt: "Mission photo" }),
    ],
  },
  {
    type: "text",
    name: "Text",
    category: "content",
    description: "Simple long-form copy section.",
    defaultVariant: "body",
    variants: ["body", "highlight"],
    defaultSettings: { background: "#ffffff", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Add your content here.", level: "p" }),
    ],
  },
  {
    type: "card-grid",
    name: "Card Grid",
    category: "services",
    description: "Grid for services, programs, or resources.",
    defaultVariant: "three-column",
    variants: ["two-column", "three-column", "four-column"],
    defaultSettings: { columns: 3, background: "#ffffff", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Program One", level: "h3" }),
      block("text", { text: "Program Two", level: "h3" }),
      block("text", { text: "Program Three", level: "h3" }),
    ],
  },
  {
    type: "cta",
    name: "CTA",
    category: "donation",
    description: "High-contrast call-to-action row.",
    defaultVariant: "donation",
    variants: ["donation", "newsletter", "event"],
    defaultSettings: { background: "#0f5f5a", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Help us reach more families this month.", level: "h2" }),
      block("button", { text: "Give Today", href: "/donate" }),
    ],
  },
  {
    type: "faq",
    name: "FAQ",
    category: "content",
    description: "Question and answer accordion content.",
    defaultVariant: "accordion",
    variants: ["accordion", "list"],
    defaultSettings: { background: "#ffffff", spacing: "comfortable" },
    defaultBlocks: [
      block("faq-item", { question: "How can I volunteer?", answer: "Use the volunteer form and we will respond within 2 business days." }),
      block("faq-item", { question: "Where can I donate?", answer: "Use the donate button to open our secure donation flow." }),
    ],
  },
  {
    type: "contact",
    name: "Contact",
    category: "contact",
    description: "Contact details and simple action prompts.",
    defaultVariant: "card",
    variants: ["card", "split"],
    defaultSettings: { background: "#ffffff", spacing: "comfortable" },
    defaultBlocks: [
      block("text", { text: "Contact Us", level: "h2" }),
      block("text", { text: "123 Hope Street, Springfield", level: "p" }),
      block("button", { text: "Send Message", href: "/contact" }),
    ],
  },
  {
    type: "footer",
    name: "Footer",
    category: "navigation",
    description: "Footer with legal links and contact details.",
    defaultVariant: "standard",
    variants: ["standard", "minimal"],
    defaultSettings: { background: "#0f172a", spacing: "compact" },
    defaultBlocks: [
      block("text", { text: "Copyright Organization", level: "p" }),
      block("text", { text: "Privacy Policy | Terms", level: "p" }),
    ],
  },
];

export function listSectionManifests(): SectionManifest[] {
  return SECTION_MANIFESTS;
}

export function getSectionManifest(type: string): SectionManifest | undefined {
  return SECTION_MANIFESTS.find((manifest) => manifest.type === type);
}

export function createSectionFromManifest(type: string): SectionInstance {
  const manifest = getSectionManifest(type);
  if (!manifest) {
    throw new Error(`Unknown section type: ${type}`);
  }

  return {
    id: createId(),
    type: manifest.type,
    variant: manifest.defaultVariant,
    settings: { ...manifest.defaultSettings },
    blocks: manifest.defaultBlocks.map((entry) => ({
      ...entry,
      id: createId(),
    })),
  };
}

export function createDefaultPageSections(): SectionInstance[] {
  return [
    createSectionFromManifest("header"),
    createSectionFromManifest("hero"),
    createSectionFromManifest("split-image-text"),
    createSectionFromManifest("cta"),
    createSectionFromManifest("footer"),
  ];
}
