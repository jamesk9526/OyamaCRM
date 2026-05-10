/** AiButtonBlock renders an AI-generated call-to-action button for donor messaging. */
"use client";

import type { AiButtonBlock as AiButtonBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: AiButtonBlockData;
}

/** Renders an AI CTA button while keeping style controls editable in the block editor. */
export default function AiButtonBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, textAlign: block.align }}>
      <span
        style={{
          display: "inline-block",
          backgroundColor: block.bgColor,
          color: block.textColor,
          padding: "12px 28px",
          borderRadius: block.borderRadius,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {block.label}
      </span>
    </div>
  );
}
