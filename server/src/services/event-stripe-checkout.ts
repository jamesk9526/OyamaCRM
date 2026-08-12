import { readPaymentGatewayRuntimeConfig } from "./payment-gateway-settings.js";

interface CreateEventStripeCheckoutInput {
  organizationId: string;
  eventId: string;
  eventName: string;
  orderId: string;
  orderNumber: string;
  pageSlug: string;
  buyerEmail: string;
  ticketName: string;
  quantity: number;
  totalAmount: number;
  returnOrigin: string;
}

export class EventStripeCheckoutError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "EventStripeCheckoutError";
  }
}

export async function createEventStripeCheckout(input: CreateEventStripeCheckoutInput): Promise<{
  checkoutUrl: string;
  sessionId: string;
  currency: string;
  mode: "sandbox" | "production";
}> {
  const runtime = await readPaymentGatewayRuntimeConfig(input.organizationId);
  if (!runtime.stripe.enabled || !runtime.stripe.secretKey || !runtime.stripe.webhookSecret) {
    throw new EventStripeCheckoutError(
      "STRIPE_NOT_READY",
      "Online payment is temporarily unavailable. Your reservation is saved and event staff can still assist with payment.",
    );
  }

  const amountCents = Math.round(input.totalAmount * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new EventStripeCheckoutError("INVALID_ORDER_TOTAL", "This order does not require an online payment.");
  }

  const origin = input.returnOrigin.replace(/\/$/, "");
  const eventPageUrl = `${origin}/${encodeURIComponent(input.pageSlug)}`;
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${eventPageUrl}?registration=payment-return&order=${encodeURIComponent(input.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${eventPageUrl}?registration=payment-cancelled&order=${encodeURIComponent(input.orderNumber)}`);
  body.set("customer_email", input.buyerEmail);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", runtime.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountCents));
  body.set("line_items[0][price_data][product_data][name]", `${input.eventName} · ${input.ticketName}`.slice(0, 127));
  body.set("line_items[0][price_data][product_data][description]", `${input.quantity} registration${input.quantity === 1 ? "" : "s"} · Order ${input.orderNumber}`.slice(0, 255));
  body.set("metadata[platform]", "oyamacrm_event_registration");
  body.set("metadata[organizationId]", input.organizationId);
  body.set("metadata[eventId]", input.eventId);
  body.set("metadata[eventOrderId]", input.orderId);
  body.set("metadata[orderNumber]", input.orderNumber);
  body.set("metadata[pageSlug]", input.pageSlug);
  body.set("payment_intent_data[metadata][platform]", "oyamacrm_event_registration");
  body.set("payment_intent_data[metadata][eventOrderId]", input.orderId);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.stripe.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `event-order-${input.orderId}`,
    },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !payload.id || !payload.url) {
    throw new EventStripeCheckoutError(
      "STRIPE_CHECKOUT_FAILED",
      payload.error?.message ?? "Stripe could not open secure checkout. Your reservation is still saved.",
    );
  }

  return {
    checkoutUrl: payload.url,
    sessionId: payload.id,
    currency: runtime.currency,
    mode: runtime.stripe.mode,
  };
}
