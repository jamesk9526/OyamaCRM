export { ULTRASOUND_EXAM_TYPES, ULTRASOUND_APPROACHES } from "@/server/src/compassion/ultrasound-fields";

export const ULTRASOUND_NOTE_FIELDS = [
  { key: "indication", label: "Indication / reason for exam" },
  { key: "findings", label: "Findings" },
  { key: "impression", label: "Clinical impression" },
  { key: "followUp", label: "Follow-up plan" },
] as const;

export interface UltrasoundFollowUp {
  id: string;
  dueDate: string;
  status: string;
  priority: string;
}

export interface UltrasoundRow {
  id: string;
  clientId: string;
  authorId: string;
  status: "DRAFT" | "REVIEW" | "SIGNED";
  version: number;
  createdAt: string;
  updatedAt: string;
  examDate: string;
  examType: string;
  performedBy: string;
  attachmentCount: number;
  client: { id: string; firstName: string; lastName: string };
  appointment: { id: string; startTime: string; status: string; location: string | null } | null;
  followUps: UltrasoundFollowUp[];
}

export interface UltrasoundWorklist {
  items: UltrasoundRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { DRAFT: number; REVIEW: number; SIGNED: number };
}

export interface UltrasoundChart {
  id: string;
  clientId: string;
  authorId: string;
  kind: string;
  status: string;
  version: number;
  updatedAt: string;
  content: Record<string, unknown>;
  client?: { id: string; firstName: string; lastName: string };
}

export interface UltrasoundDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  chartId: string | null;
}

export const chartStatusLabel = (status: string) => ({ DRAFT: "Draft", REVIEW: "Awaiting review", SIGNED: "Signed" })[status] ?? status;
export const formatCareDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date not recorded";
