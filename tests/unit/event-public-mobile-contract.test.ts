import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("public event mobile experience", () => {
  it("keeps the published document viewport-safe and safe-area aware", () => {
    const publicPage = read("app/components/events/public/PublicEventPage.tsx");
    const document = read("app/components/events/page-builder/EventPageBuilderPreview.tsx");
    const globals = read("app/globals.css");

    expect(publicPage).toContain("overflow-x-clip");
    expect(publicPage).toContain("pb-24");
    expect(document).toContain("env(safe-area-inset-bottom)");
    expect(document).toContain("registrationInView");
    expect(document).toContain("pointer-events-none translate-y-full opacity-0");
    expect(globals).toContain("overflow-wrap: anywhere");
  });

  it("keeps registration choices readable and touchable on narrow phones", () => {
    const registration = read("app/components/events/public/PublicEventRegistrationForm.tsx");

    expect(registration).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(registration).toContain("min-h-[72px]");
    expect(registration).toContain("h-5 w-5");
    expect(registration).toContain("sm:rounded-xl sm:border-x");
    expect(registration).toContain("break-all font-mono");
  });

  it("uses mobile grids and deferred media for public content blocks", () => {
    const document = read("app/components/events/page-builder/EventPageBuilderPreview.tsx");

    expect(document).toContain("grid grid-cols-2 gap-px");
    expect(document).toContain("grid grid-cols-2 gap-2 sm:grid-cols-4");
    expect(document).toContain('loading="lazy"');
    expect(document).toContain("aspect-[16/10]");
  });
});
