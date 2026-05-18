import { getSectionDefinition } from "@/app/components/events/page-builder/section-config";
import type {
  EventBuilderSponsor,
  EventBuilderTicketType,
  EventPageBuilderWorkspaceData,
  EventPageSectionId,
  EventPageSectionState,
} from "@/app/components/events/page-builder/types";

interface EventPageBuilderPreviewProps {
  sections: EventPageSectionState[];
  selectedSectionId: EventPageSectionId;
  data: EventPageBuilderWorkspaceData;
}

function formatDateTimeRange(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "Date not set";

  const startDatePart = start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTimePart = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endDate) return `${startDatePart} • ${startTimePart}`;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return `${startDatePart} • ${startTimePart}`;

  const endTimePart = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startDatePart} • ${startTimePart} - ${endTimePart}`;
}

function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "$0";
  return `$${parsed.toLocaleString()}`;
}

function sponsorName(sponsor: EventBuilderSponsor): string {
  const first = sponsor.constituent?.firstName?.trim() ?? "";
  const last = sponsor.constituent?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return sponsor.level ? `${sponsor.level} Sponsor` : "Sponsor";
}

function renderTicketRows(ticketTypes: EventBuilderTicketType[]) {
  if (ticketTypes.length === 0) {
    return <p className="text-xs text-slate-500">No ticket options configured yet.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {ticketTypes.map((ticketType) => (
        <div key={ticketType.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">{ticketType.name}</span>
            <span>{formatMoney(ticketType.price)}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {ticketType.isTable ? `Table seats included: ${ticketType.seatsIncluded ?? 1}` : "Individual registration"}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderSection(sectionId: EventPageSectionId, data: EventPageBuilderWorkspaceData) {
  const report = data.report;
  const tableTicketTypes = data.ticketTypes.filter((ticketType) => ticketType.isTable);

  if (sectionId === "hero") {
    return (
      <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-5 py-6 text-white shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Join us for a night of impact</p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight">{data.event.name}</h3>
        <p className="mt-2 text-sm text-violet-100">{formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
        <p className="text-sm text-violet-100">{data.event.location ?? "Location to be announced"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">Get Tickets</button>
          <button type="button" className="rounded-md border border-violet-200/70 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100">View Event Details</button>
        </div>
      </div>
    );
  }

  if (sectionId === "event-details") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Event Details</h3>
        <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p>Date & Time: {formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
          <p>Location: {data.event.location ?? "TBD"}</p>
          <p>Address: {[data.event.address, data.event.city, data.event.state, data.event.zip].filter(Boolean).join(", ") || "Address not configured"}</p>
          <p>Registration Deadline: {data.event.registrationDeadline ? formatDateTimeRange(data.event.registrationDeadline) : "No deadline set"}</p>
        </div>
      </div>
    );
  }

  if (sectionId === "registration-form") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Registration Form</h3>
        <p className="mt-1 text-xs text-slate-500">Ticket and table options are pulled from this event's registration settings.</p>
        {renderTicketRows(data.ticketTypes)}
      </div>
    );
  }

  if (sectionId === "table-host-signup") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Table Host Signup</h3>
        <p className="mt-1 text-xs text-slate-500">Uses table-ticket options and event date/location details from this event record.</p>
        {tableTicketTypes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {tableTicketTypes.map((ticketType) => (
              <li key={ticketType.id}>• {ticketType.name} ({ticketType.seatsIncluded ?? 1} seats)</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No table-host ticket options configured yet.</p>
        )}
      </div>
    );
  }

  if (sectionId === "sponsorship-levels") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Sponsorship Levels</h3>
        <p className="mt-1 text-xs text-slate-500">Sponsor records and amounts are linked from event sponsor data.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.sponsors.length > 0 ? data.sponsors.slice(0, 6).map((sponsor) => (
            <div key={sponsor.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-900">{sponsorName(sponsor)}</p>
              <p className="text-slate-500">{sponsor.level ?? "Level not set"} • {formatMoney(sponsor.amount)}</p>
            </div>
          )) : <p className="text-xs text-slate-500">No sponsors linked yet.</p>}
        </div>
      </div>
    );
  }

  if (sectionId === "donation-goal") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Donation Goal</h3>
        <p className="mt-1 text-xs text-slate-500">Fundraising goal and raised amount are synchronized from event reporting.</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <p className="text-xl font-semibold text-violet-700">{formatMoney(report?.revenue.goal ?? data.event.revenueGoal)}</p>
          <p className="text-xs text-slate-500">Raised {formatMoney(report?.revenue.total ?? 0)}</p>
        </div>
      </div>
    );
  }

  if (sectionId === "progress-meter") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Progress Meter</h3>
        <div className="mt-2 space-y-2 text-xs text-slate-600">
          <p>Registration progress: {report?.attendance.progress ?? 0}% ({report?.attendance.total ?? 0} attendees)</p>
          <p>Fundraising progress: {report?.revenue.progress ?? 0}% ({formatMoney(report?.revenue.total ?? 0)} raised)</p>
        </div>
      </div>
    );
  }

  if (sectionId === "speaker-program") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Speaker / Program</h3>
        <p className="mt-1 text-xs text-slate-500">Program data will be sourced from event agenda APIs once available.</p>
        <p className="mt-2 text-xs text-slate-700">{data.event.description || "Add event narrative in the event record to show program highlights here."}</p>
      </div>
    );
  }

  if (sectionId === "schedule") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
        <p className="mt-2 text-xs text-slate-700">Event window: {formatDateTimeRange(data.event.startDate, data.event.endDate)}</p>
        <p className="mt-1 text-xs text-slate-500">Detailed schedule blocks are pending a dedicated event agenda model.</p>
      </div>
    );
  }

  if (sectionId === "faq") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">FAQ</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          <li>• What is the dress code? See event details.</li>
          <li>• Where can I park? Venue instructions will publish with location details.</li>
          <li>• How do I update registration? Use registration confirmation links.</li>
        </ul>
      </div>
    );
  }

  if (sectionId === "map-location") {
    const locationParts = [data.event.address, data.event.city, data.event.state, data.event.zip].filter(Boolean).join(", ");
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Map / Location</h3>
        <p className="mt-1 text-xs text-slate-600">{data.event.location ?? "Venue name not set"}</p>
        <p className="text-xs text-slate-500">{locationParts || "Address not configured"}</p>
        {data.event.virtualUrl ? <p className="mt-1 text-xs text-violet-700">Virtual URL configured for hybrid access.</p> : null}
      </div>
    );
  }

  if (sectionId === "sponsor-logos") {
    const logoSponsors = data.sponsors.filter((sponsor) => Boolean(sponsor.logoUrl));
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Sponsor Logos</h3>
        {logoSponsors.length > 0 ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {logoSponsors.slice(0, 6).map((sponsor) => (
              <div key={sponsor.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {sponsorName(sponsor)}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No sponsor logos available yet.</p>
        )}
      </div>
    );
  }

  if (sectionId === "share-buttons") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Share Buttons</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-300 px-2 py-1">Copy Link</span>
          <span className="rounded-full border border-slate-300 px-2 py-1">Email</span>
          <span className="rounded-full border border-slate-300 px-2 py-1">Facebook</span>
          <span className="rounded-full border border-slate-300 px-2 py-1">X</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Footer</h3>
      <p className="mt-2 text-xs text-slate-600">{data.event.name} • {new Date(data.event.startDate).getFullYear()} • Contact the events office for support.</p>
    </div>
  );
}

/** Center live preview canvas for event-scoped public page composition. */
export default function EventPageBuilderPreview({ sections, selectedSectionId, data }: EventPageBuilderPreviewProps) {
  const visibleSections = sections.filter((section) => section.enabled);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Live Preview</p>
        <p className="mt-1 text-xs text-slate-600">This preview stays connected to Events CRM source data for the selected event.</p>
      </div>

      <div className="mt-3 space-y-3">
        {visibleSections.map((section) => {
          const selected = section.id === selectedSectionId;
          const definition = getSectionDefinition(section.id);
          return (
            <div key={section.id} className={selected ? "rounded-xl ring-2 ring-violet-400" : "rounded-xl"}>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {definition.label}
              </div>
              {renderSection(section.id, data)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
