import { NextResponse } from "next/server";

interface PublicPageRegisterRouteContext {
  params: Promise<{ pageSlug: string }>;
}

function resolveEventsApiBaseUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000").trim();
  return raw.replace(/\/+$/, "");
}

/**
 * Proxies public event registrations through the Next app origin.
 * This keeps the unauthenticated public page form free from CORS assumptions.
 */
export async function POST(request: Request, context: PublicPageRegisterRouteContext) {
  const { pageSlug } = await context.params;
  if (!pageSlug?.trim()) {
    return NextResponse.json({ error: { code: "INVALID_SLUG", message: "pageSlug is required." } }, { status: 400 });
  }

  const apiBase = resolveEventsApiBaseUrl();
  const upstream = await fetch(`${apiBase}/api/events/public/page/${encodeURIComponent(pageSlug)}/register`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const bodyText = await upstream.text();

  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
