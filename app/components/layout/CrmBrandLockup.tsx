import Image from "next/image";
import { OYAMA_PRODUCT_LOGO } from "@/app/lib/product-branding";

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
  const labelClass = tone === "light" ? "text-emerald-100/90" : "text-slate-500";
  const logoFrameClass = tone === "light"
    ? "bg-emerald-950/40 ring-1 ring-emerald-100/20"
    : "bg-slate-950 ring-1 ring-slate-900/10";

  return (
    <div className={`${compact ? "flex flex-col items-center gap-1.5" : "flex flex-col items-start gap-2"} ${className}`.trim()}>
      <div className={`inline-flex items-center justify-center rounded-xl px-3 py-1.5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)] ${logoFrameClass}`}>
        <Image
          src={OYAMA_PRODUCT_LOGO}
          alt={`OyamaCRM ${moduleLabel}`}
          width={300}
          height={100}
          className={compact ? "h-9 w-auto object-contain" : "h-11 w-auto object-contain"}
        />
      </div>
      <p
        className={`text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] ${labelClass} ${compact ? "text-center" : "pl-1"}`}
        style={{ fontFamily: BRAND_LABEL_FONT_STACK }}
      >
        {moduleLabel}
      </p>
    </div>
  );
}