/** CalloutBlock renders highlighted narrative content with visual emphasis. */
"use client";

import type { CalloutBlock as CalloutBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: CalloutBlockData;
}

/** Renders a callout card useful for stories, key reminders, and urgency framing. */
export default function CalloutBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, borderLeft: `4px solid ${block.borderColor}`, borderRadius: 8, padding: "14px 16px", color: block.textColor }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.4, fontWeight: 700 }}>{block.title}</p>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6 }}>{block.body}</p>
      </div>
    </div>
  );
}
