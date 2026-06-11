/** ContactCardBlock renders a reply-friendly staff contact card. */
"use client";

import type { ContactCardBlock as ContactCardBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: ContactCardBlockData;
}

/** Renders contact details for personal follow-up inside an email. */
export default function ContactCardBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, border: `1px solid ${block.accentColor}`, borderRadius: 8, padding: 14, color: block.textColor }}>
        <p style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>{block.heading}</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {block.imageUrl ? (
            <img src={block.imageUrl} alt={block.name} style={{ width: 56, height: 56, borderRadius: 28, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: block.accentColor, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              {block.name.trim().slice(0, 1) || "O"}
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>{block.name}</p>
            {block.role ? <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.4 }}>{block.role}</p> : null}
            {block.phone ? <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.4 }}>{block.phone}</p> : null}
            {block.email ? <p style={{ margin: "2px 0 0", fontSize: 12, lineHeight: 1.4 }}>{block.email}</p> : null}
          </div>
        </div>
        {block.note ? <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5 }}>{block.note}</p> : null}
      </div>
    </div>
  );
}
