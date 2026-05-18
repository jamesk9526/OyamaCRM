/** Shared types for the event-scoped Events CRM page builder workspace. */

export type EventPageStatus = "Draft" | "Published";

export interface EventPageBuilderConfig {
  eventId: string;
  pageSlug: string;
  pageUrl: string;
  baseOrigin: string;
  status: EventPageStatus;
  lastPublishedAt: string | null;
}

export type EventPageSectionId =
  | "hero"
  | "event-details"
  | "registration-form"
  | "table-host-signup"
  | "sponsorship-levels"
  | "donation-goal"
  | "progress-meter"
  | "speaker-program"
  | "schedule"
  | "faq"
  | "map-location"
  | "sponsor-logos"
  | "share-buttons"
  | "footer";

export interface EventPageSectionDefinition {
  id: EventPageSectionId;
  label: string;
  description: string;
}

export interface EventPageSectionState {
  id: EventPageSectionId;
  enabled: boolean;
  lockToEventData: boolean;
}

export interface EventBuilderEventDetail {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  virtualUrl?: string | null;
  startDate: string;
  endDate?: string | null;
  registrationDeadline?: string | null;
  registrationGoal?: number | null;
  revenueGoal?: number | string | null;
  capacity?: number | null;
  active?: boolean | null;
}

export interface EventBuilderTicketType {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  capacity?: number | null;
  available?: number | null;
  isTable?: boolean;
  seatsIncluded?: number;
}

export interface EventBuilderSponsor {
  id: string;
  level?: string | null;
  amount?: number | string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  constituent?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

export interface EventBuilderReport {
  attendance: {
    total: number;
    checkedIn: number;
    noShows: number;
    attendanceRate: number;
    goal: number | null;
    progress: number | null;
  };
  revenue: {
    total: number;
    fromOrders: number;
    fromDonations: number;
    orderCount: number;
    donationCount: number;
    goal: number | null;
    progress: number | null;
  };
}

export interface EventPageBuilderWorkspaceData {
  event: EventBuilderEventDetail;
  ticketTypes: EventBuilderTicketType[];
  sponsors: EventBuilderSponsor[];
  report: EventBuilderReport | null;
  publicUrl: string;
}
