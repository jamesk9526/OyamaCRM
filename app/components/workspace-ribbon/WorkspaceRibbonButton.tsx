/** Reusable button/link primitive for workspace ribbon actions. */
import Link from "next/link";
import type { ReactNode } from "react";

interface WorkspaceRibbonButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Marks this button as the currently active/selected state (e.g. active filter tab). */
  active?: boolean;
  disabled?: boolean;
  accentTone?: "green" | "blue" | "purple" | "amber";
  /** Accessible tooltip — defaults to label if omitted. */
  title?: string;
}

function AutoRibbonIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`).test(key);

  if (key.includes("overview") || key.includes("dashboard") || key.includes("home")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h7v6H4zM13 5.5h7v4h-7zM13 11.5h7v7h-7zM4 13.5h7v5H4z" />
      </svg>
    );
  }

  if (key.includes("steward") || key.includes("ai") || key.includes("intelligence")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l1.4 3.7L17 9l-3.6 1.3L12 14l-1.4-3.7L7 9l3.6-1.3L12 4zM6 15l.8 2.2L9 18l-2.2.8L6 21l-.8-2.2L3 18l2.2-.8L6 15zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />
      </svg>
    );
  }

  if (key.includes("giving") || key.includes("gift") || key.includes("donation") || key.includes("record")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M8 8.5h6.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H16" />
      </svg>
    );
  }

  if (key.includes("activity") || key.includes("recent") || key.includes("timeline")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h4l2-5 4 10 2-5h4" />
      </svg>
    );
  }

  if (key.includes("task")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h14M5 17h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l1.5 1.5L21 15" />
      </svg>
    );
  }

  if (key.includes("duplicate") || key.includes("dedupe") || key.includes("duplicates") || key.includes("merge")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="7.5" width="10" height="10" rx="2" />
        <rect x="9.5" y="4.5" width="10" height="10" rx="2" />
      </svg>
    );
  }

  if (key.includes("tag")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 11l7-7h7l2 2v7l-7 7-9-9z" />
        <circle cx="15.5" cy="8.5" r="1.2" />
      </svg>
    );
  }

  if (key.includes("import") || key.includes("csv") || key.includes("upload")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10M8.5 8.5L12 5l3.5 3.5" />
        <rect x="4" y="14" width="16" height="6" rx="2" />
      </svg>
    );
  }

  if (key.includes("full screen") || key.includes("fullscreen") || key.includes("expand")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 20h-4v-4" />
      </svg>
    );
  }

  if (key.includes("list builder") || key.includes("builder")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h4v4H4zM10 6h10M4 14h4v4H4zM10 14h10" />
      </svg>
    );
  }

  if (key.includes("list manager") || (key.includes("list") && key.includes("manage"))) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h12" />
        <circle cx="4.5" cy="7" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="17" r="1" />
      </svg>
    );
  }

  if (hasWord("view")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (key.includes("select") || key.includes("selection") || hasWord("clear")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12.5l2.6 2.6L16.5 9" />
      </svg>
    );
  }

  if (key.includes("list")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h11M9 12h11M9 17h11" />
        <circle cx="5" cy="7" r="1" />
        <circle cx="5" cy="12" r="1" />
        <circle cx="5" cy="17" r="1" />
      </svg>
    );
  }

  if (hasWord("open") || key.includes("workspace")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-8 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
      </svg>
    );
  }

  if (key.includes("constituent") || key.includes("client") || key.includes("donor") || key.includes("people")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  if (key.includes("campaign")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18V6l11-2v12L5 18zM16 7h3v8h-3" />
      </svg>
    );
  }

  if (key.includes("letter") || key.includes("document") || key.includes("export")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h7l3 3v13H7zM14 4v4h4M9.5 12h5M9.5 15h5" />
      </svg>
    );
  }

  if (key.includes("refresh") || key.includes("sync")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 8a7 7 0 0 0-12-2l-2 2M5 5v3h3M5 16a7 7 0 0 0 12 2l2-2M19 19v-3h-3" />
      </svg>
    );
  }

  if (key.includes("lock") || key.includes("unlock")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V8a4 4 0 0 1 8 0v2" />
      </svg>
    );
  }

  // Free-flow / masonry layout toggle — staggered columns icon
  if (key.includes("free flow") || key.includes("masonry") || key.includes("freeflow")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="9" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="15" width="6" height="5" rx="1" />
        <rect x="14" y="12" width="6" height="8" rx="1" />
      </svg>
    );
  }

  // Customize / personalize — horizontal sliders icon (distinct from the Edit Layout grid icon)
  if (key.includes("customize") || key.includes("personaliz")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // Reset / restore sizes — equal 4-grid icon communicates "normalize to default"
  if (key.includes("reset") || key.includes("restore size") || key.includes("default size")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    );
  }

  // Edit layout — dashboard grid editor icon
  if (key.includes("edit") || key.includes("layout")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h7v5H4zM13 6h7v12h-7zM4 13h7v5H4z" />
      </svg>
    );
  }

  if (key.includes("done") || key.includes("review") || key.includes("check") || key.includes("validate")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.2 4.2L19 7" />
      </svg>
    );
  }

  if (key.includes("new") || key.includes("create") || key.includes("generate") || key.includes("add")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (key.includes("schedule") || key.includes("calendar")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }

  if (key.includes("send") || key.includes("mail") || key.includes("email")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
        <rect x="3" y="6" width="18" height="12" rx="2" />
      </svg>
    );
  }

  if (key.includes("template") || key.includes("preset") || key.includes("library")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h8" />
      </svg>
    );
  }

  if (key.includes("settings") || key.includes("brand") || key.includes("setup")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

/**
 * Renders one ribbon action with consistent styling across workspaces.
 */
export default function WorkspaceRibbonButton({
  label,
  href,
  onClick,
  icon,
  variant = "secondary",
  active = false,
  disabled = false,
  accentTone = "green",
  title,
}: WorkspaceRibbonButtonProps) {
  const primaryTone =
    accentTone === "blue"
      ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
      : accentTone === "purple"
        ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800"
      : accentTone === "amber"
        ? "border-amber-600 bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800"
        : "border-green-600 bg-green-600 text-white hover:bg-green-700 active:bg-green-800";

  // Active (selected/current) secondary styling — used for filter toggles and view tabs.
  const activeTone =
    accentTone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
      : accentTone === "purple"
        ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
      : accentTone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100";

  const tone =
    variant === "primary"
      ? primaryTone
      : variant === "danger"
        ? "border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
      : active
        ? activeTone
        : variant === "ghost"
          ? "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm";

  const iconNode = icon ?? <AutoRibbonIcon label={label} />;
  const tip = title ?? label;

  const className = [
    "workspace-ribbon-command inline-flex h-7 shrink-0 items-center justify-center gap-1 min-[1360px]:gap-1.5 rounded-sm border px-1.5 min-[1360px]:px-2",
    "text-left text-xs font-medium leading-none transition-all touch-manipulation",
    tone,
    disabled ? "cursor-not-allowed opacity-50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    return (
      <Link href={href} className={className} title={tip}>
        <span className="workspace-ribbon-command-icon inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">{iconNode}</span>
        <span className="workspace-ribbon-command-label inline max-w-[11rem] truncate whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} title={tip}>
      <span className="workspace-ribbon-command-icon inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">{iconNode}</span>
      <span className="workspace-ribbon-command-label inline max-w-[11rem] truncate whitespace-nowrap">{label}</span>
    </button>
  );
}
