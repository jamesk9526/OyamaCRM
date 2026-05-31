"use client";

interface OyamaAdvancedIconProps {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}

const SPECIAL_VIEWBOX_NAMES = new Set([
  "steward-paths-special",
  "steward-paths-special-16",
  "steward-paths-special-24",
  "steward-paths-special-32",
  "steward-paths-special-48",
  "steward-paths-special-64",
  "steward-paths-special-128",
  "steward-paths-special-256",
]);

/**
 * Renders icons from the advanced sprite at public/icons/oyama-crm-advanced/sprite/oyama-icons-sprite.svg.
 */
export default function OyamaAdvancedIcon({ name, size = 18, className, title }: OyamaAdvancedIconProps) {
  const viewBox = SPECIAL_VIEWBOX_NAMES.has(name) ? "0 0 512 512" : "0 0 48 48";

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={`/icons/oyama-crm-advanced/sprite/oyama-icons-sprite.svg#oyama-${name}`} />
    </svg>
  );
}
