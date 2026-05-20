// Executes Steward suggested actions with confirm-first safety and explicit routing.

import type {
  StewardArtifact,
  StewardCsvRowsArtifact,
  StewardDonorListArtifact,
  StewardEmailDraftArtifact,
  StewardStructuredResponse,
  StewardSuggestedAction,
} from "@/app/components/ai/steward-artifact-types";
import type { BlockType, EmailBlock, EmailTemplate } from "@/app/lib/email-builder-types";
import { createDefaultBlock, generateEmailHtml, generatePlainText } from "@/app/lib/email-builder-utils";

export interface ExecuteStewardActionInput {
  action: StewardSuggestedAction;
  structured?: StewardStructuredResponse;
  replyContent?: string;
  confirm: (message: string) => boolean | Promise<boolean>;
  callApi: (path: string, init?: { method?: string; body?: string }) => Promise<unknown>;
  navigate: (path: string) => void;
  copyText: (value: string) => Promise<void>;
  replaceWorkspaceNotes?: (value: string) => void;
  appendWorkspaceNotes?: (value: string) => void;
  prependWorkspaceNotes?: (value: string) => void;
  clearWorkspaceNotes?: () => void;
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

function toSupportedBlockType(value: unknown): BlockType {
  const candidate = String(value ?? "").trim();
  const supported: BlockType[] = [
    "heading",
    "text",
    "quote",
    "impactStat",
    "impactStory",
    "impactGrid",
    "progress",
    "timeline",
    "callout",
    "featureList",
    "donorThankYou",
    "donationReceipt",
    "givingSummary",
    "donationCta",
    "monthlyDonorInvitation",
    "lapsedDonorReengagement",
    "firstTimeDonorWelcome",
    "staffSignature",
    "footerCompliance",
    "image",
    "video",
    "button",
    "aiText",
    "aiButton",
    "divider",
    "spacer",
    "social",
    "columns",
    "customHtml",
  ];
  return supported.includes(candidate as BlockType) ? (candidate as BlockType) : "text";
}

function hydrateTemplateWithIds(rawTemplate: unknown): EmailTemplate {
  const source = rawTemplate && typeof rawTemplate === "object" && !Array.isArray(rawTemplate)
    ? (rawTemplate as Record<string, unknown>)
    : {};

  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const blocks: EmailBlock[] = rawBlocks.slice(0, 32).map((rawBlock) => {
    const blockObj = rawBlock && typeof rawBlock === "object" && !Array.isArray(rawBlock)
      ? (rawBlock as Record<string, unknown>)
      : {};
    const type = toSupportedBlockType(blockObj.type);
    const base = createDefaultBlock(type);
    return {
      ...base,
      ...blockObj,
      id: base.id,
      type,
    } as EmailBlock;
  });

  return {
    backgroundColor: typeof source.backgroundColor === "string" ? source.backgroundColor : "#f5f5f5",
    contentWidth: typeof source.contentWidth === "number" ? source.contentWidth : 600,
    fontFamily: typeof source.fontFamily === "string" ? source.fontFamily : "Arial, Helvetica, sans-serif",
    blocks,
  };
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

async function runBuildFullEmailWorkspace(input: ExecuteStewardActionInput): Promise<ExecuteStewardActionResult> {
  const approved = await input.confirm("Build a full email-builder draft campaign from this request?");
  if (!approved) {
    return { status: "cancelled", message: "Build full email canceled." };
  }

  const goal = readPayloadString(input.action, "goal") || input.replyContent || "Create a donor outreach email draft.";
  const audience = readPayloadString(input.action, "audience") || "General donor audience";
  const tone = readPayloadString(input.action, "tone") || "warm";
  const campaignName = readPayloadString(input.action, "campaignName") || "Steward AI Draft Campaign";

  const generated = await input.callApi("/api/communications-ai/email-builder/generate-template", {
    method: "POST",
    body: JSON.stringify({ goal, audience, tone, campaignName }),
  }) as {
    data?: {
      template?: unknown;
    };
  };

  const hydratedTemplate = hydrateTemplateWithIds(generated?.data?.template);
  const bodyHtml = generateEmailHtml(hydratedTemplate);
  const bodyText = generatePlainText(hydratedTemplate);

  const created = await input.callApi("/api/email-campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: campaignName,
      subject: readPayloadString(input.action, "subject") || "Steward AI Campaign Draft",
      previewText: readPayloadString(input.action, "previewText") || "Draft generated by Steward AI",
      bodyHtml,
      bodyText,
      templateJson: JSON.stringify(hydratedTemplate),
      preparationStatus: "DRAFT",
      purpose: "FUNDRAISING",
    }),
  }) as { id?: string };

  if (!created?.id) {
    return { status: "failed", message: "Email campaign was created without an id." };
  }

  input.navigate(`/email-builder?campaign=${encodeURIComponent(created.id)}&returnTo=${encodeURIComponent(`/communications/${created.id}`)}`);
  return { status: "executed", message: "Full email campaign draft created and opened in Email Builder." };
}

