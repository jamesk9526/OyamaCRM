/** Utility helpers for formatting and parsing campaign workspace data. */

/** Audience types supported by send controls and preview APIs. */
export const AUDIENCE_TYPES = ["all", "active", "lapsed", "new", "major", "volunteers"] as const;

/** Human label map for audience segment options. */
export const AUDIENCE_TYPE_LABELS: Record<(typeof AUDIENCE_TYPES)[number], string> = {
  all: "All Constituents",
  active: "Active Donors",
  lapsed: "Lapsed Donors",
  new: "New Donors",
  major: "Major Donors",
  volunteers: "Volunteers",
};

/** Safe date formatting for workspace cards and logs. */
export function formatWorkspaceDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Converts raw audienceFilter JSON string into a best-effort audience type. */
export function parseAudienceType(raw?: string | null): (typeof AUDIENCE_TYPES)[number] {
  if (!raw) return "all";
  try {
    const parsed = JSON.parse(raw) as { type?: string };
    if (parsed.type && AUDIENCE_TYPES.includes(parsed.type as (typeof AUDIENCE_TYPES)[number])) {
      return parsed.type as (typeof AUDIENCE_TYPES)[number];
    }
  } catch {
    // Default fallback if older records contain malformed JSON.
  }
  return "all";
}

/** Friendly labels for send-log audit actions. */
export function formatSendAction(action: string): string {
  switch (action) {
    case "EMAIL_CAMPAIGN_SENT":
      return "Campaign Sent";
    case "EMAIL_CAMPAIGN_SEND_FAILED":
      return "Send Failed";
    case "EMAIL_CAMPAIGN_TEST_SENT":
      return "Test Email Sent";
    case "EMAIL_CAMPAIGN_SCHEDULED":
      return "Scheduled";
    case "EMAIL_CAMPAIGN_CANCELLED":
      return "Schedule Cancelled";
    default:
      return action.replace(/_/g, " ");
  }
}
