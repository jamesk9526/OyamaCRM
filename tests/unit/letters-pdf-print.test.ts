import { afterEach, describe, expect, it, vi } from "vitest";
import { openPdfPrintView } from "@/app/components/letters/pdf-print";

afterEach(() => vi.unstubAllGlobals());

describe("letter PDF printing", () => {
  it("opens the original PDF, without printing an HTML wrapper", () => {
    const popup = { opener: {} };
    const open = vi.fn(() => popup);
    vi.stubGlobal("window", { open });
    expect(openPdfPrintView("blob:letter-proof")).toBe(true);
    expect(open).toHaveBeenCalledWith("blob:letter-proof", "_blank");
    expect(popup.opener).toBeNull();
  });

  it("lets the caller report a blocked print window", () => {
    vi.stubGlobal("window", { open: () => null });
    expect(openPdfPrintView("blob:letter-proof")).toBe(false);
  });
});
