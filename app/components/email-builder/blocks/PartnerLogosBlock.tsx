/** PartnerLogosBlock renders sponsor or partner logos in a tidy row. */
"use client";

import type { PartnerLogosBlock as PartnerLogosBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: PartnerLogosBlockData;
}

/** Renders up to six partner logo tiles with honest empty states. */
export default function PartnerLogosBlock({ block }: Props) {
  const logos = block.logos.slice(0, 6);

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ backgroundColor: block.bgColor, border: `1px solid ${block.borderColor}`, borderRadius: 8, padding: 14, color: block.textColor }}>
        {block.title ? <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.4, fontWeight: 700 }}>{block.title}</p> : null}
        {logos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {logos.map((logo, index) => (
              <div key={`${logo.name}-${index}`} style={{ border: `1px solid ${block.borderColor}`, borderRadius: 7, minHeight: 70, padding: 10, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
                {logo.imageUrl ? (
                  <img src={logo.imageUrl} alt={logo.name} style={{ display: "block", maxWidth: "100%", maxHeight: 44, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>{logo.name}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.75 }}>Add partner logo URLs in the editor.</p>
        )}
      </div>
    </div>
  );
}
