// Shared meeting status labels and badge styles for the DonorCRM meetings workspace.

export const STATUS_LABELS: Record<string, string> = {
  "": "All Statuses",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  NO_SHOW: "No-Show",
  NEEDS_FOLLOW_UP: "Needs Follow-Up",
};

export const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELED: "bg-gray-100 text-gray-500",
  NO_SHOW: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-yellow-100 text-yellow-700",
  NEEDS_FOLLOW_UP: "bg-orange-100 text-orange-700",
};
