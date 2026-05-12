// Shared type contracts for OyamaHRM API responses and payloads.

/** One HRM dashboard metrics payload returned by GET /api/hrm/dashboard. */
export interface HrmDashboardResponse {
  metrics: {
    activeStaff: number;
    boardMembers: number;
    locations: number;
    peopleScheduledToday: number;
    openInternalMessages: number;
    profileCompletionNeeded: number;
  };
  todaySchedule: HrmScheduleItem[];
  locationStatus: Array<{
    id: string;
    location: string;
    status: string;
    coverage: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    createdAt: string;
    senderName: string;
  }>;
}

/** One flattened schedule assignment entry from meetings or Compassion appointments. */
export interface HrmScheduleItem {
  id: string;
  source: "meeting" | "appointment";
  personKey: string;
  personName: string;
  title: string;
  location: string | null;
  startTime: string;
  endTime: string | null;
  status: string;
}

/** One overlap alert row for conflicting schedule assignments. */
export interface HrmScheduleConflict {
  personKey: string;
  personName: string;
  first: HrmScheduleItem;
  second: HrmScheduleItem;
}

/** Scheduling response from GET /api/hrm/scheduling. */
export interface HrmSchedulingResponse {
  selectedDate: string;
  todayItems: HrmScheduleItem[];
  upcomingItems: HrmScheduleItem[];
  conflicts: HrmScheduleConflict[];
  staffAvailability: Array<{
    id: string;
    fullName: string;
    title: string | null;
    supportsScheduling: boolean;
  }>;
}

/** One person row in the HRM people directory. */
export interface HrmPersonRecord {
  id: string;
  source: "user" | "staff";
  userId: string | null;
  compassionStaffId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  personType: "staff" | "employee" | "volunteer" | "board_member";
  role: string | null;
  title: string | null;
  locationName: string | null;
  status: "active" | "on_leave" | "inactive";
  assignableToClients: boolean;
  schedulable: boolean;
  linkedUserEmail: string | null;
  hasLinkedUser: boolean;
}

/** People directory response from GET /api/hrm/people. */
export interface HrmPeopleResponse {
  items: HrmPersonRecord[];
  totals: {
    total: number;
    active: number;
    assignable: number;
    schedulable: number;
  };
}

/** One persisted HRM location record exposed by location endpoints. */
export interface HrmLocationRecord {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  coverageToday: number;
}

/** Location list response from GET /api/hrm/locations. */
export interface HrmLocationsResponse {
  items: HrmLocationRecord[];
}

/** One internal message row returned by HRM messaging endpoints. */
export interface HrmMessageRecord {
  id: string;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string | null;
  recipientRole: string | null;
  kind: "DIRECT" | "ANNOUNCEMENT";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  broadcastAll: boolean;
  title: string;
  body: string;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  recipient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

/** Message list response from GET /api/hrm/messages. */
export interface HrmMessagesResponse {
  items: HrmMessageRecord[];
  unreadCount: number;
}

/** One persisted HRM settings record. */
export interface HrmSettingsRecord {
  id: string;
  organizationId: string;
  defaultTimezone: string;
  defaultLocationId: string | null;
  allowCompassionAssignmentSync: boolean;
  requireSchedulableFlag: boolean;
  messageDigestEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** HRM settings response with dropdown location options. */
export interface HrmSettingsResponse {
  item: HrmSettingsRecord;
  locationOptions: Array<{
    id: string;
    name: string;
  }>;
}
