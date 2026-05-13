/** FeatureListBlock renders concise value bullets for donor-facing updates. */
"use client";

import type { FeatureListBlock as FeatureListBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: FeatureListBlockData;
}

/** Renders a polished bullet list module inspired by popular marketing editors. */
export default function FeatureListBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, color: block.textColor }}>
      {block.title && (
        <p style={{ margin: "0 0 8px", fontSize: 16, lineHeight: 1.4, fontWeight: 700 }}>{block.title}</p>
      )}
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {block.items.slice(0, 8).map((item, index) => (
          <li key={`${item}-${index}`} style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>
            <span style={{ color: block.bulletColor, fontWeight: 700 }}>•</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
