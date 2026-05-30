/** Reusable minimal Steward mark used across assistant surfaces. */

interface StewardAvatarIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

/** Renders a generic AI glyph so assistant surfaces do not use character-specific branding. */
export default function StewardAvatarIcon({ size = 24, className = "", alt = "Steward" }: StewardAvatarIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15 bg-slate-900 text-white ${className}`.trim()}
      style={{ width: size, height: size }}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-[74%] w-[74%]"
        fill="none"
      >
        <rect x="8" y="9" width="16" height="14" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="13" cy="16" r="1.4" fill="currentColor" />
        <circle cx="19" cy="16" r="1.4" fill="currentColor" />
        <path d="M13 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 5.5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 13.5H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M26 13.5h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
