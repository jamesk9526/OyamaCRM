"use client";

import { useEffect, useState } from "react";
import { createDefaultEventPageSectionState } from "@/app/components/events/page-builder/section-config";
import { EventPageDocument } from "@/app/components/events/page-builder/EventPageBuilderPreview";
import type {
  EventBuilderEventDetail,
  EventBuilderReport,
  EventBuilderSponsor,
  EventBuilderTicketType,
  EventPageSectionState,
} from "@/app/components/events/page-builder/types";

interface PublicEventPagePayload {
  event: EventBuilderEventDetail & {
    status?: string | null;
    active?: boolean | null;
  };
  ticketTypes: EventBuilderTicketType[];
  sponsors: EventBuilderSponsor[];
  report: EventBuilderReport | null;
  pageSlug: string;
  pageUrl: string;
  status: "Draft" | "Published";
  paymentPolicy?: "OfflineFollowUp" | "NoPaymentRequired";
  sections: EventPageSectionState[] | null;
}

interface PublicEventPageProps {
  pageSlug: string;
}

async function loadPublicEventPage(pageSlug: string): Promise<PublicEventPagePayload | null> {
  try {
    const response = await fetch(`/api/events/public/page/${encodeURIComponent(pageSlug)}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as PublicEventPagePayload;
  } catch {
    return null;
  }
}

function mergePublicSections(savedSections: EventPageSectionState[] | null | undefined): EventPageSectionState[] {
  const defaults = createDefaultEventPageSectionState();
  if (!savedSections?.length) return defaults;
  const defaultById = new Map(defaults.map((section) => [section.id, section]));
  const savedIds = new Set(savedSections.map((section) => section.id));
  return [
    ...savedSections.map((section) => ({
      ...(defaultById.get(section.id) ?? section),
      ...section,
      content: { ...(defaultById.get(section.id)?.content ?? {}), ...(section.content ?? {}) },
      design: { ...(defaultById.get(section.id)?.design ?? {}), ...(section.design ?? {}) },
      advanced: { ...(defaultById.get(section.id)?.advanced ?? {}), ...(section.advanced ?? {}) },
    })),
    ...defaults.filter((section) => !savedIds.has(section.id)),
  ];
}

/**
 * PublicEventPage renders the external-facing event page for one configured slug.
 * This route is intentionally outside CRM workspace auth so organizations can share it publicly.
 */
export default function PublicEventPage({ pageSlug }: PublicEventPageProps) {
  const [payload, setPayload] = useState<PublicEventPagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const data = await loadPublicEventPage(pageSlug);
      if (!active) return;
      setPayload(data);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [pageSlug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-emerald-50 text-slate-900">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Event Page</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Loading event page...</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-emerald-50 text-slate-900">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Event Page</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">This event page is unavailable right now.</h1>
            <p className="mt-3 text-sm text-slate-600">
              The page may be unpublished, the slug may be invalid, or the event API may be temporarily unavailable.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const event = payload.event;
  const ticketTypes = payload.ticketTypes ?? [];
  const sponsors = payload.sponsors ?? [];
  const report = payload.report;
  const sections = mergePublicSections(payload.sections);

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EventPageDocument
          sections={sections}
          data={{
            event,
            ticketTypes,
            sponsors,
            report,
            publicUrl: payload.pageUrl,
            paymentPolicy: payload.paymentPolicy ?? "OfflineFollowUp",
            pageSlug: payload.pageSlug,
            isPublicRegistration: true,
          }}
        />
      </section>
    </main>
  );
}
