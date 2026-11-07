import { describe, expect, it } from "vitest";
import { compactPrintRegionHtml } from "../../server/src/oyama-create/studio/print-repair";

describe("reviewable print region corrections", () => {
  it("bounds oversized logos and removes empty paragraphs while keeping unmerged recipient fields", () => {
    const result = compactPrintRegionHtml('<div><img src="/api/public-media/branding/org/logo.png" style="width:900px;height:700px"><p><br></p><h1>Organization name</h1><p>{{donor.fullName}}</p></div>');
    expect(result).toContain("max-height:40px");
    expect(result).toContain("max-width:160px");
    expect(result).toContain("{{donor.fullName}}");
    expect(result).toContain("Organization name");
    expect(result).not.toContain("<br>");
    expect(result).not.toContain("height:700px");
  });
  it("preserves addresses and tables and strips active markup", () => {
    const result = compactPrintRegionHtml('<table><tr><td><p>{first} {last}</p><p>{{donor.addressBlock}}</p></td></tr></table><script>alert(1)</script>');
    expect(result).toContain("<table");
    expect(result).toContain("{first} {last}");
    expect(result).toContain("{{donor.addressBlock}}");
    expect(result).not.toContain("script");
  });
  it("is stable when a correction is applied again", () => {
    const input = '<p style="margin:30px;font-size:40pt">Organization</p><img src="/logo.png" style="width:900px;height:700px">';
    expect(compactPrintRegionHtml(compactPrintRegionHtml(input))).toBe(compactPrintRegionHtml(input));
  });
});
