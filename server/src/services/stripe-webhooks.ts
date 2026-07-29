import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export interface StripeWebhookEnvelope {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

/** Produces a non-reversible audit fingerprint without retaining Stripe's payload. */
export function hashStripePayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/** Reads all timestamp and v1 values from Stripe's comma-delimited signature header. */
export function parseStripeSignatureHeader(signature: string): { timestamp: number; signatures: string[] } | null {
  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of signature.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }

  return Number.isFinite(timestamp) && timestamp > 0 && signatures.length > 0
    ? { timestamp, signatures }
    : null;
}

/** Verifies Stripe's HMAC and rejects replayed webhook deliveries outside the tolerance window. */
export function verifyStripeWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const parsed = parseStripeSignatureHeader(args.signatureHeader);
  if (!parsed || !args.webhookSecret) return false;

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - parsed.timestamp) > tolerance) return false;

  const expected = createHmac("sha256", args.webhookSecret)
    .update(`${parsed.timestamp}.${args.rawBody}`, "utf8")
    .digest();

  return parsed.signatures.some((candidate) => {
    const provided = Buffer.from(candidate, "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

/** Finds Oyama metadata on Checkout Sessions and recurring Invoice subscription details. */
export function getStripeObjectMetadata(object: Record<string, unknown>): Record<string, unknown> {
  const direct = asRecord(object.metadata);
  if (Object.keys(direct).length > 0) return direct;

  const parent = asRecord(object.parent);
  const subscriptionDetails = asRecord(parent.subscription_details);
  const parentMetadata = asRecord(subscriptionDetails.metadata);
  if (Object.keys(parentMetadata).length > 0) return parentMetadata;

  return asRecord(asRecord(object.subscription_details).metadata);
}

export function getStripeSiteToken(object: Record<string, unknown>): string {
  return String(getStripeObjectMetadata(object).siteToken ?? "").trim();
}
