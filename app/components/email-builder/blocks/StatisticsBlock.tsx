/** StatisticsBlock renders key numbers as a clean email-safe grid. */
"use client";

import type { StatisticsBlock as StatisticsBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: StatisticsBlockData;
}

/** Renders a compact stat grid with optional title and supporting copy. */
export default function StatisticsBlock({ block }: Props) {
  const columnCount = block.columnCount === 3 ? 3 : 2;
  const items = block.items.slice(0, 6);

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, border: `1px solid ${block.accentColor}`, borderRadius: 8, padding: 14, color: block.textColor }}>
        {block.title ? (
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.3, fontWeight: 700 }}>{block.title}</p>
        ) : null}
        {block.intro ? (
          <p style={{ margin: block.title ? "6px 0 0" : 0, fontSize: 13, lineHeight: 1.5, opacity: 0.86 }}>{block.intro}</p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap: 8, marginTop: block.title || block.intro ? 12 : 0 }}>
          {items.map((item, index) => (
            <div key={`${item.value}-${item.label}-${index}`} style={{ backgroundColor: block.cardColor, border: `1px solid ${block.accentColor}33`, borderRadius: 8, padding: "12px 10px", minHeight: 88 }}>
              <p style={{ margin: 0, fontSize: 25, lineHeight: 1.1, fontWeight: 800, color: block.accentColor }}>{item.value}</p>
              <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.35, fontWeight: 700, color: block.textColor }}>{item.label}</p>
              {item.detail ? (
                <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.4, color: block.textColor, opacity: 0.78 }}>{item.detail}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
