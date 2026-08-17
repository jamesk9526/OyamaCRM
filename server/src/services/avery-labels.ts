import type { jsPDF as JsPdfDocument } from "jspdf";

export const AVERY_5160_LAYOUT = {
  columns: 3,
  rows: 10,
  labelsPerPage: 30,
  pageWidth: 612,
  pageHeight: 792,
  labelWidth: 189,
  labelHeight: 72,
  leftMargin: 13.5,
  topMargin: 36,
  horizontalGap: 9,
} as const;

export interface Avery5160Label {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export function avery5160SlotPosition(slotIndex: number): { page: number; row: number; column: number; x: number; y: number } {
  const pageSlot = ((slotIndex % AVERY_5160_LAYOUT.labelsPerPage) + AVERY_5160_LAYOUT.labelsPerPage) % AVERY_5160_LAYOUT.labelsPerPage;
  const row = Math.floor(pageSlot / AVERY_5160_LAYOUT.columns);
  const column = pageSlot % AVERY_5160_LAYOUT.columns;
  return {
    page: Math.floor(Math.max(0, slotIndex) / AVERY_5160_LAYOUT.labelsPerPage),
    row,
    column,
    x: AVERY_5160_LAYOUT.leftMargin + column * (AVERY_5160_LAYOUT.labelWidth + AVERY_5160_LAYOUT.horizontalGap),
    y: AVERY_5160_LAYOUT.topMargin + row * AVERY_5160_LAYOUT.labelHeight,
  };
}

export function avery5160AddressLines(label: Avery5160Label): string[] {
  const locality = [label.city?.trim(), label.state?.trim()].filter(Boolean).join(", ");
  const cityStateZip = [locality, label.zip?.trim()].filter(Boolean).join(" ");
  const country = label.country?.trim();
  return [label.name, label.addressLine1, label.addressLine2, cityStateZip, country && country.toUpperCase() !== "US" && country.toUpperCase() !== "USA" ? country : null]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

/** Renders production-sized Avery 5160 sheets in points (72 points per inch). */
export async function renderAvery5160Pdf(labels: Avery5160Label[], options?: { startPosition?: number; showGuides?: boolean }): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
  const startSlot = Math.max(0, Math.min(29, Math.trunc((options?.startPosition ?? 1) - 1)));
  let activePage = 0;

  const drawGuideSheet = () => {
    if (!options?.showGuides) return;
    doc.setDrawColor(185, 185, 185);
    doc.setLineWidth(0.35);
    for (let slot = 0; slot < AVERY_5160_LAYOUT.labelsPerPage; slot += 1) {
      const position = avery5160SlotPosition(slot);
      doc.rect(position.x, position.y, AVERY_5160_LAYOUT.labelWidth, AVERY_5160_LAYOUT.labelHeight);
    }
  };
  drawGuideSheet();

  for (let index = 0; index < labels.length; index += 1) {
    const slotIndex = startSlot + index;
    const position = avery5160SlotPosition(slotIndex);
    while (activePage < position.page) {
      doc.addPage("letter", "portrait");
      activePage += 1;
      drawGuideSheet();
    }

    const lines = avery5160AddressLines(labels[index]).slice(0, 5);
    const lineHeight = 10.5;
    const blockHeight = lines.length * lineHeight;
    let textY = position.y + Math.max(12, (AVERY_5160_LAYOUT.labelHeight - blockHeight) / 2 + 8);
    const textX = position.x + 9;
    const maxWidth = AVERY_5160_LAYOUT.labelWidth - 18;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      doc.setFont("helvetica", lineIndex === 0 ? "bold" : "normal");
      let fontSize = lineIndex === 0 ? 9.5 : 9;
      doc.setFontSize(fontSize);
      while (doc.getTextWidth(lines[lineIndex]) > maxWidth && fontSize > 6.5) {
        fontSize -= 0.25;
        doc.setFontSize(fontSize);
      }
      (doc.text as unknown as (value: string, x: number, y: number) => JsPdfDocument)
        .call(doc, lines[lineIndex], textX, textY);
      textY += lineHeight;
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
