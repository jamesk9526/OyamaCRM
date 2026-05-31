import Image from "next/image";
import { OYAMA_PRODUCT_LOGO, OYAMA_PRODUCT_LOGO_COLLAPSED } from "@/app/lib/product-branding";

const BRAND_LABEL_FONT_STACK = '"Avenir Next", "Montserrat", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

interface CrmBrandLockupProps {
  moduleLabel: string;
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
}

export default function CrmBrandLockup({
  moduleLabel,
  tone = "dark",
  compact = false,
  className = "",
}: CrmBrandLockupProps) {
  const logoSrc = compact ? OYAMA_PRODUCT_LOGO_COLLAPSED : OYAMA_PRODUCT_LOGO;
  const labelClass = tone === "light" ? "text-emerald-100/90" : "text-slate-500";
  const logoFrameClass = compact
    ? "bg-transparent ring-0 shadow-none"
    : tone === "light"
      ? "bg-emerald-950/40 ring-1 ring-emerald-100/20"
      : "bg-slate-950 ring-1 ring-slate-900/10";

  return (
    <div className={`${compact ? "flex flex-col items-center gap-1.5" : "flex flex-col items-start gap-2"} ${className}`.trim()}>
      <div className={`inline-flex items-center justify-center ${compact ? "rounded-none px-0 py-0" : "rounded-xl px-3 py-1.5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)]"} ${logoFrameClass}`}>
        <Image
          src={logoSrc}
          alt={`OyamaCRM ${moduleLabel}`}
          width={compact ? 72 : 300}
          height={compact ? 72 : 100}
          className={compact ? "h-11 w-11 object-contain" : "h-11 w-auto object-contain"}
        />
      </div>
      <p
        className={`${compact ? "text-[9px] tracking-[0.16em]" : "text-[10px] tracking-[0.2em]"} font-semibold uppercase leading-tight ${labelClass} ${compact ? "text-center" : "pl-1"}`}
        style={{ fontFamily: BRAND_LABEL_FONT_STACK }}
      >
        {moduleLabel}
      </p>
    </div>
  );
}