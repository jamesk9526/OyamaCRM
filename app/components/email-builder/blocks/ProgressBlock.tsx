/** ProgressBlock renders campaign progress with a visual goal bar. */
"use client";

import type { ProgressBlock as ProgressBlockData } from "@/app/lib/email-builder-types";

interface Props {
  block: ProgressBlockData;
}

/** Renders a progress bar module inspired by fundraising widgets in modern CRMs. */
export default function ProgressBlock({ block }: Props) {
  const safeGoal = block.goal <= 0 ? 1 : block.goal;
  const percentage = Math.max(0, Math.min(100, Math.round((block.current / safeGoal) * 100)));

  return (
    <div style={{ padding: block.padding, color: block.textColor }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{block.label}</p>
      <p style={{ margin: "6px 0 8px", fontSize: 12, lineHeight: 1.4 }}>
        ${block.current.toLocaleString()} raised of ${block.goal.toLocaleString()} goal ({percentage}%)
      </p>
      <div style={{ height: 12, backgroundColor: block.trackColor, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: 12, backgroundColor: block.barColor, borderRadius: 999 }} />
      </div>
    </div>
  );
}
