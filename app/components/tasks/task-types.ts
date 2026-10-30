export const TASK_TYPES = [
  "CALL",
  "EMAIL",
  "MAIL",
  "MEETING",
  "THANK_YOU",
  "FOLLOW_UP",
  "OTHER",
];
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  snoozedUntil?: string | null;
  archivedAt?: string | null;
  completedAt?: string | null;
  outcome?: string | null;
  assigneeId?: string | null;
  constituentId?: string | null;
  generatedLetterId?: string | null;
  stewardPathEnrollmentId?: string | null;
  stewardPathStepRunId?: string | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  constituent?: { id: string; firstName: string; lastName: string } | null;
  notificationWarning?: string;
  sourceType?: string | null;
  sourceId?: string | null;
}
export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
}
export const taskLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
export const taskOverdue = (task: Task) =>
  ["PENDING", "IN_PROGRESS"].includes(task.status) &&
  Boolean(task.dueDate && new Date(task.dueDate) < new Date());
export function taskLocalDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/** A date-only choice is due at the end of the user's local day, not midnight UTC. */
export function taskDueDate(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : null;
}
