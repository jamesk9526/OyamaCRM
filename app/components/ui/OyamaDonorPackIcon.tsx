"use client";

interface OyamaDonorPackIconProps {
  slug: string;
  size?: number;
  className?: string;
  alt?: string;
  title?: string;
}

/**
 * Renders one icon from the donor CRM icon pack copied to public/icons/oyama-donor-crm/svg.
 */
export default function OyamaDonorPackIcon({
  slug,
  size = 18,
  className,
  alt = "",
  title,
}: OyamaDonorPackIconProps) {
  return (
    <img
      src={`/icons/oyama-donor-crm/svg/${slug}.svg`}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
      aria-hidden={alt ? undefined : true}
    />
  );
}
