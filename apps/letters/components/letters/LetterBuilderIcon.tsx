/** Shared inline icons for the focused Letters & Printables builder controls. */

export type LetterBuilderIconName =
  | "ai"
  | "alignCenter"
  | "alignJustify"
  | "alignLeft"
  | "alignRight"
  | "bold"
  | "callout"
  | "campaign"
  | "code"
  | "color"
  | "divider"
  | "donation"
  | "event"
  | "footer"
  | "header"
  | "heading"
  | "image"
  | "italic"
  | "lineHeight"
  | "list"
  | "organization"
  | "quote"
  | "receipt"
  | "signature"
  | "social"
  | "strike"
  | "table"
  | "text"
  | "underline"
  | "variable";

interface LetterBuilderIconProps {
  name: LetterBuilderIconName;
  className?: string;
}

/** Renders compact stroke icons without adding another icon dependency. */
export default function LetterBuilderIcon({ name, className = "h-4 w-4" }: LetterBuilderIconProps) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  switch (name) {
    case "ai":
      return <svg {...common}><path d="m12 3 1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3Z" /><path d="m5 15 .9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15Z" /><path d="m19 14 .7 1.6 1.6.7-1.6.7L19 19l-.7-1.6-1.6-.7 1.6-.7.7-1.6Z" /></svg>;
    case "alignCenter":
      return <svg {...common}><path d="M5 6h14" /><path d="M8 10h8" /><path d="M5 14h14" /><path d="M8 18h8" /></svg>;
    case "alignJustify":
      return <svg {...common}><path d="M5 6h14" /><path d="M5 10h14" /><path d="M5 14h14" /><path d="M5 18h14" /></svg>;
    case "alignLeft":
      return <svg {...common}><path d="M4 6h16" /><path d="M4 10h10" /><path d="M4 14h16" /><path d="M4 18h10" /></svg>;
    case "alignRight":
      return <svg {...common}><path d="M4 6h16" /><path d="M10 10h10" /><path d="M4 14h16" /><path d="M10 18h10" /></svg>;
    case "bold":
      return <svg {...common}><path d="M8 5h5a3 3 0 0 1 0 6H8z" /><path d="M8 11h6a3 3 0 0 1 0 6H8z" /><path d="M8 5v12" /></svg>;
    case "callout":
      return <svg {...common}><path d="M5 5h14v10H8l-3 3V5Z" /><path d="M9 9h6" /><path d="M9 12h4" /></svg>;
    case "campaign":
      return <svg {...common}><path d="M4 11v5a2 2 0 0 0 2 2h2" /><path d="M7 11l11-5v12L7 13" /><path d="M7 11v2" /></svg>;
    case "code":
      return <svg {...common}><path d="m9 18-6-6 6-6" /><path d="m15 6 6 6-6 6" /></svg>;
    case "color":
      return <svg {...common}><path d="m12 4 6 16" /><path d="M8 14h8" /><path d="m6 20 6-16 6 16" /></svg>;
    case "divider":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "donation":
      return <svg {...common}><path d="M12 3v18" /><path d="M17 7.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5" /></svg>;
    case "event":
      return <svg {...common}><path d="M7 3v4" /><path d="M17 3v4" /><path d="M4 8h16" /><path d="M5 5h14v15H5z" /><path d="M8 12h3" /><path d="M13 12h3" /><path d="M8 16h3" /></svg>;
    case "footer":
      return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 16h8" /><path d="M8 18h5" /></svg>;
    case "header":
      return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8 8h8" /><path d="M8 10h5" /></svg>;
    case "heading":
      return <svg {...common}><path d="M6 5v14" /><path d="M18 5v14" /><path d="M6 12h12" /></svg>;
    case "image":
      return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m7 17 4-4 3 3 2-2 3 3" /></svg>;
    case "italic":
      return <svg {...common}><path d="M10 5h8" /><path d="M6 19h8" /><path d="m14 5-4 14" /></svg>;
    case "lineHeight":
      return <svg {...common}><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 5v14" /><path d="m2 7 2-2 2 2" /><path d="m2 17 2 2 2-2" /></svg>;
    case "list":
      return <svg {...common}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></svg>;
    case "organization":
      return <svg {...common}><path d="M5 20V6l7-3 7 3v14" /><path d="M9 20v-6h6v6" /><path d="M9 8h.01" /><path d="M12 8h.01" /><path d="M15 8h.01" /><path d="M9 11h.01" /><path d="M12 11h.01" /><path d="M15 11h.01" /></svg>;
    case "quote":
      return <svg {...common}><path d="M8 11H5a4 4 0 0 1 4-4v2a2 2 0 0 0-2 2h1v5H4v-5Z" /><path d="M18 11h-3a4 4 0 0 1 4-4v2a2 2 0 0 0-2 2h1v5h-4v-5Z" /></svg>;
    case "receipt":
      return <svg {...common}><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>;
    case "signature":
      return <svg {...common}><path d="M4 18c2-5 4-9 6-9 3 0-1 8 2 8 1.4 0 2.2-1.5 3-3 1 2 2 3 5 3" /><path d="M15 5l4 4" /><path d="m14 10 5-5 2 2-5 5-3 1Z" /></svg>;
    case "social":
      return <svg {...common}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6" /><path d="m8.2 13.2 7.6 3.6" /></svg>;
    case "strike":
      return <svg {...common}><path d="M5 12h14" /><path d="M16 6.5A5 5 0 0 0 12 5c-2.2 0-4 1-4 2.6 0 3.4 8 1.7 8 5.8 0 1.6-1.8 2.6-4 2.6a6 6 0 0 1-4.6-2" /></svg>;
    case "table":
      return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16" /><path d="M4 15h16" /><path d="M10 5v14" /><path d="M16 5v14" /></svg>;
    case "text":
      return <svg {...common}><path d="M5 6h14" /><path d="M12 6v12" /><path d="M9 18h6" /></svg>;
    case "underline":
      return <svg {...common}><path d="M7 5v6a5 5 0 0 0 10 0V5" /><path d="M5 20h14" /></svg>;
    case "variable":
      return <svg {...common}><path d="M8 7H6a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h2" /><path d="M16 7h2a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 0-2 2v1a2 2 0 0 1-2 2h-2" /></svg>;
    default:
      return <svg {...common}><path d="M5 12h14" /></svg>;
  }
}
