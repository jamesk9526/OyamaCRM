import { describe, expect, it } from "vitest";
import { shouldRedirectToCreate } from "@/app/lib/create-routing";

describe("standalone communications access during Create validation", () => {
  it.each([
    "/oyama-letters", "/oyama-letters/templates", "/oyama-letters/templates/new",
    "/oyama-letters/templates/original", "/oyama-letters/templates/original/publish",
    "/oyama-letters/generate", "/oyama-letters/generated", "/oyama-letters/labels", "/oyama-letters/settings",
    "/oyama-email", "/oyama-email/templates", "/oyama-email/templates/original/builder",
    "/oyama-email/templates/original/publish", "/oyama-email/campaigns/new",
    "/oyama-email/campaigns/original", "/oyama-email/queue", "/oyama-email/settings",
    "/oyama-create", "/oyama-create/library", "/communications",
  ])("keeps %s in its requested workspace", path => {
    expect(shouldRedirectToCreate(path, null)).toBe(false);
  });
  it("retains existing campaign routing and explicit legacy overrides", () => {
    expect(shouldRedirectToCreate("/campaigns/original", null)).toBe(true);
    expect(shouldRedirectToCreate("/communications/original", null)).toBe(true);
    expect(shouldRedirectToCreate("/campaigns/original", "1")).toBe(false);
  });
});
