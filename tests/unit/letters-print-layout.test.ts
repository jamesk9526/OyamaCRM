/** Unit tests for visual print-layout utility helpers. */
import { describe, expect, it } from "vitest";
import { bodyToPrintLayout, parsePrintLayout, printLayoutToBody } from "@/app/components/letters/print-layout-utils";

describe("letters print layout utils", () => {
  it("converts plain text body into paragraph blocks", () => {
    const blocks = bodyToPrintLayout("Hello donor\n\nThank you for your gift");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.kind).toBe("PARAGRAPH");
    expect(blocks[1]?.kind).toBe("PARAGRAPH");
  });

  it("flattens visual blocks to legacy print body text", () => {
    const output = printLayoutToBody([
      { id: "a", kind: "HEADING", content: "Tax Receipt" },
      { id: "b", kind: "PARAGRAPH", content: "Dear {{donor.firstName}}," },
      { id: "c", kind: "MERGE_TOKEN", token: "{{gift.amount}}" },
      { id: "d", kind: "DIVIDER" },
    ]);

    expect(output).toContain("TAX RECEIPT");
    expect(output).toContain("Dear {{donor.firstName}},");
    expect(output).toContain("{{gift.amount}}");
    expect(output).toContain("--------------------");
  });

  it("parses API json into safe block shapes", () => {
    const parsed = parsePrintLayout([
      { id: "x", kind: "paragraph", content: "Body" },
      { id: "y", kind: "merge_token", token: "{{donor.lastName}}" },
      { id: "z", kind: "spacer", spacerHeight: 48 },
      { id: "bad", kind: "unknown" },
    ]);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.kind).toBe("PARAGRAPH");
    expect(parsed[1]?.kind).toBe("MERGE_TOKEN");
    expect(parsed[2]?.kind).toBe("SPACER");
  });
});
