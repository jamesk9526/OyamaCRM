/** Reusable button/link primitive for workspace ribbon actions. */
import Link from "next/link";
import type { ReactNode } from "react";

interface WorkspaceRibbonButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  accentTone?: "green" | "blue" | "amber";
}

function AutoRibbonIcon({ label }: { label: string }) {
  const key = label.toLowerCase();

  if (key.includes("new") || key.includes("create") || key.includes("generate")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (key.includes("review") || key.includes("check") || key.includes("validate")) {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.2 4.2L19 7" />
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
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
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
  disabled = false,
  accentTone = "green",
}: WorkspaceRibbonButtonProps) {
  const primaryTone = accentTone === "blue"
    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
    : accentTone === "amber"
      ? "border-amber-600 bg-amber-600 text-white hover:bg-amber-700"
    : "border-green-600 bg-green-600 text-white hover:bg-green-700";

  const tone = variant === "primary"
    ? primaryTone
    : variant === "ghost"
      ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

  const iconNode = icon ?? <AutoRibbonIcon label={label} />;
  const className = `inline-flex min-h-[62px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold leading-tight transition-colors ${tone} ${disabled ? "cursor-not-allowed opacity-60" : ""}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={className} title={label}>
        <span className="inline-flex h-5 w-5 items-center justify-center">{iconNode}</span>
        <span className="line-clamp-2">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} title={label}>
      <span className="inline-flex h-5 w-5 items-center justify-center">{iconNode}</span>
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}
