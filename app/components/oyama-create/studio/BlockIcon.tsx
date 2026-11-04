import type { CSSProperties } from "react";

const iconCells: Record<string, number> = {
  paragraph: 0, bulletList: 0, blockquote: 0, heading: 1, image: 2,
  table: 3, studioHistory: 3, studioColumns: 4, studioColumn: 4,
  studioSignature: 5, studioField: 6, studioSalutation: 6, studioAddress: 6,
  studioCondition: 6, studioAsk: 7, studioGiving: 7, studioReceipt: 7,
  studioPledge: 7, studioResponse: 7, studioQr: 8, letterPageBreak: 9,
  letterSpacer: 9, horizontalRule: 9, studioGroup: 10, studioCallout: 10,
  studioImpact: 11, studioProgress: 11,
};

/** Generated artwork is decorative. The adjacent block name supplies its accessible label. */
export default function BlockIcon({ type }: { type: string }) {
  const cell = iconCells[type] ?? 10;
  const style: CSSProperties = { backgroundPosition: `${(cell % 4) * 100 / 3}% ${Math.floor(cell / 4) * 50}%` };
  return <span className="cs-block-icon" style={style} aria-hidden="true"/>;
}
