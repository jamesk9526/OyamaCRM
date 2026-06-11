/** EventDetailsBlock renders a concise event invitation section. */
"use client";

import type { EventDetailsBlock as EventDetailsBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: EventDetailsBlockData;
}

/** Shows event metadata in a scannable email block with an optional RSVP link. */
export default function EventDetailsBlock({ block }: Props) {
  const details = [
    ["Date", block.date],
    ["Time", block.time],
    ["Location", block.location],
  ];

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, border: `1px solid ${block.accentColor}`, borderRadius: 8, padding: 16, color: block.textColor }}>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.3, fontWeight: 700 }}>{block.title}</p>
        {block.description ? <p style={{ margin: "7px 0 0", fontSize: 14, lineHeight: 1.55 }}>{block.description}</p> : null}
        <div style={{ marginTop: 12 }}>
          {details.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 10, padding: "7px 0", borderTop: `1px solid ${block.accentColor}26` }}>
              <span style={{ fontSize: 12, lineHeight: 1.4, fontWeight: 700, color: block.accentColor, textTransform: "uppercase" }}>{label}</span>
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>{value}</span>
            </div>
          ))}
        </div>
        {block.ctaLabel && block.ctaUrl ? (
          <a href={block.ctaUrl} style={{ display: "inline-block", marginTop: 12, backgroundColor: block.accentColor, color: "#ffffff", textDecoration: "none", fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: 6 }}>
            {block.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
