"use client";

// Event page builder preview canvas styled as a public fundraising event page.
import { useState } from "react";
import PublicEventRegistrationForm from "@/app/components/events/public/PublicEventRegistrationForm";
import { getSectionDefinition } from "@/app/components/events/page-builder/section-config";
import type {
  EventBuilderSponsor,
  EventPageBuilderWorkspaceData,
  EventPageSectionId,
  EventPageSectionState,
} from "@/app/components/events/page-builder/types";

interface EventPageBuilderPreviewProps {
  sections: EventPageSectionState[];
  selectedSectionId: EventPageSectionId;
  data: EventPageBuilderWorkspaceData;
  onSelectSection: (sectionId: EventPageSectionId) => void;
}

interface EventPageDocumentProps {
  sections: EventPageSectionState[];
  selectedSectionId?: EventPageSectionId;
  data: EventPageBuilderWorkspaceData;
  onSelectSection?: (sectionId: EventPageSectionId) => void;
}

type PreviewDevice = "Desktop" | "Tablet" | "Mobile";

const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, string> = {
  Desktop: "max-w-6xl",
  Tablet: "max-w-3xl",
  Mobile: "max-w-[390px]",
};

function getDeviceButtonClasses(activeDevice: PreviewDevice, buttonDevice: PreviewDevice): string {
  return [
    "grid h-9 w-12 place-items-center rounded-lg border text-xs font-semibold",
    activeDevice === buttonDevice ? "border-violet-300 bg-white text-violet-700 shadow-sm" : "border-transparent text-slate-500 hover:bg-white",
  ].join(" ");
}

function formatDateTimeRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "Date not set";

  const datePart = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (!endDate) return `${datePart} • ${startTime}`;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return `${datePart} • ${startTime}`;
  return `${datePart} • ${startTime} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0";
  return `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sponsorName(sponsor: EventBuilderSponsor): string {
  const first = sponsor.constituent?.firstName?.trim() ?? "";
  const last = sponsor.constituent?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || (sponsor.level ? `${sponsor.level} Sponsor` : "Sponsor");
}

function locationLine(data: EventPageBuilderWorkspaceData): string {
  return [data.event.address, data.event.city, data.event.state].filter(Boolean).join(", ") || "Address not configured";
}

