import { describe, expect, it } from "vitest";
import {
  getDeviceCanvasClass,
  parseBuilderDocument,
  toSlug,
  calculateHealthScore,
} from "@/app/components/webmaster/editor/editor-utils";

describe("webmaster editor utils", () => {
  it("normalizes slugs", () => {
    expect(toSlug(" Home Page! 2026 ")).toBe("home-page-2026");
  });

  it("falls back to default sections when content is missing", () => {
    const parsed = parseBuilderDocument(null);
    expect(parsed.sections.length).toBeGreaterThan(0);
  });

  it("uses existing sections when document content is valid", () => {
    const parsed = parseBuilderDocument({
      version: 3,
      sections: [
        {
          id: "section-a",
          type: "hero",
          variant: "nonprofit",
          settings: {},
          blocks: [],
        },
      ],
    });

    expect(parsed.version).toBe(3);
    expect(parsed.sections[0]?.id).toBe("section-a");
  });

  it("maps device classes", () => {
    expect(getDeviceCanvasClass("desktop")).toContain("max-w-[1200px]");
    expect(getDeviceCanvasClass("tablet")).toContain("max-w-3xl");
    expect(getDeviceCanvasClass("mobile")).toContain("max-w-sm");
  });

  it("calculates health score penalties", () => {
    const result = calculateHealthScore({
      document: {
        version: 1,
        sections: [
          {
            id: "section-a",
            type: "hero",
            variant: "nonprofit",
            settings: {},
            blocks: [],
          },
        ],
      },
      pageSettings: {
        title: "Home",
        slug: "home",
        path: "/",
        status: "DRAFT",
        seoTitle: "",
        seoDescription: "",
      },
    });

    expect(result.issueCount).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeLessThan(100);
  });
});