async function runBuildFullLetterDraft(input: ExecuteStewardActionInput): Promise<ExecuteStewardActionResult> {
  const approved = await input.confirm("Build a full letter draft in Letters & Printables workspace?");
  if (!approved) {
    return { status: "cancelled", message: "Build letter draft canceled." };
  }

  const emailDraft = findArtifact(input.structured, "email_draft");
  const fallbackBody = readPayloadString(input.action, "body") || input.replyContent || "Letter draft body";
  const printBody = emailDraft?.bodyPlainText || emailDraft?.bodyMarkdown || emailDraft?.body || fallbackBody;
  const printSubject = emailDraft?.subject || readPayloadString(input.action, "subject") || "Steward AI Letter Draft";
  const templateName = readPayloadString(input.action, "name") || `Steward Letter: ${printSubject}`.slice(0, 120);

  const created = await input.callApi("/api/letters/templates", {
    method: "POST",
    body: JSON.stringify({
      name: templateName,
      category: readPayloadString(input.action, "category") || "GENERAL",
      status: "DRAFT",
      printSubject,
      printBody,
      emailSubject: emailDraft?.subject || null,
      emailBody: emailDraft?.bodyHtml || null,
      crmScope: "DONOR",
    }),
  }) as { id?: string };

  if (!created?.id) {
    return { status: "failed", message: "Letter template was created without an id." };
  }

  input.navigate(`/letters-printables/templates/${encodeURIComponent(created.id)}`);
  return { status: "executed", message: "Full letter draft created and opened in Letters workspace." };
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

  if (actionType === "communications.build_full_email_workspace") {
    return runBuildFullEmailWorkspace(input);
  }

  if (actionType === "letters.build_full_letter_draft") {
    return runBuildFullLetterDraft(input);
  }

  if (actionType === "letters.create_letter_draft") {
    return runBuildFullLetterDraft(input);
  }

  if (actionType === "letters.create_html_css_letter_draft") {
    const approved = await input.confirm("Create a styled HTML/CSS draft letter from this response?");
    if (!approved) {
      return { status: "cancelled", message: "HTML/CSS draft letter creation canceled." };
    }

    const payload = (input.action.payload && typeof input.action.payload === "object" && !Array.isArray(input.action.payload))
      ? input.action.payload as Record<string, unknown>
      : {};

    const response = await input.callApi("/api/steward-ai/tools/execute", {
      method: "POST",
      body: JSON.stringify({
        tool: "letters.createHtmlCssLetterDraft",
        confirm: true,
        input: {
          name: readPayloadString(input.action, "name") || "Steward Styled Letter Draft",
          category: readPayloadString(input.action, "category") || "GENERAL",
          printSubject: readPayloadString(input.action, "printSubject") || "Steward Styled Letter Draft",
          bodyHtml: readPayloadString(input.action, "bodyHtml") || input.replyContent || "<p>Letter draft body</p>",
          css: readPayloadString(input.action, "css") || "",
          description: readPayloadString(input.action, "description") || "Styled HTML/CSS draft generated by Steward.",
          emailSubject: readPayloadString(input.action, "emailSubject") || "",
          emailBody: readPayloadString(input.action, "emailBody") || "",
          ...payload,
        },
      }),
    }) as {
      result?: {
        deepLink?: string;
      };
    };

    const deepLink = response?.result?.deepLink;
    if (deepLink) {
      input.navigate(deepLink);
      return { status: "executed", message: "Styled letter draft created and opened in Letters workspace." };
    }

    return { status: "executed", message: "Styled letter draft created." };
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

  if (actionType === "workspace.notes.replace") {
    const nextContent = readPayloadString(input.action, "content") || readPayloadString(input.action, "text");
    if (!nextContent) {
      return { status: "failed", message: "No note content provided for replace action." };
    }
    input.replaceWorkspaceNotes?.(nextContent);
    return { status: "executed", message: "Workspace note replaced." };
  }

  if (actionType === "workspace.notes.append") {
    const nextContent = readPayloadString(input.action, "content") || readPayloadString(input.action, "text");
    if (!nextContent) {
      return { status: "failed", message: "No note content provided for append action." };
    }
    input.appendWorkspaceNotes?.(nextContent);
    return { status: "executed", message: "Workspace note updated." };
  }

  if (actionType === "workspace.notes.prepend") {
    const nextContent = readPayloadString(input.action, "content") || readPayloadString(input.action, "text");
    if (!nextContent) {
      return { status: "failed", message: "No note content provided for prepend action." };
    }
    input.prependWorkspaceNotes?.(nextContent);
    return { status: "executed", message: "Workspace note updated." };
  }

  if (actionType === "workspace.notes.clear") {
    input.clearWorkspaceNotes?.();
    return { status: "executed", message: "Workspace note cleared." };
  }

  return { status: "ignored", message: `Action '${actionType}' is not available yet.` };
}
