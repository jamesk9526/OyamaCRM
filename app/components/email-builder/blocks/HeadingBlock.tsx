/** HeadingBlock renders a section intro with optional eyebrow and subtitle. */
"use client";

import type { HeadingBlock as HeadingBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: HeadingBlockData;
}

/** Renders a versatile heading block inspired by modern CMS content sections. */
export default function HeadingBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, textAlign: block.align, color: block.textColor }}>
      {block.eyebrow && (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>
          {block.eyebrow}
        </p>
      )}
      <h2 style={{ margin: block.eyebrow ? "6px 0 0" : 0, fontSize: 30, lineHeight: 1.2, fontWeight: 700 }}>
        {block.title}
      </h2>
      {block.subtitle && (
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5, opacity: 0.92 }}>
          {block.subtitle}
        </p>
      )}
    </div>
  );
}
