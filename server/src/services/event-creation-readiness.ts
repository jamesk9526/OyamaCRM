export type CreationStep = "details" | "registration" | "design" | "review";
export interface CreationCheck { id: string; label: string; passed: boolean; step: CreationStep }
export interface CreationReadiness {
  ready: boolean;
  checks: CreationCheck[];
  warnings: string[];
  nextStep: CreationStep;
}
interface Ticket {
  name: string; price: unknown; active: boolean; capacity?: number | null; available?: number | null;
  isTable?: boolean; seatsIncluded?: number; minPerOrder?: number; maxPerOrder?: number | null;
}

export function remainingPublicTicketUnits(ticket: Pick<Ticket, "capacity" | "available" | "seatsIncluded">, registeredGuests: number, remainingEventSeats: number | null): number | null {
  const seatsPerTicket = Math.max(1, ticket.seatsIncluded ?? 1);
  const limits = [ticket.available ?? Infinity];
  if (ticket.capacity != null && ticket.capacity > 0) limits.push(Math.floor(Math.max(0, ticket.capacity - registeredGuests) / seatsPerTicket));
  if (remainingEventSeats != null) limits.push(Math.floor(Math.max(0, remainingEventSeats) / seatsPerTicket));
  const remaining = Math.max(0, Math.min(...limits));
  return Number.isFinite(remaining) ? remaining : null;
}

/** Validate the merged ticket record for both create and partial updates. */
export function validateCreationTicket(ticket: Record<string, unknown>): string | null {
  if (typeof ticket.name !== "string" || !ticket.name.trim() || ticket.name.length > 160) return "Ticket name is required (160 characters or fewer).";
  const price = ticket.price;
  const numericPrice = typeof price === "number" || (typeof price === "string" && Boolean(price.trim()))
    || (typeof price === "object" && price !== null && "toNumber" in price && typeof price.toNumber === "function");
  if (!numericPrice || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 100_000_000) return "Ticket price must be a number from 0 to 100,000,000.";
  for (const key of ["capacity", "available", "seatsIncluded", "minPerOrder", "maxPerOrder"] as const) {
    const value = ticket[key];
    if (value == null) continue;
    if ((typeof value !== "number" || !Number.isInteger(value)) || Number(value) < (["capacity", "available"].includes(key) ? 0 : 1) || Number(value) > 1_000_000) return `${key} must be a valid whole number.`;
  }
  if (Number(ticket.seatsIncluded ?? 1) > 50) return "A ticket can include at most 50 guests.";
  if (Number(ticket.minPerOrder ?? 1) > Number(ticket.maxPerOrder ?? 10)) return "Minimum tickets per order cannot exceed the maximum (10 when unspecified).";
  for (const key of ["active", "isTable"] as const) if (ticket[key] !== undefined && typeof ticket[key] !== "boolean") return `${key} must be true or false.`;
  return null;
}

export function evaluateCreationReadiness(input: {
  event: { name: string; startDate: Date; endDate?: Date | null; registrationDeadline?: Date | null; active: boolean; visibility: string; status?: string };
  tickets: Ticket[];
  sections?: { id: string; enabled: boolean }[];
  slugValid: boolean; slugUnique: boolean; paymentPolicy?: string; stripeReady: boolean; stripeMode?: string;
  now?: Date;
}): CreationReadiness {
  const { event, tickets, sections = [], paymentPolicy, now = new Date() } = input;
  const active = tickets.filter((ticket) => ticket.active);
  const purchasable = active.some((ticket) => !validateCreationTicket(ticket as unknown as Record<string, unknown>)
    && (ticket.available == null || ticket.available >= (ticket.minPerOrder ?? 1))
    && ((ticket.minPerOrder ?? 1) * (ticket.seatsIncluded ?? 1) <= 50)
    && (ticket.capacity == null || ticket.capacity === 0 || ticket.capacity >= (ticket.minPerOrder ?? 1) * (ticket.seatsIncluded ?? 1)));
  const checks: CreationCheck[] = [
    { id: "details", label: "Event name and dates are valid", step: "details", passed: Boolean(event.name.trim()) && Number.isFinite(event.startDate.getTime()) && (!event.endDate || event.endDate >= event.startDate) && (!event.registrationDeadline || event.registrationDeadline <= event.startDate) },
    { id: "public", label: "Event is active and public", step: "details", passed: event.active && event.visibility === "PUBLIC" },
    { id: "open", label: "Registration window is open", step: "registration", passed: (!event.registrationDeadline || event.registrationDeadline >= now) && event.startDate >= now && (!event.status || ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)) },
    { id: "tickets", label: "An active ticket is available to purchase", step: "registration", passed: purchasable },
    { id: "policy", label: "Payment choice matches ticket prices", step: "registration", passed: ["StripeCheckout", "PayAtEvent", "OfflineFollowUp", "NoPaymentRequired"].includes(paymentPolicy ?? "") && !(paymentPolicy === "NoPaymentRequired" && active.some((ticket) => Number(ticket.price) > 0)) },
    { id: "stripe", label: "Online checkout and payment confirmation are configured", step: "registration", passed: paymentPolicy !== "StripeCheckout" || input.stripeReady },
    { id: "slug", label: "Public address is valid and available", step: "design", passed: input.slugValid && input.slugUnique },
    { id: "hero", label: "Page introduction is enabled", step: "design", passed: sections.some((section) => section.id === "hero" && section.enabled) },
    { id: "registration", label: "Registration section is enabled", step: "design", passed: sections.some((section) => section.id === "registration-form" && section.enabled) },
  ];
  const warnings = paymentPolicy === "StripeCheckout" && input.stripeMode === "sandbox" ? ["Stripe is in test mode. Guests cannot make live payments."] : [];
  return { ready: checks.every((check) => check.passed), checks, warnings, nextStep: checks.find((check) => !check.passed)?.step ?? "review" };
}
