/** Unit tests for privacy-safe support ticket context capture helpers. */

import { describe, expect, it } from "vitest";
import { getSupportTicketContext } from "@/app/lib/support-tickets/context";

describe("support ticket context helpers", () => {
  it("builds fallback context when browser globals are unavailable", () => {
    const context = getSupportTicketContext({ moduleKey: "donor", pathname: "/donations/new" });

    expect(context.crmScope).toBe("donor");
    expect(context.routePath).toBe("/donations/new");
    expect(context.pageUrl).toContain("/donations/new");
    expect(context.browserInfo).toBeTypeOf("string");
    expect(context.deviceInfo).toBeTypeOf("string");
  });

  it("maps reportit module key into reportit scope for ticket payloads", () => {
    const context = getSupportTicketContext({ moduleKey: "oshareview", pathname: "/reports" });
    expect(context.crmScope).toBe("reportit");
  });

  it("keeps CRM scopes explicit for every remaining module boundary", () => {
    expect(getSupportTicketContext({ moduleKey: "letters", pathname: "/oyama-letters" }).crmScope).toBe("donor");
    expect(getSupportTicketContext({ moduleKey: "events", pathname: "/events" }).crmScope).toBe("events");
    expect(getSupportTicketContext({ moduleKey: "watchdog", pathname: "/watchdog" }).crmScope).toBe("watchdog");
    expect(getSupportTicketContext({ moduleKey: "webmaster", pathname: "/webmaster" }).crmScope).toBe("webmaster");
    expect(getSupportTicketContext({ moduleKey: "password", pathname: "/password" }).crmScope).toBe("other");
  });
});
