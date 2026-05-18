"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  EventBuilderEventDetail,
  EventBuilderReport,
  EventBuilderSponsor,
  EventBuilderTicketType,
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
}

interface PublicEventPageProps {
  pageSlug: string;
}

function formatDateRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "Date to be announced";

  const startDateText = start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const startTimeText = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endDate) return `${startDateText} at ${startTimeText}`;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return `${startDateText} at ${startTimeText}`;

  const endTimeText = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startDateText} from ${startTimeText} to ${endTimeText}`;
}

function formatMoney(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "$0";
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sponsorDisplayName(sponsor: EventBuilderSponsor): string {
  const first = sponsor.constituent?.firstName?.trim() ?? "";
  const last = sponsor.constituent?.lastName?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  return sponsor.level ? `${sponsor.level} Sponsor` : "Sponsor";
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-emerald-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {payload.status === "Draft" ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
            Preview mode: this event page is still marked as Draft in Events CRM.
          </div>
        ) : null}

        <div className="rounded-3xl border border-rose-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">Fundraising Event</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{formatDateRange(event.startDate, event.endDate)}</p>
          <p className="text-sm text-slate-600">{event.location || "Location will be announced"}</p>
          {event.description ? <p className="mt-4 text-sm leading-6 text-slate-700">{event.description}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {event.virtualUrl ? (
              <a
                href={event.virtualUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Join Virtual Event
              </a>
            ) : null}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Share URL: {payload.pageUrl}
            </span>
          </div>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Raised</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatMoney(report?.revenue.total ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Attending</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{(report?.attendance.total ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Check-In Rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{(report?.attendance.attendanceRate ?? 0)}%</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tickets</h2>
          {ticketTypes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Ticket options will be posted soon.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ticketTypes.map((ticketType) => (
                <article key={ticketType.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{ticketType.name}</p>
                  <p className="mt-1 text-sm text-emerald-700">{formatMoney(ticketType.price)}</p>
                  {ticketType.description ? <p className="mt-2 text-xs text-slate-600">{ticketType.description}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Sponsors</h2>
          {sponsors.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Sponsor details will be announced soon.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sponsors.map((sponsor) => (
                <article key={sponsor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{sponsorDisplayName(sponsor)}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-rose-700">{sponsor.level ?? "Sponsor"}</p>
                  {sponsor.websiteUrl ? (
                    <Link href={sponsor.websiteUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                      Visit Website
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
