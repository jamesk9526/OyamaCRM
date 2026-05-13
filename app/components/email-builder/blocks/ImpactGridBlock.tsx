/** ImpactGridBlock renders multiple ministry metrics in one high-signal card. */
"use client";

import type { ImpactGridBlock as ImpactGridBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: ImpactGridBlockData;
}

/** Renders a responsive metric grid inspired by dashboard-style content builders. */
export default function ImpactGridBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, border: `1px solid ${block.accentColor}`, borderRadius: 10, overflow: "hidden" }}>
        {block.title && (
          <p style={{ margin: 0, padding: "14px 14px 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: block.textColor }}>
            {block.title}
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, block.items.length))}, minmax(0, 1fr))`, marginTop: block.title ? 10 : 0 }}>
          {block.items.slice(0, 4).map((item, index) => (
            <div key={`${item.label}-${index}`} style={{ padding: "12px 10px", textAlign: "center", borderRight: index < block.items.length - 1 ? `1px solid ${block.accentColor}33` : "none" }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: block.textColor }}>{item.value}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.4, color: block.textColor, opacity: 0.9 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
