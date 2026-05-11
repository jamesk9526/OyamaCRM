// Shared appointment types and option constants for Compassion scheduling UI.

export interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName?: string;
  supportsScheduling?: boolean;
}

export interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export interface AppointmentFlags {
  firstVisit: boolean;
  followUpNeeded: boolean;
  noShowRisk: boolean;
  incompleteIntake: boolean;
  noShowCount: number;
}

export interface CompassionAppointmentRecord {
  id: string;
  clientId: string;
  caseId?: string | null;
  appointmentType: string;
  status: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number;
  timezone?: string;
  location?: string | null;
  notes?: string | null;
  outcome?: string | null;
  followUpNeeded?: boolean;
  assignedStaffId?: string | null;
  assignedCompassionStaffId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    intakeDate?: string | null;
  };
  case?: {
    id: string;
    caseNumber: string;
  } | null;
  assignedStaff?: StaffOption | null;
  staff?: StaffOption | null;
  flags?: AppointmentFlags;
}

export interface AppointmentFilters {
  search: string;
  status: string;
  appointmentType: string;
  assignedStaffId: string;
  dateFrom: string;
  dateTo: string;
  location: string;
}

export const APPOINTMENT_TYPE_OPTIONS = [
  "INTAKE",
  "PREGNANCY_TEST",
  "ULTRASOUND",
  "PARENTING_CLASS",
  "MATERIAL_ASSISTANCE",
  "RESOURCE_REFERRAL",
  "FOLLOW_UP",
  "MENTORING",
  "CASE_REVIEW",
  "HOME_VISIT",
  "OTHER",
] as const;

export const APPOINTMENT_STATUS_OPTIONS = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const;
