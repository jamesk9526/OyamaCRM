import { describe, expect, it } from "vitest";
import { mergeEventPageSections } from "@/app/components/events/page-builder/section-config";

describe("shared event page section hydration", () => {
  it("starts a fresh page with the four creation sections", () => {
    expect(mergeEventPageSections(null).filter((section) => section.enabled).map((section) => section.id)).toEqual(["hero", "event-details", "registration-form", "footer"]);
  });
  it("preserves custom order/content and does not enable omitted sections", () => {
    const sections = mergeEventPageSections([
      { id: "footer", enabled: true, lockToEventData: false, content: { heading: "Custom footer" } },
      { id: "hero", enabled: false, lockToEventData: true, design: { backgroundColor: "#ffffff" } },
    ]);
    expect(sections.slice(0, 2).map((section) => section.id)).toEqual(["footer", "hero"]);
    expect(sections[0].content?.heading).toBe("Custom footer");
    expect(sections.filter((section) => section.enabled).map((section) => section.id)).toEqual(["footer"]);
    expect(sections[1].design?.backgroundColor).toBe("#ffffff");
  });
});