function daysUntil(startDate: string): number {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = start.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function sectionPadding(section: EventPageSectionState): string {
  return section.design?.compact ? "px-12 py-7" : "px-12 py-10";
}

function textAlignClass(section: EventPageSectionState): string {
  return section.design?.textAlign === "center" ? "text-center" : "text-left";
}

function renderHero(section: EventPageSectionState, data: EventPageBuilderWorkspaceData) {
  const content = section.content ?? {};
  const design = section.design ?? {};
  const title = content.title?.trim() || data.event.name;
  const subtitle = content.subtitle?.trim() || "Gala 2027";
  const overlay = Math.max(0, Math.min(90, design.overlayOpacity ?? 62)) / 100;
  const backgroundImage = design.backgroundImageUrl || "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1800&q=80";
  const backgroundColor = design.backgroundColor || "#120c3b";
  const backgroundStyle = design.backgroundType === "color"
    ? { background: `linear-gradient(rgba(5,7,30,${overlay}),rgba(5,7,30,${overlay + 0.08})), ${backgroundColor}` }
    : design.backgroundType === "video"
      ? { background: `linear-gradient(rgba(5,7,30,${overlay}),rgba(5,7,30,${overlay + 0.08})), ${backgroundColor}` }
      : {
          backgroundImage: `linear-gradient(rgba(5,7,30,${overlay}),rgba(5,7,30,${overlay + 0.12})), url("${backgroundImage}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };

  return (
    <section
      className="relative min-h-[410px] overflow-hidden bg-slate-950 text-white"
      style={backgroundStyle}
    >
      {design.backgroundType === "video" && design.backgroundImageUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-55"
          src={design.backgroundImageUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(168,85,247,0.32),transparent_24%),radial-gradient(circle_at_78%_26%,rgba(236,72,153,0.26),transparent_22%)]" />
      <div className="relative mx-auto flex min-h-[410px] max-w-5xl flex-col px-8 py-7">
        <nav className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-violet-300/50 bg-violet-500/18 font-bold text-violet-100">OY</div>
            <div className="font-semibold uppercase leading-4 tracking-[0.22em]">Oyama<br />Church</div>
          </div>
          <div className="hidden items-center gap-7 text-white/82 md:flex">
            <span>About</span>
            <span>Event Details</span>
            <span>Tickets & Tables</span>
            <span>Sponsors</span>
            <span>Contact</span>
          </div>
          <button type="button" className="rounded-md bg-violet-600 px-5 py-2 font-semibold text-white shadow-lg shadow-violet-950/35">
            {content.primaryButtonText || "Get Tickets"}
          </button>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-violet-200">
            {content.kicker || "Join us for a night of hope"}
          </p>
          <h1 className="mt-4 text-5xl font-light italic leading-tight tracking-normal text-white md:text-7xl">{title}</h1>
          <p className="mt-2 text-4xl font-semibold uppercase tracking-[0.12em] text-violet-400 md:text-5xl">{subtitle}</p>

          <div className="mt-7 grid gap-4 text-left text-sm text-white/92 md:grid-cols-3">
            <p><span className="font-semibold text-violet-300">Date</span><br />{formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
            <p><span className="font-semibold text-violet-300">Location</span><br />{data.event.location ?? "Location to be announced"}<br />{locationLine(data)}</p>
            <p><span className="font-semibold text-violet-300">Attire</span><br />Formal Attire<br />Black Tie Optional</p>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" className="rounded-md bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
              {content.primaryButtonText || "Get Tickets"}
            </button>
            <button type="button" className="rounded-md border border-white/35 bg-white/8 px-7 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/12">
              {content.secondaryButtonText || "View Event Details"} v
            </button>
          </div>
          {design.showScrollIndicator !== false ? <div className="mt-5 text-3xl font-light text-white/72">↓</div> : null}
        </div>
      </div>
    </section>
  );
}

function renderSection(section: EventPageSectionState, data: EventPageBuilderWorkspaceData) {
  const report = data.report;
  const tableTicketTypes = data.ticketTypes.filter((ticketType) => ticketType.isTable);
  const goal = Number(report?.revenue.goal ?? data.event.revenueGoal ?? 0);
  const raised = Number(report?.revenue.total ?? 0);
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : (report?.revenue.progress ?? 0);
  const content = section.content ?? {};
  const heading = content.heading || getSectionDefinition(section.id).label;
  const body = content.body || getSectionDefinition(section.id).description;

  if (section.id === "hero") return renderHero(section, data);

  if (section.id === "countdown") {
    const startsIn = daysUntil(data.event.startDate);
    return (
      <section className={`${sectionPadding(section)} bg-white ${textAlignClass(section)}`}>
        <div className="mx-auto max-w-3xl rounded-xl border border-violet-100 bg-white px-5 py-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{heading || "The Event Begins In"}</p>
          <div className="mt-4 grid grid-cols-4 divide-x divide-slate-200 text-center">
            {[[startsIn, "Days"], [14, "Hours"], [28, "Minutes"], [36, "Seconds"]].map(([value, label]) => (
              <div key={label} className="px-4">
                <p className="text-2xl font-semibold text-violet-600">{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.id === "event-details") {
    return (
      <section id="event-details" className={`border-t border-slate-200 bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-7 grid gap-5 text-sm text-slate-700 md:grid-cols-4">
          <p><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Date</span>{new Date(data.event.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          <p><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Time</span>{formatDateTimeRange(data.event.startDate, data.event.endDate).split("•")[1] ?? "Time not set"}</p>
          <p><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Location</span>{data.event.location ?? "TBD"}<br />{locationLine(data)}</p>
          <p><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Attire</span>Formal / Black Tie Optional</p>
        </div>
      </section>
    );
  }

  if (section.id === "registration-form") {
    return (
      <section id="registration" className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{content.heading || "Tickets & Tables"}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <div className="mt-5">
          <PublicEventRegistrationForm
            pageSlug={data.pageSlug}
            ticketTypes={data.ticketTypes}
            previewOnly={!data.isPublicRegistration}
          />
        </div>
      </section>
    );
  }

  if (section.id === "table-host-signup") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(tableTicketTypes.length ? tableTicketTypes : data.ticketTypes.slice(0, 3)).map((ticketType) => (
            <article key={ticketType.id} className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-sm font-semibold text-slate-950">{ticketType.name}</p>
              <p className="mt-1 text-xs text-slate-600">{ticketType.seatsIncluded ?? 1} seats available for host groups.</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "sponsorship-levels") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {data.sponsors.length > 0 ? data.sponsors.slice(0, 6).map((sponsor) => (
            <article key={sponsor.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">{sponsorName(sponsor)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-violet-600">{sponsor.level ?? "Sponsor"}</p>
              <p className="mt-3 text-lg font-bold text-slate-950">{formatMoney(sponsor.amount)}</p>
            </article>
          )) : <p className="text-sm text-slate-500">No sponsors linked yet.</p>}
        </div>
      </section>
    );
  }

  if (section.id === "donation-goal" || section.id === "progress-meter") {
    return (
      <section className={`bg-white ${sectionPadding(section)}`}>
        <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-center">
          <div className={textAlignClass(section)}>
            <h2 className="text-2xl font-semibold text-slate-950">{content.heading || "A Night That Changes Lives"}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
          </div>
          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Our Goal</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{formatMoney(goal || 30000)}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Raised {formatMoney(raised)}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <button type="button" className="mt-4 h-10 w-full rounded-md bg-violet-600 text-sm font-semibold text-white">Make a Donation</button>
          </aside>
        </div>
      </section>
    );
  }

  if (section.id === "donation-form") {
    return (
      <section className={`bg-violet-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">{content.heading || "Make A Donation"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {[50, 100, 250, 500].map((amount) => (
              <button key={amount} type="button" className="h-11 rounded-lg border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700">${amount}</button>
            ))}
          </div>
          <button type="button" className="mt-4 h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white">{content.buttonText || "Give Now"}</button>
        </div>
      </section>
    );
  }

  if (section.id === "schedule") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {["Doors Open", "Dinner & Program", "Giving Moment"].map((item, index) => (
            <article key={item} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Step {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{item}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "speaker-program") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{content.body || data.event.description || "Add event narrative in the event record to show program highlights here."}</p>
      </section>
    );
  }

  if (section.id === "auction-preview") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Auction Preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{heading}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            {["Featured package", "Raffle moment", "Sponsor match"].map((item) => (
              <article key={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">{item}</p>
                <p className="mt-1 text-xs text-slate-500">Add item details, bidding URL, or auction handoff in section settings.</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.id === "live-appeal") {
    const goal = (data.report?.revenue.goal ?? Number(data.event.revenueGoal ?? 0)) || null;
    return (
      <section className={`${sectionPadding(section)} bg-emerald-950 text-white ${textAlignClass(section)}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Live Appeal</p>
        <h2 className="mt-2 text-3xl font-semibold">{heading}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/80">{body}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[100, 250, 500, 1000].map((amount) => (
            <a key={amount} href={content.buttonLink || "#donate"} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/15">
              {formatMoney(amount)}
            </a>
          ))}
        </div>
        {goal ? <p className="mt-4 text-xs text-emerald-100/80">Event goal: {formatMoney(goal)}</p> : null}
      </section>
    );
  }

  if (section.id === "volunteer-callout") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Volunteer Team</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{heading}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
          <a href={content.buttonLink || `mailto:events@example.org?subject=${encodeURIComponent(data.event.name)}`} className="mt-5 inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">
            {content.buttonText || "Volunteer for this event"}
          </a>
        </div>
      </section>
    );
  }

  if (section.id === "video") {
    return (
      <section className={`bg-slate-950 ${sectionPadding(section)} text-white ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold">{heading}</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">{body}</p>
        <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/15 bg-white/10">
          {content.mediaUrl ? (
            <iframe className="h-full w-full" src={content.mediaUrl} title={heading} allowFullScreen />
          ) : (
            <div className="grid h-full place-items-center text-sm text-white/60">Add a video embed URL in section settings.</div>
          )}
        </div>
      </section>
    );
  }

  if (section.id === "image-gallery") {
    const image = content.mediaUrl || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80";
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-44 rounded-2xl bg-cover bg-center shadow-sm" style={{ backgroundImage: `url("${image}")` }} />
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "impact-story") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Impact Story</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">{body}</p>
      </section>
    );
  }

  if (section.id === "cta-banner") {
    return (
      <section className={`${sectionPadding(section)} bg-violet-700 text-white ${textAlignClass(section)}`}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{heading}</h2>
            <p className="mt-2 text-sm text-violet-100">{body}</p>
          </div>
          <a href={content.buttonLink || "#registration"} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-violet-700">
            {content.buttonText || "Take Action"}
          </a>
        </div>
      </section>
    );
  }

  if (section.id === "documents") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <a href={content.documentUrl || content.buttonLink || data.publicUrl} className="mt-5 inline-flex rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700">
          {content.documentLabel || content.buttonText || "Open Document"}
        </a>
      </section>
    );
  }

  if (section.id === "faq") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {["What should I wear?", "Can I host a table?", "How do I update registration?"].map((question) => (
            <article key={question} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">{question}</article>
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "map-location") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-950">{data.event.location ?? "Venue name not set"}</p>
          <p className="mt-1 text-sm text-slate-600">{locationLine(data)}</p>
        </div>
      </section>
    );
  }

  if (section.id === "sponsor-logos") {
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {(data.sponsors.length ? data.sponsors.slice(0, 8) : [{ id: "placeholder", level: "Sponsor", amount: 0 } as EventBuilderSponsor]).map((sponsor) => (
            <div key={sponsor.id} className="grid h-20 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-500">
              {sponsorName(sponsor)}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "share-buttons") {
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Copy Link", "Email", "Facebook", "X"].map((label) => (
            <button key={label} type="button" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{label}</button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <footer className="bg-slate-950 px-12 py-8 text-sm text-white">
      <p className="font-semibold">{data.event.name}</p>
      <p className="mt-1 text-white/70">{new Date(data.event.startDate).getFullYear()} • Contact the events office for support.</p>
    </footer>
  );
}

/** Shared public-page document renderer used by both builder preview and published pages. */
export function EventPageDocument({ sections, selectedSectionId, data, onSelectSection }: EventPageDocumentProps) {
  const visibleSections = sections.filter((section) => section.enabled);

  return (
    <div className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      {visibleSections.map((section) => {
        const selected = section.id === selectedSectionId;
        const definition = getSectionDefinition(section.id);
        return (
          <div
            key={section.id}
            id={section.advanced?.anchorId || section.id}
            role={onSelectSection ? "button" : undefined}
            tabIndex={onSelectSection ? 0 : undefined}
            onClick={() => onSelectSection?.(section.id)}
            onKeyDown={(event) => {
              if (!onSelectSection) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSection(section.id);
              }
            }}
            className={[
              "block w-full text-left transition",
              selected ? "relative z-[1] ring-2 ring-inset ring-violet-500" : onSelectSection ? "hover:ring-1 hover:ring-inset hover:ring-violet-200" : "",
              section.advanced?.customCssClass ?? "",
            ].join(" ")}
            aria-label={onSelectSection ? `Edit ${definition.label}` : undefined}
          >
            {renderSection(section, data)}
          </div>
        );
      })}
    </div>
  );
}

/** Center live preview canvas for event-scoped public page composition. */
export default function EventPageBuilderPreview({ sections, selectedSectionId, data, onSelectSection }: EventPageBuilderPreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("Desktop");

  return (
    <section className="h-full min-h-0 min-w-0 overflow-y-auto bg-[#f7f8fc]">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-[#f7f8fc]/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(["Desktop", "Tablet", "Mobile"] as const).map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setDevice(label)}
                className={getDeviceButtonClasses(device, label)}
                title={label}
                aria-label={`${label} preview`}
              >
                {index === 0 ? "▭" : index === 1 ? "▯" : "▯"}
              </button>
            ))}
          </div>
          <div className="flex min-w-[260px] flex-1 items-center justify-center">
            <div className="flex h-9 w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500 shadow-sm">
              <span className="text-emerald-500">▣</span>
              <span className="truncate">{data.publicUrl}</span>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {device} preview
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className={`mx-auto transition-all duration-200 ${PREVIEW_DEVICE_WIDTH[device]}`}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="flex h-8 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 truncate text-[11px] font-semibold text-slate-500">{data.publicUrl}</span>
            </div>
            <EventPageDocument
              sections={sections}
              selectedSectionId={selectedSectionId}
              data={data}
              onSelectSection={onSelectSection}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
