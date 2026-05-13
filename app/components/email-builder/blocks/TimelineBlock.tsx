/** TimelineBlock renders milestone-style outcomes in a compact narrative list. */
"use client";

import type { TimelineBlock as TimelineBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: TimelineBlockData;
}

/** Renders a simple timeline inspired by CMS timeline/list modules. */
export default function TimelineBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, color: block.textColor }}>
      {block.title && (
        <p style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>
          {block.title}
        </p>
      )}
      <div>
        {block.items.slice(0, 6).map((item, index) => (
          <div key={`${item.title}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", columnGap: 10, marginBottom: 12 }}>
            <div style={{ paddingTop: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: block.accentColor }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 700 }}>{item.title}</p>
              {item.detail && (
                <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.5, opacity: 0.92 }}>{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
