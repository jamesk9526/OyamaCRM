import { describe, expect, it } from "vitest";
import { AVERY_5160_LAYOUT, avery5160AddressLines, avery5160SlotPosition, renderAvery5160Pdf } from "@/server/src/services/avery-labels";

describe("Avery 5160 label rendering", () => {
  it("uses the official 30-up letter sheet geometry", () => {
    expect(AVERY_5160_LAYOUT).toMatchObject({ columns: 3, rows: 10, labelsPerPage: 30, labelWidth: 189, labelHeight: 72 });
    expect(avery5160SlotPosition(0)).toMatchObject({ page: 0, row: 0, column: 0, x: 13.5, y: 36 });
    expect(avery5160SlotPosition(29)).toMatchObject({ page: 0, row: 9, column: 2, x: 409.5, y: 684 });
    expect(avery5160SlotPosition(30)).toMatchObject({ page: 1, row: 0, column: 0, x: 13.5, y: 36 });
  });

  it("formats domestic and international mailing lines", () => {
    expect(avery5160AddressLines({ name: "Joyce Batson", addressLine1: "123 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" }))
      .toEqual(["Joyce Batson", "123 Main St", "Austin, TX 78701"]);
    expect(avery5160AddressLines({ name: "North Star", addressLine1: "10 King St", addressLine2: "Suite 2", city: "Toronto", state: "ON", zip: "M5V 1A1", country: "Canada" }))
      .toEqual(["North Star", "10 King St", "Suite 2", "Toronto, ON M5V 1A1", "Canada"]);
    expect(avery5160AddressLines({ name: "Partial Address", addressLine1: "25 Rural Route", city: "", state: null, zip: undefined }))
      .toEqual(["Partial Address", "25 Rural Route"]);
  });

  it("creates additional pages after the thirtieth occupied position", async () => {
    const labels = Array.from({ length: 31 }, (_, index) => ({ name: `Donor ${index + 1}`, addressLine1: `${index + 1} Main St`, city: "Austin", state: "TX", zip: "78701" }));
    const pdf = await renderAvery5160Pdf(labels, { startPosition: 1 });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
