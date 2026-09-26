"use client";

import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { mergeEventPageSections } from "@/app/components/events/page-builder/section-config";
import { EventPageDocument } from "@/app/components/events/page-builder/EventPageBuilderPreview";
import type {
  EventBuilderEventDetail,
  EventBuilderReport,
  EventBuilderSponsor,
  EventBuilderTicketType,
  EventPageSectionState,
  EventPageBranding,
} from "@/app/components/events/page-builder/types";

export interface PublicEventPagePayload {
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
  paymentPolicy?: "StripeCheckout" | "PayAtEvent" | "OfflineFollowUp" | "NoPaymentRequired";
  currency?: string;
  sections: EventPageSectionState[] | null;
  branding?: EventPageBranding;
}

interface PublicEventPageProps {
  pageSlug: string;
  initialPayload?: PublicEventPagePayload | null;
}

async function loadPublicEventPage(pageSlug: string): Promise<PublicEventPagePayload> {
  const response = await fetch(`/api/events/public/page/${encodeURIComponent(pageSlug)}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("This event page is not published or the address is incorrect.");
    throw new Error("The event page is temporarily unavailable. Please try again.");
  }
  return (await response.json()) as PublicEventPagePayload;
}

/**
 * PublicEventPage renders the external-facing event page for one configured slug.
 * This route is intentionally outside CRM workspace auth so organizations can share it publicly.
 */
export default function PublicEventPage({ pageSlug, initialPayload = null }: PublicEventPageProps) {
  const [payload, setPayload] = useState<PublicEventPagePayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialPayload && attempt === 0) {
      setPayload(initialPayload);
      setLoading(false);
      return;
    }
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await loadPublicEventPage(pageSlug);
        if (active) setPayload(data);
      } catch (reason) {
        if (active) { setPayload(null); setError(reason instanceof Error ? reason.message : "The event page is unavailable."); }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [attempt, initialPayload, pageSlug]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#15191d] p-5 text-white">
        <section className="w-full max-w-lg border border-slate-700 bg-[#20262b] p-7 text-center shadow-2xl">
          <CalendarDays className="mx-auto h-7 w-7 text-amber-400" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Event Operations</p>
          <h1 className="mt-2 text-2xl font-semibold">Loading event details…</h1>
        </section>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#15191d] p-5 text-white">
        <section className="w-full max-w-lg border border-slate-700 bg-[#20262b] p-7 text-center shadow-2xl">
          <CalendarDays className="mx-auto h-7 w-7 text-amber-400" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Event page</p>
          <h1 className="mt-2 text-2xl font-semibold">This event page is unavailable.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error || "The page may be unpublished or the address may be incorrect."}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-6 inline-flex min-h-11 items-center gap-2 border border-amber-600 bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800"><RefreshCw className="h-4 w-4" />Try again</button>
        </section>
      </main>
    );
  }

  const event = payload.event;
  const ticketTypes = payload.ticketTypes ?? [];
  const sponsors = payload.sponsors ?? [];
  const report = payload.report;
  const sections = mergeEventPageSections(payload.sections);

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-white pb-24 text-slate-900 md:pb-0">
        <EventPageDocument
          sections={sections}
          data={{
            event,
            ticketTypes,
            sponsors,
            report,
            publicUrl: payload.pageUrl,
            paymentPolicy: payload.paymentPolicy ?? "OfflineFollowUp",
            currency: payload.currency ?? "USD",
            pageSlug: payload.pageSlug,
            isPublicRegistration: true,
            branding: payload.branding,
          }}
        />
    </main>
  );
}
