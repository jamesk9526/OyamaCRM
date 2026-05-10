/** AiTextBlock renders AI-generated narrative content for stewardship emails. */
"use client";

import type { AiTextBlock as AiTextBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: AiTextBlockData;
}

/** Renders generated AI text and keeps a subtle tone badge for editor clarity. */
export default function AiTextBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, position: "relative" }}>
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 8,
          fontSize: 10,
          fontWeight: 700,
          color: "#166534",
          background: "#dcfce7",
          border: "1px solid #86efac",
          borderRadius: 999,
          padding: "2px 7px",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        AI {block.tone}
      </span>
      <div dangerouslySetInnerHTML={{ __html: block.content }} style={{ color: "#1f2937", lineHeight: 1.5 }} />
    </div>
  );
}
