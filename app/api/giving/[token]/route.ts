import { NextResponse } from "next/server";

interface GivingRouteContext {
  params: Promise<{ token: string }>;
}

function resolveApiBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/(?:\/api)+\/?$/i, "")
    .replace(/\/+$/, "");
}

async function forward(upstream: Response): Promise<NextResponse> {
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

/** Loads one published OyamaCRM-hosted giving page without exposing private CRM APIs. */
export async function GET(_request: Request, context: GivingRouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: { code: "INVALID_TOKEN", message: "Giving page token is required." } }, { status: 400 });
  }

  const upstream = await fetch(`${resolveApiBaseUrl()}/api/site-embeds/public/donation-page?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  return forward(upstream);
}

/** Starts hosted Stripe Embedded Checkout through the same validated donation pipeline as embeds. */
export async function POST(request: Request, context: GivingRouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: { code: "INVALID_TOKEN", message: "Giving page token is required." } }, { status: 400 });
  }

  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const upstream = await fetch(`${resolveApiBaseUrl()}/api/site-embeds/public/donation-checkout-embedded`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, token, surface: "hosted" }),
    cache: "no-store",
  });
  return forward(upstream);
}
