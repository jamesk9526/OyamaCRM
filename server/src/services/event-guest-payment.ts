import type { EventGuestPaymentStatus, OrderStatus } from "@prisma/client";

interface GuestPaymentRecord {
  paymentStatus: EventGuestPaymentStatus;
  order?: { status: OrderStatus; totalAmount: unknown; paidAt: Date | null } | null;
}

/** Read the durable order settled by Stripe's verified webhook or staff payment flow.
 * A checkout/session ID alone is never evidence that money was received.
 * Standalone guests and explicit complimentary/sponsored seats retain their status.
 */
export function withOrderPaymentStatus<T extends GuestPaymentRecord>(guest: T): T {
  const { order } = guest;
  if (!order || guest.paymentStatus === "COMP" || guest.paymentStatus === "SPONSORED") return guest;
  const paymentStatus: EventGuestPaymentStatus = Number(order.totalAmount) <= 0 ? "COMP"
    : order.status === "CANCELLED" || order.status === "REFUNDED" ? "DUE"
    : order.paidAt || order.status === "CONFIRMED" ? "PAID"
    : guest.paymentStatus === "PENDING_CHECK" ? "PENDING_CHECK" : "DUE";
  return { ...guest, paymentStatus };
}
