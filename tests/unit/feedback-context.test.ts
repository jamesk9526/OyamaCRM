/** Unit tests for privacy-safe feedback context capture helpers. */

import { describe, expect, it } from "vitest";
import { getFeedbackContext } from "@/app/lib/feedback/getFeedbackContext";

describe("feedback context helpers", () => {
  it("builds fallback context when browser globals are unavailable", () => {
    const context = getFeedbackContext({ moduleKey: "donor", pathname: "/donations/new" });

    expect(context.crmScope).toBe("donor");
    expect(context.routePath).toBe("/donations/new");
    expect(context.pageUrl).toContain("/donations/new");
    expect(context.browserInfo).toBeTypeOf("string");
    expect(context.deviceInfo).toBeTypeOf("string");
  });

  it("maps reportit module key into reportit scope for ticket payloads", () => {
    const context = getFeedbackContext({ moduleKey: "oshareview", pathname: "/reports" });
    expect(context.crmScope).toBe("reportit");
  });
});
