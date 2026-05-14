// Executes Steward suggested actions with confirm-first safety and explicit routing.

import type {
  StewardArtifact,
  StewardCsvRowsArtifact,
  StewardDonorListArtifact,
  StewardEmailDraftArtifact,
  StewardStructuredResponse,
  StewardSuggestedAction,
} from "@/app/components/ai/steward-artifact-types";

export interface ExecuteStewardActionInput {
  action: StewardSuggestedAction;
  structured?: StewardStructuredResponse;
  replyContent?: string;
  confirm: (message: string) => boolean | Promise<boolean>;
  callApi: (path: string, init?: { method?: string; body?: string }) => Promise<unknown>;
  navigate: (path: string) => void;
  copyText: (value: string) => Promise<void>;
}

export type ExecuteStewardActionResult =
  | { status: "executed"; message: string }
  | { status: "cancelled"; message: string }
  | { status: "ignored"; message: string }
  | { status: "failed"; message: string };

function asSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPayloadString(action: StewardSuggestedAction, key: string): string {
  return asSafeString(action.payload?.[key]);
}

function findArtifact<T extends StewardArtifact["type"]>(
  structured: StewardStructuredResponse | undefined,
  type: T,
): Extract<StewardArtifact, { type: T }> | undefined {
  return structured?.artifacts.find((artifact) => artifact.type === type) as Extract<StewardArtifact, { type: T }> | undefined;
}

