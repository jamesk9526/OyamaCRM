"use client";

// Event page builder preview canvas styled as a public fundraising event page.
import { useEffect, useState, type CSSProperties } from "react";
import { Monitor, MousePointer2, Smartphone, Tablet } from "lucide-react";
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
    "grid h-8 w-9 place-items-center border text-xs font-semibold transition",
    activeDevice === buttonDevice ? "border-sky-500 bg-sky-50 text-sky-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900",
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

function formatMoney(value: number | string | null | undefined, currency = "USD"): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0";
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency.toUpperCase()) ? currency.toUpperCase() : "USD";
  return parsed.toLocaleString(undefined, { style: "currency", currency: normalizedCurrency, maximumFractionDigits: 0 });
}

function sponsorName(sponsor: EventBuilderSponsor): string {
  const first = sponsor.constituent?.firstName?.trim() ?? "";
  const last = sponsor.constituent?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || (sponsor.level ? `${sponsor.level} Sponsor` : "Sponsor");
}

function locationLine(data: EventPageBuilderWorkspaceData): string {
  return [data.event.address, data.event.city, data.event.state, data.event.zip].filter(Boolean).join(", ") || "Address not configured";
}

function daysUntil(startDate: string): number {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = start.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function sectionPadding(section: EventPageSectionState): string {
  return section.design?.compact ? "px-4 py-6 sm:px-8 sm:py-7 lg:px-12" : "px-4 py-8 sm:px-8 sm:py-10 lg:px-12";
}

function organizationName(data: EventPageBuilderWorkspaceData): string {
  return data.branding?.organizationName?.trim() || data.branding?.legalOrganizationName?.trim() || "Event organizer";
}

function textAlignClass(section: EventPageSectionState): string {
  return section.design?.textAlign === "center" ? "text-center" : "text-left";
}

function publicHref(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function tableLinkHref(data: EventPageBuilderWorkspaceData): string {
  return `/tablelink?eventId=${encodeURIComponent(data.event.id)}`;
}

function renderHero(section: EventPageSectionState, data: EventPageBuilderWorkspaceData) {
  const content = section.content ?? {};
  const design = section.design ?? {};
  const title = content.title?.trim() || data.event.name;
  // Subtitle intentionally falls to empty — staff set their own per-event tagline.
  const subtitle = content.subtitle?.trim() || "";
  const backgroundImage = design.backgroundImageUrl?.trim() || "";
  const brandPrimary = data.branding?.primaryColor || "#0f6cbd";
  const brandAccent = data.branding?.accentColor || "#5c2d91";
  const primaryHref = publicHref(content.primaryButtonLink, "#registration");
  const secondaryHref = publicHref(content.secondaryButtonLink, "#event-details");
  const lowestPrice = data.ticketTypes.length ? Math.min(...data.ticketTypes.map((ticket) => Number(ticket.price ?? 0))) : 0;

  return (
    <section className="bg-white text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-8 sm:py-5">
        <nav className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4 text-xs" aria-label="Event page">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {data.branding?.logoUrl || data.branding?.logoSquareUrl ? <img src={data.branding.logoUrl || data.branding.logoSquareUrl} alt={`${organizationName(data)} logo`} className="h-8 max-w-28 shrink-0 object-contain object-left sm:h-9 sm:max-w-36" /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-700 sm:h-9 sm:w-9">{organizationName(data).split(" ").map((word: string) => word[0] ?? "").slice(0, 2).join("").toUpperCase() || "EV"}</div>}
            <div className="hidden min-w-0 max-w-[170px] truncate font-semibold text-slate-700 sm:block">{organizationName(data)}</div>
          </div>
          <a href={primaryHref} className="event-brand-primary-bg inline-flex min-h-11 max-w-[52vw] shrink-0 items-center justify-center rounded-md px-3 font-semibold text-white sm:max-w-none sm:px-5"><span className="truncate">{content.primaryButtonText || "Register"}</span></a>
        </nav>
        <div className="grid gap-7 py-8 sm:py-9 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)] md:items-center md:gap-8 md:py-12">
          <div className="min-w-0">
            {content.kicker?.trim() ? <p className="text-xs font-semibold uppercase tracking-[0.18em] event-brand-primary-text">{content.kicker.trim()}</p> : null}
            <h1 className="mt-3 max-w-2xl break-words text-[clamp(2.25rem,11vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950">{title}</h1>
            {subtitle ? <p className="mt-3 break-words text-base leading-7 text-slate-600 sm:text-lg">{subtitle}</p> : data.event.description ? <p className="mt-4 max-w-2xl break-words text-base leading-7 text-slate-600">{data.event.description}</p> : null}
            <div className="mt-6 space-y-2 text-sm text-slate-700">
              <p className="break-words font-medium">{formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
              <p className="break-words">{data.event.location ?? "Location to be announced"}{locationLine(data) !== "Address not configured" ? ` · ${locationLine(data)}` : ""}</p>
            </div>
            {lowestPrice >= 0 ? <p className="mt-5 text-sm text-slate-500">{lowestPrice > 0 ? `Registration from ${formatMoney(lowestPrice, data.currency)}` : "Free registration available"}</p> : null}
            <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <a href={primaryHref} className="event-brand-primary-bg inline-flex min-h-12 items-center justify-center rounded-md px-7 text-sm font-semibold text-white">{content.primaryButtonText || "Register"}</a>
              <a href={secondaryHref} className="inline-flex min-h-11 items-center justify-center text-center text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4">{content.secondaryButtonText || "View event details"}</a>
            </div>
          </div>
          <div className="aspect-[16/10] overflow-hidden rounded-lg bg-slate-100 md:aspect-[4/3]">
            {design.backgroundType === "video" && design.backgroundImageUrl ? <video className="h-full w-full object-cover" src={design.backgroundImageUrl} autoPlay muted loop playsInline /> : backgroundImage ? <img src={backgroundImage} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-8 text-center text-white" style={{ background: `linear-gradient(145deg, ${brandPrimary}, ${brandAccent})` }}><span className="text-5xl font-semibold opacity-90">{title.slice(0, 1).toUpperCase()}</span></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderSection(section: EventPageSectionState, data: EventPageBuilderWorkspaceData, allSections: EventPageSectionState[]) {
  const report = data.report;
  const tableTicketTypes = data.ticketTypes.filter((ticketType) => ticketType.isTable);
  const goal = Number(report?.revenue.goal ?? data.event.revenueGoal ?? 0);
  const raised = Number(report?.revenue.total ?? 0);
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : (report?.revenue.progress ?? 0);
  const content = section.content ?? {};
  const heading = content.heading || getSectionDefinition(section.id).label;
  const body = content.body || getSectionDefinition(section.id).description;

  if (section.id === "hero") return renderHero(section, data);

  if (section.id === "organization-banner") {
    const brand = data.branding;
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 sm:flex-row sm:items-center">
          {brand?.logoUrl || brand?.logoSquareUrl ? <img src={brand.logoUrl || brand.logoSquareUrl} alt={`${organizationName(data)} logo`} className="max-h-20 w-auto max-w-56 object-contain" /> : <div className="grid h-16 w-16 place-items-center rounded-sm bg-slate-100 text-xl font-semibold text-slate-600">{organizationName(data).slice(0, 2).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Presented by</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{content.heading || organizationName(data)}</h2>{content.body || brand?.tagline ? <p className="mt-2 text-sm text-slate-600">{content.body || brand?.tagline}</p> : null}</div>
          {brand?.websiteUrl ? <a href={brand.websiteUrl} className="event-brand-outline inline-flex min-h-11 w-full items-center justify-center px-4 text-sm font-semibold sm:w-auto">Visit our website</a> : null}
        </div>
      </section>
    );
  }

  if (section.id === "countdown") {
    const startsIn = daysUntil(data.event.startDate);
    return (
      <section className={`${sectionPadding(section)} bg-white ${textAlignClass(section)}`}>
        <div className="mx-auto max-w-3xl rounded-xl border border-violet-100 bg-white px-3 py-4 text-center shadow-sm sm:px-5 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{heading || "The Event Begins In"}</p>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden bg-slate-200 text-center sm:grid-cols-4">
            {[[startsIn, "Days"], [14, "Hours"], [28, "Minutes"], [36, "Seconds"]].map(([value, label]) => (
              <div key={label} className="min-w-0 bg-white px-1 py-3 sm:px-2">
                <p className="text-xl font-semibold text-violet-600 sm:text-2xl">{value}</p>
                <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:text-[10px] sm:tracking-[0.12em]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.id === "event-details") {
    const recordDate = new Date(data.event.startDate);
    const defaultDate = Number.isNaN(recordDate.getTime())
      ? "Date not set"
      : recordDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const defaultTime = formatDateTimeRange(data.event.startDate, data.event.endDate).split("•")[1]?.trim() || "Time not set";
    const date = content.eventDate?.trim() || defaultDate;
    const time = content.eventTime?.trim() || defaultTime;
    const venue = content.locationName?.trim() || data.event.location?.trim() || "TBD";
    const address = content.locationAddress?.trim() || locationLine(data);
    const attire = content.attire?.trim() || "Attire not specified";
    return (
      <section id="event-details" className={`border-t border-slate-200 bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-6 grid gap-5 text-sm text-slate-700 sm:grid-cols-2 md:mt-7 md:grid-cols-4">
          <p className="min-w-0 break-words"><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Date</span>{date}</p>
          <p className="min-w-0 break-words"><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Time</span>{time}</p>
          <p className="min-w-0 break-words"><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Location</span>{venue}{address ? <><br /><span className="whitespace-pre-line">{address}</span></> : null}</p>
          <p className="min-w-0 break-words"><span className="block text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Attire</span>{attire}</p>
        </div>
      </section>
    );
  }

  if (section.id === "registration-form") {
    const eventImageUrl = allSections.find((candidate) => candidate.id === "hero")?.design?.backgroundImageUrl;
    return (
      <section id="registration" className="scroll-mt-4 bg-slate-50 px-0 py-6 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[900px]">
          <PublicEventRegistrationForm
            pageSlug={data.pageSlug}
            ticketTypes={data.ticketTypes}
            paymentPolicy={data.paymentPolicy}
            currency={data.currency}
            event={data.event}
            branding={data.branding}
            eventImageUrl={eventImageUrl}
            previewOnly={!data.isPublicRegistration}
          />
        </div>
      </section>
    );
  }

  if (section.id === "table-host-signup") {
    const hostSignupHref = publicHref(content.buttonLink, tableLinkHref(data));
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
        <a href={hostSignupHref} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white sm:w-auto">
          {content.buttonText || "Open TableLink"}
        </a>
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
            <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
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
            <a href={publicHref(content.buttonLink, "#donate")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-violet-600 text-sm font-semibold text-white">Make a Donation</a>
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
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[50, 100, 250, 500].map((amount) => (
              <a key={amount} href={`${publicHref(content.buttonLink, "#registration")}?amount=${amount}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700">${amount}</a>
            ))}
          </div>
          <a href={publicHref(content.buttonLink, "#registration")} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-violet-600 text-sm font-semibold text-white">{content.buttonText || "Give Now"}</a>
        </div>
      </section>
    );
  }

  if (section.id === "schedule") {
    const scheduleItems = (content.scheduleItems as Array<{ time?: string; label?: string }> | undefined) ?? [];
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        {scheduleItems.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {scheduleItems.map((item, index) => (
              <article key={index} className="rounded-xl border border-slate-200 bg-white p-4">
                {item.time ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">{item.time}</p> : null}
                <p className="mt-2 text-sm font-semibold text-slate-950">{item.label || `Item ${index + 1}`}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Add schedule items in the section inspector to show your event timeline here.</p>
        )}
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
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[100, 250, 500, 1000].map((amount) => (
            <a key={amount} href={content.buttonLink || "#donate"} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-white/15">
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
          <a href={content.buttonLink || `mailto:events@example.org?subject=${encodeURIComponent(data.event.name)}`} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-violet-700 px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">
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
            <iframe className="h-full w-full" src={content.mediaUrl} title={heading} loading="lazy" allowFullScreen />
          ) : (
            <div className="grid h-full place-items-center text-sm text-white/60">Add a video embed URL in section settings.</div>
          )}
        </div>
      </section>
    );
  }

  if (section.id === "image-gallery") {
    const galleryImages = (content.galleryImages as string[] | undefined) ?? (content.mediaUrl ? [content.mediaUrl] : []);
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        {galleryImages.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {galleryImages.slice(0, 6).map((src, index) => (
              <img key={index} src={src} alt="" loading="lazy" className="h-44 w-full rounded-2xl object-cover shadow-sm" />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-44 rounded-2xl border border-dashed border-slate-300 bg-slate-50 grid place-items-center text-xs text-slate-400">
                Add photo {index + 1}
              </div>
            ))}
          </div>
        )}
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

  if (section.id === "highlights") {
    const items = content.highlightItems ?? [];
    return <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}><div className="mx-auto max-w-5xl"><h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>{content.body ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{content.body}</p> : null}<div className="mt-6 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{(items.length ? items : [{ title: "Meaningful impact", body: "Describe the outcome this event makes possible." }, { title: "A welcoming experience", body: "Share what guests can expect when they arrive." }, { title: "Easy ways to participate", body: "Explain how registration or giving supports the mission." }]).map((item, index) => <article key={index} className="bg-white p-5"><span className="event-brand-soft grid h-8 w-8 place-items-center rounded-full text-xs font-semibold">{index + 1}</span><h3 className="mt-4 text-base font-semibold text-slate-950">{item.title || `Highlight ${index + 1}`}</h3>{item.body ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p> : null}</article>)}</div></div></section>;
  }

  if (section.id === "testimonial") {
    return <section className={`${sectionPadding(section)} event-brand-soft ${textAlignClass(section)}`}><figure className="mx-auto max-w-3xl"><span className="event-brand-primary-text text-5xl leading-none">“</span><blockquote className="mt-2 break-words text-xl font-medium leading-8 text-slate-900 sm:text-balance sm:text-2xl sm:leading-9">{content.body || "Add a short supporter, guest, or beneficiary quote that helps visitors understand why this event matters."}</blockquote><figcaption className="mt-5 text-sm"><strong className="block text-slate-900">{content.quoteAuthor || "Supporter name"}</strong>{content.quoteRole ? <span className="text-slate-600">{content.quoteRole}</span> : null}</figcaption></figure></section>;
  }

  if (section.id === "contact-organizer") {
    const brand = data.branding;
    return <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}><div className="mx-auto max-w-5xl border border-slate-200 p-4 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Questions?</p><h2 className="mt-1 break-words text-2xl font-semibold text-slate-950">{content.heading || "Contact the event organizer"}</h2><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-600">{content.body || `The ${organizationName(data)} team is ready to help with registration, accessibility, sponsorships, and event details.`}</p><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{brand?.contactEmail ? <a href={`mailto:${brand.contactEmail}`} className="event-brand-primary-bg inline-flex min-h-11 min-w-0 items-center justify-center break-all px-4 text-center text-sm font-semibold text-white">Email {brand.contactEmail}</a> : null}{brand?.contactPhone ? <a href={`tel:${brand.contactPhone}`} className="event-brand-outline inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold">Call {brand.contactPhone}</a> : null}{!brand?.contactEmail && !brand?.contactPhone ? <span className="text-sm text-slate-500">Add organization contact details in Settings → Branding.</span> : null}</div></div></section>;
  }

  if (section.id === "accessibility") {
    return <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}><div className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Plan your visit</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{content.heading || "Accessibility and arrival information"}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{content.body || "Add accessibility accommodations, parking, entrance, seating, interpretation, sensory, or dietary guidance here."}</p>{data.branding?.contactEmail ? <p className="mt-4 text-sm text-slate-600">Need another accommodation? <a href={`mailto:${data.branding.contactEmail}`} className="event-brand-primary-text font-semibold underline">Contact our team</a>.</p> : null}</div></section>;
  }

  if (section.id === "cta-banner") {
    return (
      <section className={`${sectionPadding(section)} bg-violet-700 text-white ${textAlignClass(section)}`}>
        <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-semibold">{heading}</h2>
            <p className="mt-2 break-words text-sm text-violet-100">{body}</p>
          </div>
          <a href={content.buttonLink || "#registration"} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-center text-sm font-semibold text-violet-700">
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
        <a href={content.documentUrl || content.buttonLink || data.publicUrl} className="mt-5 inline-flex min-h-11 w-full items-center justify-center break-words rounded-lg border border-violet-200 bg-white px-4 py-2 text-center text-sm font-semibold text-violet-700 sm:w-auto">
          {content.documentLabel || content.buttonText || "Open Document"}
        </a>
      </section>
    );
  }

  if (section.id === "faq") {
    const faqItems = (content.faqItems as Array<{ question?: string; answer?: string }> | undefined) ?? [];
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        {faqItems.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {faqItems.map((item, index) => (
              <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{item.question ?? `Question ${index + 1}`}</p>
                {item.answer ? <p className="mt-2 text-sm text-slate-600">{item.answer}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Add FAQ items in the section inspector to answer common attendee questions here.</p>
        )}
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
    const encodedUrl = encodeURIComponent(data.publicUrl);
    const encodedTitle = encodeURIComponent(data.event.name);
    const shareActions = [
      { label: "Email", href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
      { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
      { label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    ];
    return (
      <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(data.publicUrl);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Copy Link
          </button>
          {shareActions.map((action) => (
            <a key={action.label} href={action.href} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              {action.label}
            </a>
          ))}
        </div>
      </section>
    );
  }

  const brand = data.branding;
  return <footer className="bg-slate-950 px-4 py-8 text-sm text-white sm:px-8 lg:px-12"><div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0">{brand?.logoUrl ? <img src={brand.logoUrl} alt={`${organizationName(data)} logo`} className="mb-3 max-h-12 max-w-44 object-contain object-left brightness-0 invert" /> : null}<p className="break-words font-semibold">{organizationName(data)}</p><p className="mt-1 break-words text-white/70">{brand?.tagline || data.event.name}</p>{brand?.addressLine ? <p className="mt-2 break-words text-xs leading-5 text-white/60">{brand.addressLine}</p> : null}</div><div className="min-w-0 text-left text-xs leading-5 text-white/65 sm:text-right">{brand?.contactEmail ? <a className="block break-all py-1 hover:text-white" href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a> : null}{brand?.contactPhone ? <a className="mt-1 block py-1 hover:text-white" href={`tel:${brand.contactPhone}`}>{brand.contactPhone}</a> : null}<p className="mt-2 break-words">© {new Date(data.event.startDate).getFullYear()} {brand?.legalOrganizationName || organizationName(data)}</p>{brand?.footerLegalText ? <p className="mt-1 max-w-md break-words">{brand.footerLegalText}</p> : null}</div></div></footer>;
}

/** Shared public-page document renderer used by both builder preview and published pages. */
export function EventPageDocument({ sections, selectedSectionId, data, onSelectSection }: EventPageDocumentProps) {
  const [registrationInView, setRegistrationInView] = useState(false);
  const visibleSections = sections.filter((section) => section.enabled);
  const brandStyle = {
    "--event-brand-primary": data.branding?.primaryColor || "#0f6cbd",
    "--event-brand-accent": data.branding?.accentColor || "#5c2d91",
  } as CSSProperties;

  useEffect(() => {
    if (!data.isPublicRegistration) {
      setRegistrationInView(false);
      return;
    }
    const registration = document.getElementById("registration");
    if (!registration || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setRegistrationInView(entry.isIntersecting),
      { rootMargin: "-15% 0px -20% 0px", threshold: 0.01 },
    );
    observer.observe(registration);
    return () => observer.disconnect();
  }, [data.isPublicRegistration, sections]);

  return (
    <div className="event-public-document w-full overflow-hidden bg-white" style={brandStyle}>
      {visibleSections.map((section) => {
        const selected = section.id === selectedSectionId;
        const definition = getSectionDefinition(section.id);
        const sectionStyle = {
          ...(section.design?.accentColor ? { "--event-brand-primary": section.design.accentColor } : {}),
          ...(section.design?.backgroundType === "color" && section.design.backgroundColor
            ? { "--event-section-background": section.design.backgroundColor }
            : {}),
        } as CSSProperties;
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
            style={sectionStyle}
            className={[
              "block w-full text-left transition",
              selected ? "relative z-[1] ring-2 ring-inset ring-sky-500" : onSelectSection ? "hover:ring-1 hover:ring-inset hover:ring-sky-300" : "",
              section.design?.backgroundTone ? `event-section-tone-${section.design.backgroundTone}` : "",
              section.design?.contentWidth ? `event-section-width-${section.design.contentWidth}` : "",
              section.design?.backgroundType === "color" && section.design.backgroundColor ? "event-section-custom-background" : "",
              section.advanced?.customCssClass ?? "",
            ].join(" ")}
            aria-label={onSelectSection ? `Edit ${definition.label}` : undefined}
          >
            {renderSection(section, data, visibleSections)}
          </div>
        );
      })}
      {data.isPublicRegistration && data.ticketTypes.length > 0 ? <div aria-hidden={registrationInView} className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 md:hidden ${registrationInView ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}><div className="mx-auto flex max-w-md items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs text-slate-500">Registration from</p><p className="truncate font-semibold text-slate-950">{formatMoney(Math.min(...data.ticketTypes.map((ticket) => Number(ticket.price ?? 0))), data.currency)}</p></div><a href="#registration" tabIndex={registrationInView ? -1 : undefined} className="event-brand-primary-bg inline-flex min-h-12 shrink-0 items-center justify-center rounded-md px-6 text-sm font-semibold text-white">Register</a></div></div> : null}
    </div>
  );
}

/** Center live preview canvas for event-scoped public page composition. */
export default function EventPageBuilderPreview({ sections, selectedSectionId, data, onSelectSection }: EventPageBuilderPreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("Desktop");
  const deviceIcon = { Desktop: Monitor, Tablet, Mobile: Smartphone };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-slate-300">
      <div className="relative z-10 flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-400 bg-slate-100 px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="Preview viewport">
            {(["Desktop", "Tablet", "Mobile"] as const).map((label) => {
              const Icon = deviceIcon[label];
              return (
              <button
                key={label}
                type="button"
                onClick={() => setDevice(label)}
                className={getDeviceButtonClasses(device, label)}
                title={label}
                aria-label={`${label} preview`}
                aria-pressed={device === label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );})}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <div className="flex h-8 w-full max-w-xl min-w-0 items-center gap-2 border border-slate-300 bg-white px-3 font-mono text-[10px] text-slate-500"><span className="h-1.5 w-1.5 shrink-0 bg-emerald-500" aria-hidden /><span className="truncate">{data.publicUrl}</span></div>
        </div>
        <p className="hidden items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:flex"><MousePointer2 className="h-3.5 w-3.5" />Select a section to edit</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(45deg,rgba(100,116,139,0.08)_25%,transparent_25%),linear-gradient(-45deg,rgba(100,116,139,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(100,116,139,0.08)_75%),linear-gradient(-45deg,transparent_75%,rgba(100,116,139,0.08)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-3 sm:p-5">
        <div className={`mx-auto transition-[max-width] duration-200 ${PREVIEW_DEVICE_WIDTH[device]}`}>
          <div className="border border-slate-400 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
            <div className="flex h-7 items-center justify-between border-b border-slate-300 bg-slate-800 px-2.5 text-white">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]">{device} · live canvas</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 bg-emerald-400" /><span className="font-mono text-[9px] text-slate-300">AUTO</span></span>
            </div>
            <EventPageDocument sections={sections} selectedSectionId={selectedSectionId} data={data} onSelectSection={onSelectSection} />
          </div>
        </div>
      </div>
    </section>
  );
}
