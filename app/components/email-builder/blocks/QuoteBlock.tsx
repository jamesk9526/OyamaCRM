/** QuoteBlock renders a donor testimonial style section on the email canvas. */
"use client";

import type { QuoteBlock as QuoteBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: QuoteBlockData;
}

/** Renders a quote block with attribution and nonprofit-friendly visual emphasis. */
export default function QuoteBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, textAlign: block.align }}>
      <blockquote
        style={{
          margin: 0,
          borderLeft: "4px solid #16a34a",
          background: "#f8fafc",
          padding: "12px 14px",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "#1f2937", fontStyle: "italic" }}>
          "{block.quote}"
        </p>
        {block.attribution && (
          <footer style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
            {block.attribution}
          </footer>
        )}
      </blockquote>
    </div>
  );
}
