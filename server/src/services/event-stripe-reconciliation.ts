import { prisma } from "../lib/prisma.js";
import { readPaymentGatewayRuntimeConfig } from "./payment-gateway-settings.js";

export class EventStripeReconciliationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "EventStripeReconciliationError";
  }
}

/** Recover a missed confirmation using only the order's saved Stripe session. */
export async function reconcileEventStripePayment(organizationId: string, orderId: string): Promise<"paid" | "unpaid" | "changed"> {
  const order = await prisma.eventOrder.findFirst({
    where: { id: orderId, event: { organizationId } },
  });
  if (!order) throw new EventStripeReconciliationError(404, "Order not found.");
  if (order.status !== "PENDING" || order.paidAt) return "changed";
  const sessionId = order.transactionId?.match(/^stripe:checkout:(cs_(?:live|test)_[A-Za-z0-9_]+)$/)?.[1];
  if (!sessionId) throw new EventStripeReconciliationError(409, "This order has no saved Stripe checkout session. Review its payment in Stripe before recording a payment.");
  const mode = sessionId.startsWith("cs_test_") ? "sandbox" : "production";
  const runtime = await readPaymentGatewayRuntimeConfig(organizationId);
  const secretKey = runtime.stripe.environments[mode].secretKey;
  if (!secretKey) throw new EventStripeReconciliationError(503, `Stripe ${mode} credentials are unavailable.`);

  let response: Response;
  try {
    response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new EventStripeReconciliationError(502, "Stripe could not be reached. No payment was changed; try again.");
  }
  if (!response.ok) throw new EventStripeReconciliationError(502, "Stripe could not verify this checkout. Check the account credentials and session in Stripe.");
  const session = await response.json() as {
    id?: string; mode?: string; status?: string; payment_status?: string; livemode?: boolean;
    amount_total?: number; currency?: string; metadata?: Record<string, string>;
    payment_intent?: { id?: string; status?: string; latest_charge?: { paid?: boolean; refunded?: boolean; amount_refunded?: number } };
  };
  const metadata = session.metadata;
  if (session.id !== sessionId || session.mode !== "payment" || session.livemode !== (mode === "production")
    || metadata?.platform !== "oyamacrm_event_registration" || metadata.eventOrderId !== order.id
    || metadata.eventId !== order.eventId || metadata.organizationId !== organizationId
    || !Number.isSafeInteger(session.amount_total) || session.amount_total !== Math.round(Number(order.totalAmount) * 100)
    || session.currency?.toUpperCase() !== runtime.currency.toUpperCase()) {
    throw new EventStripeReconciliationError(409, "Stripe checkout details do not match this saved order. Review the payment before making changes.");
  }
  if (session.payment_status !== "paid" || session.status !== "complete") return "unpaid";
  const intent = session.payment_intent;
  const charge = intent?.latest_charge;
  if (!intent?.id || intent.status !== "succeeded" || !charge?.paid || charge.refunded !== false || charge.amount_refunded !== 0) {
    throw new EventStripeReconciliationError(409, "This payment is refunded or could not be fully verified. Review it in Stripe.");
  }
  const transactionId = `stripe:${intent.id}`;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventOrder.updateMany({
      where: { id: order.id, eventId: order.eventId, status: "PENDING", paidAt: null, transactionId: order.transactionId, totalAmount: order.totalAmount },
      data: { status: "CONFIRMED", paidAt: new Date(), transactionId, paymentMethod: "CREDIT_CARD" },
    });
    if (updated.count === 0) return "changed";
    await tx.eventGuest.updateMany({
      where: { orderId: order.id, eventId: order.eventId },
      data: { paymentStatus: "PAID", rsvpStatus: "CONFIRMED" },
    });
    await tx.activity.create({ data: {
      constituentId: order.constituentId, eventId: order.eventId, type: "EVENT_REGISTRATION",
      description: `Stripe payment verified for order ${order.orderNumber}.`,
      metadata: { source: "stripe_reconciliation", orderId: order.id, transactionId, sessionId, amount: Number(order.totalAmount) },
    } });
    return "paid";
  });
}
