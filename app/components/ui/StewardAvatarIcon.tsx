/** Reusable masked Steward character icon used across assistant surfaces. */
import Image from "next/image";

interface StewardAvatarIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders the official Steward character image in a circular mask so icon edges stay soft.
 */
export default function StewardAvatarIcon({ size = 24, className = "", alt = "Steward" }: StewardAvatarIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-emerald-200 bg-emerald-100 ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image
        src="/branding/steward-character.png"
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        style={{
          WebkitMaskImage: "radial-gradient(circle, black 79%, transparent 100%)",
          maskImage: "radial-gradient(circle, black 79%, transparent 100%)",
        }}
      />
    </span>
  );
}
