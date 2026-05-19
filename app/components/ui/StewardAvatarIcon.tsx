/** Reusable minimal Steward mark used across assistant surfaces. */

interface StewardAvatarIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

/** Renders a plain custom SVG mark for Steward without using the character artwork. */
export default function StewardAvatarIcon({ size = 24, className = "", alt = "Steward" }: StewardAvatarIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/15 bg-black text-white ${className}`.trim()}
      style={{ width: size, height: size }}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-[72%] w-[72%]"
        fill="none"
      >
        <path
          d="M16 4.5c6.35 0 11.5 5.15 11.5 11.5S22.35 27.5 16 27.5 4.5 22.35 4.5 16 9.65 4.5 16 4.5Z"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.92"
        />
        <path
          d="M10.2 17.9c0-4.75 3.38-7.55 7.15-7.55 2.9 0 5.15 1.66 5.15 4.08 0 4.18-6.12 3.48-6.12 6.17 0 1.16.96 1.88 2.34 1.88 1.5 0 2.74-.7 3.72-1.78"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.1 21.7c1.06-1.2 2.43-1.82 4.08-1.82"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