function toCsvText(columns: string[], rows: Array<Record<string, string | number | null>>): string {
  const escapeCell = (value: string | number | null | undefined) => {
    const normalized = value == null ? "" : String(value);
    if (!/[",\n]/.test(normalized)) return normalized;
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const header = columns.map((column) => escapeCell(column)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function inferDonorId(action: StewardSuggestedAction, structured?: StewardStructuredResponse): string {
  const direct = readPayloadString(action, "donorId") || readPayloadString(action, "constituentId");
  if (direct) return direct;

  const donorList = findArtifact(structured, "donor_list");
  if (!donorList || donorList.rows.length === 0) return "";
  const firstRow = donorList.rows[0];

  const rowId = firstRow.id ?? firstRow.constituentId ?? firstRow.donorId;
  return rowId == null ? "" : String(rowId).trim();
}

async function runSaveEmailDraft(
  input: ExecuteStewardActionInput,
  emailDraft: StewardEmailDraftArtifact,
): Promise<ExecuteStewardActionResult> {
  const approved = await input.confirm("Save this email draft for staff review?");
  if (!approved) {
    return { status: "cancelled", message: "Save draft canceled." };
  }

  await input.callApi("/api/steward-signals/email-draft/save", {
    method: "POST",
    body: JSON.stringify({
      confirm: true,
      donorId: readPayloadString(input.action, "donorId") || undefined,
      donorName: readPayloadString(input.action, "donorName") || undefined,
      subject: emailDraft.subject,
      previewText: emailDraft.previewText,
      bodyMarkdown: emailDraft.bodyMarkdown ?? emailDraft.body,
      bodyPlainText: emailDraft.bodyPlainText ?? emailDraft.body,
      bodyHtml: emailDraft.bodyHtml,
    }),
  });

  return { status: "executed", message: "Email draft saved for review." };
}

async function runCreateFollowUpTask(input: ExecuteStewardActionInput): Promise<ExecuteStewardActionResult> {
  const donorId = inferDonorId(input.action, input.structured);
  if (!donorId) {
    return { status: "failed", message: "Cannot create follow-up task: donor ID is missing." };
  }

  const approved = await input.confirm("Create a follow-up task from this suggestion?");
  if (!approved) {
    return { status: "cancelled", message: "Create task canceled." };
  }

  await input.callApi("/api/steward-signals/email-draft/create-follow-up-task", {
    method: "POST",
    body: JSON.stringify({
      confirm: true,
      donorId,
      title: readPayloadString(input.action, "title") || undefined,
      note: readPayloadString(input.action, "note") || undefined,
      dueDate: readPayloadString(input.action, "dueDate") || undefined,
    }),
  });

  return { status: "executed", message: "Follow-up task created." };
}

async function runPrepareStewardLoop(input: ExecuteStewardActionInput): Promise<ExecuteStewardActionResult> {
  const donorId = inferDonorId(input.action, input.structured);
  const emailDraft = findArtifact(input.structured, "email_draft");

  if (!donorId) {
    return { status: "failed", message: "Cannot prepare steward loop: donor ID is missing." };
  }
  if (!emailDraft) {
    return { status: "failed", message: "Cannot prepare steward loop: email draft artifact is missing." };
  }

  const approved = await input.confirm("Prepare Steward Loop now? This saves a draft and creates a follow-up task.");
  if (!approved) {
    return { status: "cancelled", message: "Prepare Steward Loop canceled." };
  }

  await input.callApi("/api/steward-signals/email-draft/save", {
    method: "POST",
    body: JSON.stringify({
      confirm: true,
      donorId,
      donorName: readPayloadString(input.action, "donorName") || undefined,
      subject: emailDraft.subject,
      previewText: emailDraft.previewText,
      bodyMarkdown: emailDraft.bodyMarkdown ?? emailDraft.body,
      bodyPlainText: emailDraft.bodyPlainText ?? emailDraft.body,
      bodyHtml: emailDraft.bodyHtml,
    }),
  });

  await input.callApi("/api/steward-signals/email-draft/create-follow-up-task", {
    method: "POST",
    body: JSON.stringify({
      confirm: true,
      donorId,
      title: readPayloadString(input.action, "title") || "Steward Loop follow-up",
      note: readPayloadString(input.action, "note") || "Review saved draft and select outreach channel.",
    }),
  });

  return { status: "executed", message: "Steward Loop prepared: draft saved and task created." };
}

async function runCopyDonorList(
  input: ExecuteStewardActionInput,
  donorList: StewardDonorListArtifact,
): Promise<ExecuteStewardActionResult> {
  const rows = donorList.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "failed", message: "No donor list rows were available to copy." };
  }

  const columns = donorList.columns && donorList.columns.length > 0
    ? donorList.columns
    : Object.keys(rows[0]);

  await input.copyText(toCsvText(columns, rows));
  return { status: "executed", message: "Donor list copied to clipboard." };
}

async function runCopyCsv(
  input: ExecuteStewardActionInput,
  csvArtifact: StewardCsvRowsArtifact,
): Promise<ExecuteStewardActionResult> {
  const rows = csvArtifact.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "failed", message: "No CSV rows were available to copy." };
  }

  const columns = csvArtifact.columns && csvArtifact.columns.length > 0
    ? csvArtifact.columns
    : Object.keys(rows[0]);

  await input.copyText(toCsvText(columns, rows));
  return { status: "executed", message: "CSV copied to clipboard." };
}

export async function executeStewardSuggestedAction(input: ExecuteStewardActionInput): Promise<ExecuteStewardActionResult> {
  const actionType = input.action.actionType;

  if (actionType === "communications.create_email_draft") {
    const emailDraft = findArtifact(input.structured, "email_draft");
    if (!emailDraft) {
      return { status: "failed", message: "Cannot save email draft: email draft artifact is missing." };
    }
    return runSaveEmailDraft(input, emailDraft);
  }

  if (actionType === "tasks.create_follow_up_task") {
    return runCreateFollowUpTask(input);
  }

  if (actionType === "open_donor") {
    const donorId = inferDonorId(input.action, input.structured);
    if (!donorId) {
      return { status: "failed", message: "Cannot open donor: donor ID is missing." };
    }

    input.navigate(`/constituents/${encodeURIComponent(donorId)}`);
    return { status: "executed", message: "Opening donor profile." };
  }

  if (actionType === "copy_donor_list") {
    const donorList = findArtifact(input.structured, "donor_list");
    if (!donorList) {
      return { status: "failed", message: "Cannot copy donor list: donor list artifact is missing." };
    }
    return runCopyDonorList(input, donorList);
  }

  if (actionType === "copy_csv") {
    const csvArtifact = findArtifact(input.structured, "csv_rows");
    if (!csvArtifact) {
      return { status: "failed", message: "Cannot copy CSV: csv_rows artifact is missing." };
    }
    return runCopyCsv(input, csvArtifact);
  }

  if (actionType === "prepare_steward_loop") {
    return runPrepareStewardLoop(input);
  }

  if (actionType === "open_report") {
    const requestedPath = readPayloadString(input.action, "path") || readPayloadString(input.action, "reportPath");
    input.navigate(requestedPath || "/reports?tab=overview&module=donor");
    return { status: "executed", message: "Opening related report." };
  }

  if (actionType === "copy") {
    const copySource = readPayloadString(input.action, "text")
      || input.structured?.replyMarkdown
      || input.replyContent
      || "";

    if (!copySource.trim()) {
      return { status: "failed", message: "No content was available to copy." };
    }

    await input.copyText(copySource);
    return { status: "executed", message: "Content copied to clipboard." };
  }

  return { status: "ignored", message: `Action '${actionType}' is not available yet.` };
}
