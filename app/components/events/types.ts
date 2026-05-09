/** Shared Events CRM frontend types used across dashboard and workspace pages. */

/** Event list item returned by /api/events. */
export interface EventItem {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  registrationGoal?: number | null;
  revenueGoal?: number | null;
  active: boolean;
  _count?: {
    attendances: number;
    volunteerHours: number;
  };
}

/** Events CRM command-center summary returned by /api/events/dashboard-summary. */
export interface EventsDashboardSummary {
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  registeredGuests: number;
  checkedInGuests: number;
  totalRevenue: number;
  openSeats: number;
  volunteerHours: number;
}
