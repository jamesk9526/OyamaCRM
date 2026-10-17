import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileEventStripePayment } from "@/server/src/services/event-stripe-reconciliation";
const db = vi.hoisted(() => ({ eventOrder: { findFirst: vi.fn(), updateMany: vi.fn() }, eventGuest: { updateMany: vi.fn() }, activity: { create: vi.fn() }, $transaction: vi.fn() }));
const runtime = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/services/payment-gateway-settings", () => ({ readPaymentGatewayRuntimeConfig: runtime }));
const session = () => ({ id: "cs_live_saved", mode: "payment", status: "complete", payment_status: "paid", livemode: true, amount_total: 5000, currency: "usd", metadata: { platform: "oyamacrm_event_registration", eventOrderId: "order-1", eventId: "event-1", organizationId: "org-1" }, payment_intent: { id: "pi_paid", status: "succeeded", latest_charge: { paid: true, refunded: false, amount_refunded: 0 } } });
beforeEach(() => {
 vi.resetAllMocks();
 db.eventOrder.findFirst.mockResolvedValue({ id: "order-1", eventId: "event-1", constituentId: "person-1", orderNumber: "EV-1", status: "PENDING", paidAt: null, totalAmount: 50, transactionId: "stripe:checkout:cs_live_saved" });
 db.eventOrder.updateMany.mockResolvedValue({ count: 1 });
 db.$transaction.mockImplementation((fn) => fn(db));
 runtime.mockResolvedValue({ currency: "USD", stripe: { environments: { production: { secretKey: "sk_live_fixture" } } } });
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => session() }));
});
afterEach(() => vi.unstubAllGlobals());
describe("Stripe order reconciliation", () => {
 it("settles a verified Stripe session and all linked guests atomically", async () => {
  expect(await reconcileEventStripePayment("org-1", "order-1")).toBe("paid");
  expect(db.eventOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order-1", event: { organizationId: "org-1" } } }));
  expect(db.eventOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "PENDING", paidAt: null, transactionId: "stripe:checkout:cs_live_saved", totalAmount: 50 }) }));
  expect(db.eventGuest.updateMany).toHaveBeenCalledWith({ where: { orderId: "order-1", eventId: "event-1" }, data: { paymentStatus: "PAID", rsvpStatus: "CONFIRMED" } });
  expect(db.activity.create).toHaveBeenCalledOnce();
 });
 it("leaves unpaid sessions due", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ...session(), payment_status: "unpaid" }) } as Response);
  expect(await reconcileEventStripePayment("org-1", "order-1")).toBe("unpaid");
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it.each([{ amount_total: 1 }, { currency: "eur" }, { livemode: false }, { id: "cs_live_other" }, { metadata: { ...session().metadata, eventOrderId: "other" } }, { payment_intent: { ...session().payment_intent, latest_charge: { paid: true, amount_refunded: 100, refunded: false } } }])("rejects mismatched or refunded evidence %j", async (patch) => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ...session(), ...patch }) } as Response);
  await expect(reconcileEventStripePayment("org-1", "order-1")).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it("does not overwrite a concurrent cancellation or duplicate settlement", async () => {
  db.eventOrder.updateMany.mockResolvedValue({ count: 0 });
  expect(await reconcileEventStripePayment("org-1", "order-1")).toBe("changed");
  expect(db.eventGuest.updateMany).not.toHaveBeenCalled();
  expect(db.activity.create).not.toHaveBeenCalled();
 });
 it("rejects inaccessible orders before contacting Stripe", async () => {
  db.eventOrder.findFirst.mockResolvedValue(null);
  await expect(reconcileEventStripePayment("org-1", "order-1")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
 });
 it("does not guess a payment from an email or an order without a saved session", async () => {
  const order = await db.eventOrder.findFirst();
  db.eventOrder.findFirst.mockResolvedValue({ ...order, transactionId: null });
  await expect(reconcileEventStripePayment("org-1", "order-1")).rejects.toThrow(/saved Stripe checkout/);
  expect(fetch).not.toHaveBeenCalled();
 });
 it("keeps the order unchanged when Stripe is unavailable", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Network failed"));
  await expect(reconcileEventStripePayment("org-1", "order-1")).rejects.toThrow(/could not be reached/);
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it("does not call Stripe when the matching environment has no credentials", async () => {
  runtime.mockResolvedValue({ stripe: { environments: { production: { secretKey: "" } } } });
  await expect(reconcileEventStripePayment("org-1", "order-1")).rejects.toThrow(/credentials/);
  expect(fetch).not.toHaveBeenCalled();
 });
 it("does not retry or overwrite an already settled order", async () => {
  const order = await db.eventOrder.findFirst();
  db.eventOrder.findFirst.mockResolvedValue({ ...order, status: "CONFIRMED", paidAt: new Date() });
  expect(await reconcileEventStripePayment("org-1", "order-1")).toBe("changed");
  expect(fetch).not.toHaveBeenCalled();
 });

});
