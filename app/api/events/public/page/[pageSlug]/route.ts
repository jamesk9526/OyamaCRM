import { NextResponse } from "next/server";

interface PublicPageRouteContext {
  params: Promise<{ pageSlug: string }>;
}

function resolveEventsApiBaseUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000").trim();
  return raw.replace(/\/+$/, "");
}

/**
 * Proxies public event page payload requests through the Next app origin.
 * This avoids browser CORS issues when the API is hosted on a separate origin.
 */
export async function GET(_request: Request, context: PublicPageRouteContext) {
  const { pageSlug } = await context.params;
  if (!pageSlug?.trim()) {
    return NextResponse.json({ error: { code: "INVALID_SLUG", message: "pageSlug is required." } }, { status: 400 });
  }

  const apiBase = resolveEventsApiBaseUrl();
  const upstream = await fetch(`${apiBase}/api/events/public/page/${encodeURIComponent(pageSlug)}`, {
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
