import PublicEventPage from "@/app/components/events/public/PublicEventPage";
import type { PublicEventPagePayload } from "@/app/components/events/public/PublicEventPage";
import type { Metadata } from "next";
import { cache } from "react";

interface PublicEventSlugRouteProps {
  params: Promise<{ publicEventSlug: string }>;
}

const loadPublishedEvent = cache(async (slug: string): Promise<PublicEventPagePayload | null> => {
  const apiBase = String(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${apiBase}/api/events/public/page/${encodeURIComponent(slug)}`, { cache: "no-store" });
    return response.ok ? await response.json() as PublicEventPagePayload : null;
  } catch { return null; }
});

export async function generateMetadata({ params }: PublicEventSlugRouteProps): Promise<Metadata> {
  const { publicEventSlug } = await params;
  const page = await loadPublishedEvent(publicEventSlug);
  if (!page?.event?.name) return { title: "Event unavailable", robots: { index: false, follow: false } };
  const title = `${page.event.name} | ${page.branding?.organizationName || "Event registration"}`;
  const description = page.event.description?.trim() || `Event details and registration for ${page.event.name}.`;
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  const canonical = configuredOrigin && /^https?:\/\//i.test(configuredOrigin) ? `${configuredOrigin}/${encodeURIComponent(publicEventSlug)}` : undefined;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", ...(canonical ? { url: canonical } : {}) },
    alternates: canonical ? { canonical } : undefined,
  };
}

/**
 * Public event page route at root slug URLs (for example /community-impact-conference-2029).
 */
export default async function PublicEventSlugRoute({ params }: PublicEventSlugRouteProps) {
  const resolved = await params;
  const initialPayload = await loadPublishedEvent(resolved.publicEventSlug);
  return <PublicEventPage pageSlug={resolved.publicEventSlug} initialPayload={initialPayload} />;
}
