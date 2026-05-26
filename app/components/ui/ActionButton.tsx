/** Shared action button with explicit hierarchy variants for workspace actions. */
import Link from "next/link";
import type { ReactNode } from "react";

type ActionVariant = "primary" | "secondary" | "ghost" | "danger";
type ActionSize = "sm" | "md";

interface ActionButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: ActionVariant;
  size?: ActionSize;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const SIZE_CLASS: Record<ActionSize, string> = {
  sm: "min-h-11 px-3 py-2 text-xs sm:h-8 sm:min-h-0 sm:py-0",
  md: "min-h-11 px-3.5 py-2 text-sm sm:h-9 sm:min-h-0 sm:py-0",
};

const VARIANT_CLASS: Record<ActionVariant, string> = {
  primary: "border-green-600 bg-green-600 text-white hover:bg-green-700 active:bg-green-800",
  secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800",
  danger: "border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

export default function ActionButton({
  label,
  href,
  onClick,
  icon,
  variant = "secondary",
  size = "sm",
  disabled = false,
  title,
  className = "",
}: ActionButtonProps) {
  const classes = [
    "inline-flex max-w-full shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-md border text-center font-medium leading-tight transition-colors",
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    disabled ? "cursor-not-allowed opacity-50" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 whitespace-normal text-balance sm:whitespace-nowrap">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} title={title ?? label} className={classes} data-mobile-touch="true">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title ?? label} className={classes} data-mobile-touch="true">
      {content}
    </button>
  );
}
