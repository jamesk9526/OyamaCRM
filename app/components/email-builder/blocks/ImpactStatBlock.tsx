/** ImpactStatBlock highlights one key fundraising or ministry metric on the canvas. */
"use client";

import type { ImpactStatBlock as ImpactStatBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: ImpactStatBlockData;
}

/** Renders a metric card that emphasizes value-first storytelling for donor communications. */
export default function ImpactStatBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div
        style={{
          backgroundColor: block.bgColor,
          color: block.textColor,
          borderRadius: 8,
          padding: "16px 14px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 700 }}>{block.value}</p>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.35, fontWeight: 600 }}>{block.label}</p>
        {block.sublabel && (
          <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.35, opacity: 0.9 }}>{block.sublabel}</p>
        )}
      </div>
    </div>
  );
}
