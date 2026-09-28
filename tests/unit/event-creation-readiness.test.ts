import { describe, expect, it } from "vitest";
import { evaluateCreationReadiness, remainingPublicTicketUnits, validateCreationTicket } from "@/server/src/services/event-creation-readiness";

const input = () => ({
  event: { name: "Community night", startDate: new Date("2030-10-01"), active: true, visibility: "PUBLIC", status: "DRAFT" },
  tickets: [{ name: "Admission", price: 0, active: true, available: 5, minPerOrder: 1 }],
  sections: [{ id: "hero", enabled: true }, { id: "registration-form", enabled: true }],
  slugValid: true, slugUnique: true, paymentPolicy: "NoPaymentRequired", stripeReady: false,
  now: new Date("2030-09-01"),
});
describe("event creation readiness", () => {
  it("allows free registration without a gateway", () => expect(evaluateCreationReadiness(input()).ready).toBe(true));
  it("starts unsaved setup at registration and then design", () => {
    expect(evaluateCreationReadiness({ ...input(), tickets: [], paymentPolicy: undefined, sections: [] }).nextStep).toBe("registration");
    expect(evaluateCreationReadiness({ ...input(), sections: [] }).nextStep).toBe("design");
  });
  it("rejects paid tickets under a free policy", () => {
    const ready = evaluateCreationReadiness({ ...input(), tickets: [{ ...input().tickets[0], price: 20 }] });
    expect(ready.checks.find((check) => check.id === "policy")?.passed).toBe(false);
  });
  it.each(["PayAtEvent", "OfflineFollowUp"])("allows paid registration with %s", (paymentPolicy) => {
    expect(evaluateCreationReadiness({ ...input(), paymentPolicy, tickets: [{ ...input().tickets[0], price: 20 }] }).ready).toBe(true);
  });
  it("requires Stripe readiness and warns about sandbox mode", () => {
    expect(evaluateCreationReadiness({ ...input(), paymentPolicy: "StripeCheckout" }).ready).toBe(false);
    const ready = evaluateCreationReadiness({ ...input(), paymentPolicy: "StripeCheckout", stripeReady: true, stripeMode: "sandbox" });
    expect(ready.ready).toBe(true); expect(ready.warnings).toHaveLength(1);
  });
  it("blocks invalid dates, private events, unavailable tickets and address conflicts", () => {
    expect(evaluateCreationReadiness({ ...input(), event: { ...input().event, endDate: new Date("2029-01-01") } }).nextStep).toBe("details");
    expect(evaluateCreationReadiness({ ...input(), event: { ...input().event, visibility: "PRIVATE" } }).ready).toBe(false);
    expect(evaluateCreationReadiness({ ...input(), tickets: [{ ...input().tickets[0], available: 0 }] }).ready).toBe(false);
    expect(evaluateCreationReadiness({ ...input(), slugUnique: false }).ready).toBe(false);
    expect(evaluateCreationReadiness({ ...input(), slugValid: false }).ready).toBe(false);
  });
  it("blocks expired registration and invalid table packages", () => {
    expect(evaluateCreationReadiness({ ...input(), event: { ...input().event, registrationDeadline: new Date("2030-08-01") } }).ready).toBe(false);
    expect(evaluateCreationReadiness({ ...input(), tickets: [{ ...input().tickets[0], isTable: true, seatsIncluded: 8, minPerOrder: 7 }] }).ready).toBe(false);
    expect(evaluateCreationReadiness({ ...input(), tickets: [{ ...input().tickets[0], isTable: true, seatsIncluded: 8 }] }).ready).toBe(true);
    expect(evaluateCreationReadiness({ ...input(), tickets: [{ ...input().tickets[0], isTable: false, seatsIncluded: 2, capacity: 3, minPerOrder: 2 }] }).ready).toBe(false);
  });
});
describe("public ticket availability", () => {
  it("counts couples tickets in guest seats while inventory counts ticket units", () => {
    const ticket = { seatsIncluded: 2, capacity: 6, available: 5 };
    expect(remainingPublicTicketUnits(ticket, 0, 20)).toBe(3);
    expect(remainingPublicTicketUnits(ticket, 4, 20)).toBe(1);
    expect(remainingPublicTicketUnits(ticket, 4, 1)).toBe(0);
    expect(remainingPublicTicketUnits({ seatsIncluded: 1, capacity: null, available: null }, 0, null)).toBeNull();
  });
});
describe("ticket validation", () => {
  it.each([{ name: "", price: 0 }, { name: "Ticket", price: -1 }, { name: "Ticket", price: "bad" }, { name: "Ticket", price: true }, { name: "Ticket", price: " " }, { name: "Ticket", price: [] }, { name: "Ticket", price: 0, capacity: 1.5 }, { name: "Ticket", price: 0, minPerOrder: 5, maxPerOrder: 3 }, { name: "Table", price: 0, isTable: true, seatsIncluded: 51 }, { name: "Couples", price: 0, isTable: false, seatsIncluded: 51 }])("rejects invalid ticket %j", (ticket) => expect(validateCreationTicket(ticket)).toBeTruthy());
});
