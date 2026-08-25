"use client";

// Event page builder preview canvas styled as a public fundraising event page.
import { useState, type CSSProperties } from "react";
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
  return [data.event.address, data.event.city, data.event.state].filter(Boolean).join(", ") || "Address not configured";
}

function daysUntil(startDate: string): number {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = start.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function sectionPadding(section: EventPageSectionState): string {
  return section.design?.compact ? "px-5 py-7 sm:px-8 lg:px-12" : "px-5 py-10 sm:px-8 lg:px-12";
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
      <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
        <nav className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 text-xs" aria-label="Event page">
          <div className="flex items-center gap-3">
            {data.branding?.logoUrl || data.branding?.logoSquareUrl ? <img src={data.branding.logoUrl || data.branding.logoSquareUrl} alt={`${organizationName(data)} logo`} className="h-9 max-w-36 object-contain object-left" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-bold text-slate-700">{organizationName(data).split(" ").map((word: string) => word[0] ?? "").slice(0, 2).join("").toUpperCase() || "EV"}</div>}
            <div className="max-w-[170px] truncate font-semibold text-slate-700">{organizationName(data)}</div>
          </div>
          <a href={primaryHref} className="event-brand-primary-bg inline-flex min-h-10 items-center rounded-md px-5 font-semibold text-white">{content.primaryButtonText || "Register"}</a>
        </nav>
        <div className="grid gap-8 py-9 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)] md:items-center md:py-12">
          <div>
            {content.kicker?.trim() ? <p className="text-xs font-semibold uppercase tracking-[0.18em] event-brand-primary-text">{content.kicker.trim()}</p> : null}
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl">{title}</h1>
            {subtitle ? <p className="mt-3 text-lg leading-7 text-slate-600">{subtitle}</p> : data.event.description ? <p className="mt-4 line-clamp-3 max-w-2xl text-base leading-7 text-slate-600">{data.event.description}</p> : null}
            <div className="mt-6 space-y-2 text-sm text-slate-700">
              <p className="font-medium">{formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
              <p>{data.event.location ?? "Location to be announced"}{locationLine(data) !== "Address not configured" ? ` · ${locationLine(data)}` : ""}</p>
            </div>
            {lowestPrice >= 0 ? <p className="mt-5 text-sm text-slate-500">{lowestPrice > 0 ? `Registration from ${formatMoney(lowestPrice, data.currency)}` : "Free registration available"}</p> : null}
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <a href={primaryHref} className="event-brand-primary-bg inline-flex min-h-12 items-center rounded-md px-7 text-sm font-semibold text-white">{content.primaryButtonText || "Register"}</a>
              <a href={secondaryHref} className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4">{content.secondaryButtonText || "View event details"}</a>
            </div>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
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
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 sm:flex-row">
          {brand?.logoUrl || brand?.logoSquareUrl ? <img src={brand.logoUrl || brand.logoSquareUrl} alt={`${organizationName(data)} logo`} className="max-h-20 w-auto max-w-56 object-contain" /> : <div className="grid h-16 w-16 place-items-center rounded-sm bg-slate-100 text-xl font-semibold text-slate-600">{organizationName(data).slice(0, 2).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Presented by</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{content.heading || organizationName(data)}</h2>{content.body || brand?.tagline ? <p className="mt-2 text-sm text-slate-600">{content.body || brand?.tagline}</p> : null}</div>
          {brand?.websiteUrl ? <a href={brand.websiteUrl} className="event-brand-outline inline-flex min-h-10 items-center px-4 text-sm font-semibold">Visit our website</a> : null}
        </div>
      </section>
    );
  }

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
    const eventImageUrl = allSections.find((candidate) => candidate.id === "hero")?.design?.backgroundImageUrl;
    return (
      <section id="registration" className="bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
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
        <a href={hostSignupHref} className="mt-5 inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">
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
            <a href={publicHref(content.buttonLink, "#donate")} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-violet-600 text-sm font-semibold text-white">Make a Donation</a>
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
    const galleryImages = (content.galleryImages as string[] | undefined) ?? (content.mediaUrl ? [content.mediaUrl] : []);
    return (
      <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}>
        <h2 className="text-2xl font-semibold text-slate-950">{heading}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        {galleryImages.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {galleryImages.slice(0, 6).map((src, index) => (
              <div key={index} className="h-44 rounded-2xl bg-cover bg-center shadow-sm" style={{ backgroundImage: `url("${src}")` }} />
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
    return <section className={`${sectionPadding(section)} event-brand-soft ${textAlignClass(section)}`}><figure className="mx-auto max-w-3xl"><span className="event-brand-primary-text text-5xl leading-none">“</span><blockquote className="mt-2 text-balance text-2xl font-medium leading-9 text-slate-900">{content.body || "Add a short supporter, guest, or beneficiary quote that helps visitors understand why this event matters."}</blockquote><figcaption className="mt-5 text-sm"><strong className="block text-slate-900">{content.quoteAuthor || "Supporter name"}</strong>{content.quoteRole ? <span className="text-slate-600">{content.quoteRole}</span> : null}</figcaption></figure></section>;
  }

  if (section.id === "contact-organizer") {
    const brand = data.branding;
    return <section className={`bg-white ${sectionPadding(section)} ${textAlignClass(section)}`}><div className="mx-auto max-w-5xl border border-slate-200 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Questions?</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{content.heading || "Contact the event organizer"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{content.body || `The ${organizationName(data)} team is ready to help with registration, accessibility, sponsorships, and event details.`}</p><div className="mt-5 flex flex-wrap gap-2">{brand?.contactEmail ? <a href={`mailto:${brand.contactEmail}`} className="event-brand-primary-bg inline-flex min-h-10 items-center px-4 text-sm font-semibold text-white">Email {brand.contactEmail}</a> : null}{brand?.contactPhone ? <a href={`tel:${brand.contactPhone}`} className="event-brand-outline inline-flex min-h-10 items-center px-4 text-sm font-semibold">Call {brand.contactPhone}</a> : null}{!brand?.contactEmail && !brand?.contactPhone ? <span className="text-sm text-slate-500">Add organization contact details in Settings → Branding.</span> : null}</div></div></section>;
  }

  if (section.id === "accessibility") {
    return <section className={`bg-slate-50 ${sectionPadding(section)} ${textAlignClass(section)}`}><div className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] event-brand-primary-text">Plan your visit</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{content.heading || "Accessibility and arrival information"}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{content.body || "Add accessibility accommodations, parking, entrance, seating, interpretation, sensory, or dietary guidance here."}</p>{data.branding?.contactEmail ? <p className="mt-4 text-sm text-slate-600">Need another accommodation? <a href={`mailto:${data.branding.contactEmail}`} className="event-brand-primary-text font-semibold underline">Contact our team</a>.</p> : null}</div></section>;
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
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(data.publicUrl);
            }}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Copy Link
          </button>
          {shareActions.map((action) => (
            <a key={action.label} href={action.href} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              {action.label}
            </a>
          ))}
        </div>
      </section>
    );
  }

  const brand = data.branding;
  return <footer className="bg-slate-950 px-5 py-8 text-sm text-white sm:px-8 lg:px-12"><div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div>{brand?.logoUrl ? <img src={brand.logoUrl} alt={`${organizationName(data)} logo`} className="mb-3 max-h-12 max-w-44 object-contain object-left brightness-0 invert" /> : null}<p className="font-semibold">{organizationName(data)}</p><p className="mt-1 text-white/70">{brand?.tagline || data.event.name}</p>{brand?.addressLine ? <p className="mt-2 text-xs text-white/60">{brand.addressLine}</p> : null}</div><div className="text-left text-xs text-white/65 sm:text-right">{brand?.contactEmail ? <a className="block hover:text-white" href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a> : null}{brand?.contactPhone ? <a className="mt-1 block hover:text-white" href={`tel:${brand.contactPhone}`}>{brand.contactPhone}</a> : null}<p className="mt-2">© {new Date(data.event.startDate).getFullYear()} {brand?.legalOrganizationName || organizationName(data)}</p>{brand?.footerLegalText ? <p className="mt-1 max-w-md">{brand.footerLegalText}</p> : null}</div></div></footer>;
}

/** Shared public-page document renderer used by both builder preview and published pages. */
export function EventPageDocument({ sections, selectedSectionId, data, onSelectSection }: EventPageDocumentProps) {
  const visibleSections = sections.filter((section) => section.enabled);
  const brandStyle = {
    "--event-brand-primary": data.branding?.primaryColor || "#0f6cbd",
    "--event-brand-accent": data.branding?.accentColor || "#5c2d91",
  } as CSSProperties;

  return (
    <div className="event-public-document mx-auto max-w-6xl overflow-hidden border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)]" style={brandStyle}>
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
              selected ? "relative z-[1] ring-2 ring-inset ring-violet-500" : onSelectSection ? "hover:ring-1 hover:ring-inset hover:ring-violet-200" : "",
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
      {data.isPublicRegistration && data.ticketTypes.length > 0 ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-4 py-3 shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-md items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs text-slate-500">From</p><p className="font-semibold text-slate-950">{formatMoney(Math.min(...data.ticketTypes.map((ticket) => Number(ticket.price ?? 0))), data.currency)}</p></div><a href="#registration" className="event-brand-primary-bg inline-flex min-h-11 items-center rounded-md px-6 text-sm font-semibold text-white">Register</a></div></div> : null}
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
