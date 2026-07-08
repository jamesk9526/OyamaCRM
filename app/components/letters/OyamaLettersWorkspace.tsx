/** New OyamaLetters workspace: mockup-style UI backed only by live letters APIs. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";
import { formatDonationDate } from "@/app/components/donations/donation-utils";
import { InfoTooltip, WorkspaceHint } from "@/app/components/workspace/WorkspaceHelp";
import LetterPage from "@/app/components/letters/LetterPage";
import {
  DEFAULT_BRANDING_SETTINGS,
  formatBrandingAddress,
  normalizeBrandingSettings,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import type {
  GeneratedLetterSummary,
  HeaderPreset,
  FooterPreset,
  LetterMailQueueItem,
  LetterPrintQueueItem,
  LetterTemplateSummary,
  MergeFieldSection,
  SignatureBlock,
} from "@/app/components/letters/types";

type WorkspaceView = "library" | "builder" | "publish" | "generate" | "queue" | "settings" | "howto";
type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type TemplateOwnershipScope = "MINE" | "TEAM" | "ALL";
type TemplateProvenanceScope = "ALL" | "HUMAN" | "AI";
type LetterTextAlign = "left" | "center" | "right" | "justify";
type LetterTableBorderStyle = "solid" | "dashed" | "none";
const LETTER_TEMPLATE_AI_ASSISTED_MARKER = "oyama-ai-assisted";

interface OyamaLettersWorkspaceProps {
  view?: WorkspaceView;
  templateId?: string;
}

interface LetterTemplateDetail extends LetterTemplateSummary {
  printSubject?: string | null;
  printBody?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  headerPresetId?: string | null;
  footerPresetId?: string | null;
  signatureBlockId?: string | null;
  logoMode?: string | null;
  customLogoUrl?: string | null;
  crmScope?: string | null;
  mergeFieldsUsed?: string[] | null;
  headerPreset?: HeaderPreset | null;
  footerPreset?: FooterPreset | null;
  signatureBlock?: SignatureBlock | null;
}

interface ConstituentLookup {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  organizationName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  entityKind?: string | null;
  type?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  doNotMail?: boolean | null;
  donorStatus?: string | null;
  tags?: Array<{ tag?: { name?: string | null; color?: string | null } | null }>;
}

interface RecipientListSummary {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
}

interface RecipientListDetail {
  id: string;
  name: string;
  recipients: Array<{ email: string; firstName?: string | null; lastName?: string | null }>;
}

interface TemporaryRecipientList {
  name: string;
  constituentIds: string[];
  donationIds?: string[];
  createdAt: string;
}

interface ConstituentTagCatalog {
  id: string;
  name: string;
  color?: string | null;
  constituentsCount?: number;
}

interface DonationLookup {
  id: string;
  amount: number | string;
  date: string;
  dateLabel?: string | null;
  constituentId?: string | null;
  constituent?: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    organizationName?: string | null;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    entityKind?: string | null;
    type?: string | null;
  } | null;
}

interface PreviewResult {
  mergedPrintBody: string;
  mergedEmailBody?: string | null;
  missingFields: string[];
  unsupportedFields: string[];
}

interface MergeLinePreviewItem {
  constituentId: string;
  donationId?: string | null;
  recipientName: string;
  renderedLine: string;
  missingFields?: string[];
  unsupportedFields?: string[];
}

interface MergeLinePreviewResponse {
  items: MergeLinePreviewItem[];
}

interface BatchResult {
  dryRun?: boolean;
  batchId?: string;
  candidateCount?: number;
  totalSelected?: number;
  eligible?: number;
  generatedCount: number;
  generatedIds?: string[];
  skippedCount?: number;
  skippedByReason?: Record<string, number>;
  skipped: Array<{ constituentId: string; reason: string }>;
  generated?: Array<{ id: string; constituentId: string; constituentName: string }>;
  generatedSample?: Array<{ id: string; constituentId: string; constituentName: string }>;
  addToPrintQueue?: boolean;
  deliveryTarget?: DeliveryTarget;
  donationMode?: DonationMode;
  queuedForPrintCount?: number;
  queuedForMailCount?: number;
}

interface WorkflowPolicy {
  autoQueueBatchToPrint: boolean;
  requirePrintApproval: boolean;
  defaultPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  mailingSlaDays: number;
  allowDirectMailQueue: boolean;
  enableAddressValidationGate: boolean;
  pdfFallbackMode: "SERVER_RENDER" | "BROWSER_PRINT" | "DISABLED";
  notes: string;
}

interface PublishValidationResult {
  canPublish: boolean;
  confirmed?: boolean;
  published?: boolean;
  blockers: string[];
  warnings: string[];
  unsupportedFields?: string[];
  sampleValidation?: {
    valid: boolean;
    reasons: string[];
  } | null;
  samplePdfPreflight?: {
    checked: boolean;
    canRender: boolean;
    renderer: "SERVER_RENDER";
    parser: "htmlToPdfBlocks";
    blockCount: number;
    reason: "NO_SAMPLE_RECIPIENT" | "PARSER_FAILURE" | null;
  };
}

interface PublishHistoryItem {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: string;
  createdByUserId: string;
  previousStatus: string;
  nextStatus: string;
  unsupportedFields: string[];
  warnings: string[];
  samplePdfPreflight?: {
    checked: boolean;
    canRender: boolean;
    renderer: "SERVER_RENDER";
    parser: "htmlToPdfBlocks";
    blockCount: number;
    reason: "NO_SAMPLE_RECIPIENT" | "PARSER_FAILURE" | null;
  };
}

interface PublishHistoryResponse {
  items: PublishHistoryItem[];
  count: number;
}

interface LetterAiComposeResponse {
  bodyText: string;
  bodyHtml: string;
  mergeFieldsUsed: string[];
  model?: string;
}

interface LetterAiSuggestResponse {
  suggestion: string;
  model?: string;
}

type SettingsTab = "organization" | "workflow";
type GenerateMode = "single" | "batch";
type DeliveryTarget = "PDF_ONLY" | "PRINT_QUEUE" | "MAIL_QUEUE";
type DonationMode = "recent" | "specific" | "none" | "selected";
type PublishReviewTab = "summary" | "fields" | "validation" | "recipient" | "pdf" | "confirm";

interface HeaderPresetDraft {
  name: string;
  logoAlignment: string;
  showOrganizationName: boolean;
  showTagline: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  customHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

interface FooterPresetDraft {
  name: string;
  showOrganizationName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showTaxId: boolean;
  showPageNumber: boolean;
  customText: string;
  customHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

interface TemplateDraft {
  name: string;
  description: string;
  category: string;
  status: TemplateStatus;
  printSubject: string;
  printBody: string;
  emailSubject: string;
  emailBody: string;
  headerPresetId: string;
  footerPresetId: string;
  signatureBlockId: string;
  logoMode: string;
  customLogoUrl: string;
}

interface TableBuilderDraft {
  rows: number;
  columns: number;
  headerRow: boolean;
  widthPercent: number;
  cellPadding: number;
  borderStyle: LetterTableBorderStyle;
  textAlign: LetterTextAlign;
}

interface TemplateRecoverySnapshot {
  templateId: string | null;
  draft: TemplateDraft;
  lastError: string | null;
  updatedAt: string;
}

const CATEGORIES = [
  "THANK_YOU",
  "TAX_RECEIPT",
  "END_OF_YEAR",
  "NEWSLETTER",
  "CAMPAIGN",
  "SPONSOR",
  "EVENT",
  "MONTHLY_DONOR",
  "MAJOR_DONOR",
  "GENERAL",
];

const EMPTY_DRAFT: TemplateDraft = {
  name: "",
  description: "",
  category: "GENERAL",
  status: "DRAFT",
  printSubject: "Printable Letter",
  printBody: "<p>Dear {{donor.firstName}},</p><p>Thank you for your support of {{organization.name}}.</p><p>With gratitude,</p>",
  emailSubject: "",
  emailBody: "",
  headerPresetId: "",
  footerPresetId: "",
  signatureBlockId: "",
  logoMode: "ORGANIZATION_DEFAULT",
  customLogoUrl: "",
};

const DEFAULT_TABLE_BUILDER: TableBuilderDraft = {
  rows: 3,
  columns: 3,
  headerRow: true,
  widthPercent: 100,
  cellPadding: 8,
  borderStyle: "solid",
  textAlign: "left",
};

const EMPTY_HEADER_PRESET: HeaderPresetDraft = {
  name: "Letters Default Header",
  logoAlignment: "LEFT",
  showOrganizationName: true,
  showTagline: true,
  showAddress: true,
  showPhone: true,
  showWebsite: true,
  customHtml: "",
  isDefault: true,
  isActive: true,
};

const EMPTY_FOOTER_PRESET: FooterPresetDraft = {
  name: "Letters Default Footer",
  showOrganizationName: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWebsite: true,
  showTaxId: true,
  showPageNumber: false,
  customText: "",
  customHtml: "",
  isDefault: true,
  isActive: true,
};

const RULER_PX_PER_INCH = 96;
const LETTERS_TEMPLATE_RECOVERY_STORAGE_KEY = "oyamaLetters.templateRecovery.v1";
const LETTERS_AI_COMPOSER_OPEN_STORAGE_KEY = "oyamaLetters.aiComposerOpen.v1";
const LETTERS_INLINE_SUGGEST_STORAGE_KEY = "oyamaLetters.inlineSuggestEnabled.v1";
const LETTERS_TEMPLATE_SETUP_HINT_DISMISSED_KEY = "oyamaLetters.templateSetupHintDismissed.v1";
const LETTERS_TEMPLATE_SETUP_HINT_COMPLETED_KEY = "oyamaLetters.templateSetupHintCompleted.v1";

const LETTERS_SIDEBAR_ITEMS = [
  { label: "Template Library", href: "/oyama-letters" },
  { label: "Generate Letters", href: "/oyama-letters/generate" },
  { label: "Print & Mail Queue", href: "/oyama-letters/queue" },
  { label: "Settings", href: "/oyama-letters/settings" },
];

/** Top-level dedicated workspace shell. */
export default function OyamaLettersWorkspace({ view = "library", templateId }: OyamaLettersWorkspaceProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("oyamaLettersSidebarCollapsed") === "1";
  });

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("oyamaLettersSidebarCollapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-[100dvh] bg-[#f5f7fa] text-slate-950">
      <div className="flex min-h-[100dvh]">
        <LettersSidebar activeView={view} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className="flex min-w-0 flex-1 flex-col">
          <LettersMobileNav activeView={view} />
          <LettersTopBar view={view} templateId={templateId} />
          {view === "library" ? <TemplateLibrary /> : null}
          {view === "builder" ? <TemplateBuilder templateId={templateId} /> : null}
          {view === "publish" ? <PublishWorkspace templateId={templateId} /> : null}
          {view === "generate" ? <GenerateWorkspace /> : null}
          {view === "queue" ? <QueueWorkspace /> : null}
          {view === "howto" ? <LettersHowToWorkspace /> : null}
          {view === "settings" ? <SettingsWorkspace /> : null}
        </div>
      </div>
    </div>
  );
}

function LettersMobileNav({ activeView }: { activeView: WorkspaceView }) {
  const pathname = usePathname();

  function isActiveRoute(href: string) {
    if (href === "/oyama-letters") {
      return pathname === "/oyama-letters" || pathname.startsWith("/oyama-letters/templates");
    }
    return pathname === href;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-emerald-900/30 bg-[#06291f] px-3 py-2 text-white shadow-lg lg:hidden">
      <div className="flex items-center gap-3">
        <Link href="/oyama-letters" className="min-w-0 text-sm font-semibold tracking-wide">
          OYAMA LETTERS
        </Link>
        <Link href="/constituents" className="ml-auto shrink-0 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-50">
          Donor CRM
        </Link>
      </div>
      <nav className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Oyama Letters mobile navigation">
        {LETTERS_SIDEBAR_ITEMS.map((item) => {
          const active = isActiveRoute(item.href)
            || (item.href === "/oyama-letters/generate" && activeView === "generate")
            || (item.href === "/oyama-letters/queue" && activeView === "queue")
            || (item.href === "/oyama-letters/how-to" && activeView === "howto")
            || (item.href === "/oyama-letters/settings" && activeView === "settings");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                active ? "border-emerald-300 bg-emerald-500/80 text-white" : "border-white/15 bg-white/10 text-emerald-50",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function LettersSidebar({
  activeView,
  collapsed,
  onToggle,
}: {
  activeView: WorkspaceView;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  function isActiveRoute(href: string) {
    if (href === "/oyama-letters") {
      return pathname === "/oyama-letters" || pathname.startsWith("/oyama-letters/templates");
    }
    return pathname === href;
  }

  return (
    <aside className={[
      "hidden shrink-0 flex-col bg-[radial-gradient(circle_at_18%_0%,#0d6b3b_0,#01402c_42%,#022b24_100%)] text-white shadow-xl transition-[width,padding] duration-300 lg:flex",
      collapsed ? "w-[88px] px-2 py-3" : "w-[246px] px-3 py-4",
    ].join(" ")}>
      <div className={[
        "flex items-center rounded-2xl border border-white/15 bg-white/5",
        collapsed ? "justify-center p-3" : "justify-between px-4 py-3",
      ].join(" ")}>
        <Link href="/oyama-letters" className={[
          "flex min-w-0 items-center",
          collapsed ? "justify-center" : "w-full",
        ].join(" ")}>
          <CrmBrandLockup
            moduleLabel="Letters CRM"
            tone="light"
            compact={collapsed}
            className={collapsed ? "" : "w-full"}
          />
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft />
          </button>
        ) : null}
      </div>

      {/* Back to Donor CRM */}
      <Link
        href="/constituents"
        title={collapsed ? "Back to Donor CRM" : undefined}
        className={[
          "mt-3 flex items-center rounded-2xl border border-white/20 bg-white/10 text-xs font-semibold text-emerald-100 transition hover:bg-white/20",
          collapsed ? "h-10 w-10 justify-center self-center" : "gap-2 px-3 py-2",
        ].join(" ")}
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        {!collapsed ? <span>Back to Donor CRM</span> : null}
      </Link>

      <nav className={[
        "flex-1 space-y-1.5 overflow-y-auto",
        collapsed ? "mt-3" : "mt-4",
      ].join(" ")}>
        {LETTERS_SIDEBAR_ITEMS.map((item) => {
          const active = isActiveRoute(item.href)
            || (item.href === "/oyama-letters/generate" && activeView === "generate")
            || (item.href === "/oyama-letters/queue" && activeView === "queue")
            || (item.href === "/oyama-letters/how-to" && activeView === "howto")
            || (item.href === "/oyama-letters/settings" && activeView === "settings");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={[
                "flex h-11 items-center rounded-2xl px-3 text-sm font-semibold transition",
                collapsed ? "justify-center" : "gap-3",
                active ? "bg-emerald-500/70 text-white shadow-inner" : "text-emerald-50 hover:bg-white/10",
              ].join(" ")}
            >
              <LineIcon name={item.label} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3">
        {!collapsed ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm font-semibold">Need Help?</p>
            <p className="mt-2 text-xs leading-5 text-emerald-50">Create, publish, generate, and queue letters.</p>
            <Link href="/help?scope=donor&scopePath=/oyama-letters" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              View Help Articles
            </Link>
          </div>
        ) : null}
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight />
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function LettersTopBar({ view, templateId }: { view: WorkspaceView; templateId?: string }) {
  const { user, signOut } = useAuth();
  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U" : "U";
  const templateLabel = templateId ? titleFromId(templateId) : "New Template";
  const showProcessStepper = view === "library" || view === "builder" || view === "publish" || view === "generate" || view === "queue";

  return (
    <header className="z-30 flex min-h-12 flex-wrap items-center gap-3 border-b border-[#0a4f2e] bg-[radial-gradient(circle_at_18%_0%,#0d6b3b_0,#01402c_42%,#022b24_100%)] px-3 py-2 sm:px-5 lg:sticky lg:top-0 xl:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/oyama-letters" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-white/80 hover:bg-white/10" aria-label="Back to letters home">
          <ChevronLeft />
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Link href="/oyama-letters" className="shrink-0 text-emerald-200 hover:text-white">Template Library</Link>
          {view !== "library" ? <ChevronRight /> : null}
          {view === "builder" || view === "publish" ? <span className="truncate font-semibold text-white/90">{templateLabel}</span> : null}
          {view === "builder" || view === "publish" ? <ChevronRight /> : null}
          <span className="shrink-0 font-semibold text-white">{viewLabel(view)}</span>
        </div>
      </div>
      {showProcessStepper ? <ProcessStepper view={view} templateId={templateId} /> : null}
      <div className="hidden items-center gap-2.5 border-l border-white/20 pl-4 xl:flex">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/80 text-xs font-semibold text-white ring-1 ring-white/20">{initials}</div>
        <div className="leading-tight">
          <p className="max-w-36 truncate text-xs font-semibold text-white">{user ? `${user.firstName} ${user.lastName}` : "Account"}</p>
          <button type="button" onClick={() => void signOut()} className="text-[10px] text-emerald-200 hover:text-white">Sign out</button>
        </div>
      </div>
    </header>
  );
}

function ProcessStepper({ view, templateId }: { view: WorkspaceView; templateId?: string }) {
  const steps = [
    { key: "library", label: "Template Library", href: "/oyama-letters" },
    { key: "builder", label: "Canvas Builder", href: templateId ? `/oyama-letters/templates/${templateId}` : "/oyama-letters/templates/new" },
    { key: "publish", label: "Publish Review", href: templateId ? `/oyama-letters/templates/${templateId}/publish` : "/oyama-letters/templates/new" },
    { key: "generate", label: "Generate Letters", href: "/oyama-letters/generate" },
    { key: "queue", label: "Print & Mail Queue", href: "/oyama-letters/queue" },
  ] as const;
  const activeIndex = steps.findIndex((step) => step.key === view);

  return (
    <div className="hidden min-w-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/20 px-3 py-1.5 lg:flex">
      {steps.map((step, index) => {
        const active = index === activeIndex;
        const complete = activeIndex >= 0 && index < activeIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <Link href={step.href} className="flex items-center gap-1.5">
              <span className={["flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold", active || complete ? "border-emerald-400 bg-emerald-500 text-white" : "border-white/30 bg-white/10 text-emerald-200"].join(" ")}>
                {complete ? <CheckIcon /> : index + 1}
              </span>
              <span className={active ? "text-[11px] font-semibold text-white" : "text-[11px] font-medium text-emerald-200"}>{step.label}</span>
            </Link>
            {index < steps.length - 1 ? <span className="h-px w-8 bg-white/20" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowActionBar({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled = false,
  secondaryAction,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
      <button type="button" onClick={onBack} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        {backLabel}
      </button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {secondaryAction}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center justify-center rounded-md border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function LettersHowToWorkspace() {
  const walkthrough = [
    {
      title: "1. Build a Template",
      summary: "Create the letter layout and connect branding presets.",
      steps: [
        "Open Template Library and choose Create New Template.",
        "Set template name, category, and body content in Canvas Builder.",
        "Use Branding blocks to insert a header, footer, and signature.",
        "Use Save, then click Publish when preflight checks are ready.",
      ],
      actions: [
        { href: "/oyama-letters", label: "Open Template Library" },
        { href: "/oyama-letters/templates/new", label: "Create New Template" },
      ],
    },
    {
      title: "2. Run Generate Preview",
      summary: "Validate recipients, donation context, and merged content before sending.",
      steps: [
        "Go to Generate Letters and choose an ACTIVE template.",
        "Pick recipients from segments, lists, filters, or individuals.",
        "Select donation mode and delivery target.",
        "Use Refresh Preview and Open PDF Preview to verify output.",
      ],
      actions: [
        { href: "/oyama-letters/generate", label: "Open Generate Letters" },
        { href: "/oyama-letters/queue", label: "Open Print & Mail Queue" },
      ],
    },
    {
      title: "3. Process Queue and Batches",
      summary: "Move generated letters through the print and mail queue workflow.",
      steps: [
        "Use Print & Mail Queue to review statuses and priority.",
        "Open Preview or PDF for quality checks before final delivery.",
        "Use queue controls to approve, print, or move mail-ready items.",
        "Return to Generate Letters when you need to run another batch.",
      ],
      actions: [
        { href: "/oyama-letters/queue", label: "Open Queue" },
        { href: "/oyama-letters/generate", label: "Back to Generate" },
      ],
    },
    {
      title: "4. Keep Branding in Sync",
      summary: "Maintain consistent logo, header, footer, and signer details.",
      steps: [
        "Open Settings and use Branding Settings shortcuts.",
        "Update global branding when name, address, or logo changes.",
        "Update the global Communication Header + Footer and signature blocks.",
        "Re-open PDF preview after updates to confirm output quality.",
      ],
      actions: [
        { href: "/oyama-letters/settings", label: "Open Letters Settings" },
        { href: "/settings/branding", label: "Open Global Branding" },
      ],
    },
  ] as const;

  return (
    <>
      <PageHero title="Letters How To" subtitle="Step-by-step walkthrough for creating, publishing, generating, and delivering letters.">
        <Button href="/oyama-letters/templates/new" tone="primary">Start New Template</Button>
        <Button href="/oyama-letters/generate">Go to Generate</Button>
      </PageHero>

      <section className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:p-6">
        <div className="space-y-4">
          {walkthrough.map((item) => (
            <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                {item.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <Button key={action.href} href={action.href}>{action.label}</Button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-base font-semibold text-slate-900">Quick Checklist</p>
            <p className="mt-1 text-sm text-slate-600">Use this every time before production generation.</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Template status is ACTIVE</li>
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Header, footer, and signature are selected</li>
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Preview shows no missing merge data</li>
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Single and batch PDF previews look correct</li>
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Delivery target matches campaign intent</li>
          </ul>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Need More Detail?</p>
            <p className="mt-1 text-sm text-emerald-900">Open support documentation for full examples and troubleshooting.</p>
            <Link href="/help?scope=donor&scopePath=/oyama-letters" className="mt-3 inline-flex rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
              View Help Articles
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}

function TemplateLibrary() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [ownership, setOwnership] = useState<TemplateOwnershipScope>("MINE");
  const [provenance, setProvenance] = useState<TemplateProvenanceScope>("ALL");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [setupHintOpen, setSetupHintOpen] = useState(false);
  const [setupHintStep, setSetupHintStep] = useState<0 | 1 | 2>(0);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [setupHintError, setSetupHintError] = useState<string | null>(null);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(LETTERS_TEMPLATE_SETUP_HINT_DISMISSED_KEY) === "1";
      const completed = window.localStorage.getItem(LETTERS_TEMPLATE_SETUP_HINT_COMPLETED_KEY) === "1";
      if (!dismissed && !completed) setSetupHintOpen(true);
    } catch {
      setSetupHintOpen(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (category !== "ALL") params.set("category", category);
      if (search.trim()) params.set("search", search.trim());
      setTemplates(await apiFetch<LetterTemplateSummary[]>(`/api/letters/templates?${params.toString()}`));
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load templates."));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [category, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTemplates = useMemo(() => templates.filter((item) => {
    const isMine = Boolean(user?.id) && item.createdBy?.id === user?.id;
    if (ownership === "MINE" && !isMine) return false;
    if (ownership === "TEAM" && isMine) return false;
    if (provenance === "AI" && !item.aiAssisted) return false;
    if (provenance === "HUMAN" && item.aiAssisted) return false;
    return true;
  }), [ownership, provenance, templates, user?.id]);

  const activeCount = visibleTemplates.filter((item) => item.status === "ACTIVE").length;
  const draftCount = visibleTemplates.filter((item) => item.status === "DRAFT").length;
  const archivedCount = visibleTemplates.filter((item) => item.status === "ARCHIVED").length;
  const myCount = templates.filter((item) => item.createdBy?.id === user?.id).length;
  const teamCount = templates.filter((item) => item.createdBy?.id && item.createdBy.id !== user?.id).length;
  const aiCount = templates.filter((item) => item.aiAssisted).length;

  function dismissSetupHint() {
    try {
      window.localStorage.setItem(LETTERS_TEMPLATE_SETUP_HINT_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage failures in private mode.
    }
    setSetupHintOpen(false);
  }

  function completeSetupHint() {
    try {
      window.localStorage.setItem(LETTERS_TEMPLATE_SETUP_HINT_COMPLETED_KEY, "1");
    } catch {
      // Ignore storage failures in private mode.
    }
    setSetupHintOpen(false);
  }

  async function applyDefaultsToTemplates() {
    setApplyingDefaults(true);
    setSetupHintError(null);
    try {
      const result = await apiFetch<{ updatedCount: number }>("/api/letters/templates/apply-default-branding", {
        method: "POST",
      });
      completeSetupHint();
      setError(null);
      setNotice(`Applied default header/footer/signature to ${result.updatedCount} template${result.updatedCount === 1 ? "" : "s"}.`);
      void load();
    } catch (requestError) {
      setSetupHintError(errorMessage(requestError, "Could not apply defaults to templates yet."));
    } finally {
      setApplyingDefaults(false);
    }
  }

  async function exportTemplateBackup(template: LetterTemplateSummary) {
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetchResponse(`/api/letters/templates/${encodeURIComponent(template.id)}/export`, { method: "GET" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      downloadBlob(blob, filenameFromDisposition(response.headers.get("content-disposition")) ?? `${safeDownloadName(template.name)}_letter_template.json`);
      setNotice(`Exported ${template.name}.`);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to export template."));
    }
  }

  async function importTemplateBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setImportingTemplate(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const created = await apiFetch<LetterTemplateSummary>("/api/letters/templates/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      setOwnership("ALL");
      setStatus("DRAFT");
      setNotice(`Imported ${created.name} as a draft template.`);
      void load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to import template backup."));
    } finally {
      setImportingTemplate(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fa]">
      <PageHero
        title="Template Library"
        subtitle="Create, edit, and manage your letter templates."
        tooltip="Templates stay reusable here. Generation creates letter batches later so recipients, queue state, and print/mail actions do not mutate the template itself."
      >
        <Button onClick={() => void load()}>Refresh</Button>
        <Button onClick={() => importInputRef.current?.click()} disabled={importingTemplate}>
          {importingTemplate ? "Importing..." : "Import Template"}
        </Button>
        <Button href="/oyama-letters/templates/new" tone="primary">Create New Template</Button>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={(event) => void importTemplateBackup(event)} className="hidden" />
      </PageHero>
      <div className="border-b border-slate-200 bg-white px-4 py-5 xl:px-7">
        <WorkspaceHint title="Recommended Flow" tone="slate">
          Edit and publish the reusable template here first. Move into Generate Letters only when staff is ready to create a live recipient-specific batch.
        </WorkspaceHint>
        <div className="flex flex-wrap items-center gap-4">
          <SearchBox value={search} onChange={setSearch} placeholder="Search templates..." />
          <Select value={category} onChange={setCategory} options={["ALL", ...CATEGORIES]} />
          <Select value={status} onChange={setStatus} options={["ALL", "DRAFT", "ACTIVE", "ARCHIVED"]} />
          <Button onClick={() => void load()}>Apply Filters</Button>
          <Button onClick={() => { setSearch(""); setCategory("ALL"); setStatus("ALL"); setOwnership("MINE"); setProvenance("ALL"); }}>Reset</Button>
          <div className="ml-auto flex gap-2">
            <IconToggle active={layout === "grid"} onClick={() => setLayout("grid")} label="Grid">▦</IconToggle>
            <IconToggle active={layout === "list"} onClick={() => setLayout("list")} label="List">☷</IconToggle>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { value: "MINE", label: "My Templates", count: myCount },
            { value: "TEAM", label: "Team Templates", count: teamCount },
            { value: "ALL", label: "All Templates", count: templates.length },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setOwnership(option.value)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                ownership === option.value ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{option.label}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-600">{option.count}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { value: "ALL", label: "All Provenance" },
            { value: "HUMAN", label: "User Created" },
            { value: "AI", label: `AI-assisted (${aiCount})` },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProvenance(option.value)}
              className={[
                "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold",
                provenance === option.value ? "border-sky-700 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{visibleTemplates.length}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Published</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Draft</p>
            <p className="mt-1 text-2xl font-semibold text-amber-800">{draftCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Archived</p>
            <p className="mt-1 text-2xl font-semibold text-slate-700">{archivedCount}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            Library opens on <span className="font-semibold">your templates</span> first so staff starts from owned drafts before shared content.
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
            <span className="font-semibold">AI-assisted</span> appears only when the builder stored a real provenance marker.
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            Unsaved letter edits keep a <span className="font-semibold">local recovery copy</span> so save failures do not drop work.
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Canonical Workflow</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">1. Build Template</p>
              <p className="mt-1 text-xs text-slate-600">Create or revise reusable content in the builder first.</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">2. Generate Letters</p>
              <p className="mt-1 text-xs text-slate-600">Choose recipients, donation context, and preview output in one guided run.</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">3. Process Queue</p>
              <p className="mt-1 text-xs text-slate-600">Move completed output through print approval and mail handling.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/oyama-letters/templates/new" tone="primary">Start Step 1: New Template</Button>
            <Button href="/oyama-letters/generate">Continue Step 2: Generate</Button>
          </div>
        </div>
      </div>
      <CategoryTabs category={category} setCategory={setCategory} />
      {notice ? <Alert tone="green">{notice}</Alert> : null}
      {error ? <Alert tone="amber">{error}</Alert> : null}
      {loading ? (
        <LoadingGrid />
      ) : visibleTemplates.length === 0 ? (
        <EmptyState title="No templates found" body="No live templates match the current filters. Create a template to begin the OyamaLetters workflow." actionHref="/oyama-letters/templates/new" actionLabel="Create Template" />
      ) : layout === "grid" ? (
        <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 xl:p-6">
          {visibleTemplates.map((template) => <TemplateCard key={template.id} template={template} currentUserId={user?.id ?? null} onExport={exportTemplateBackup} />)}
        </div>
      ) : (
        <div className="space-y-3 p-4 xl:p-6">
          {visibleTemplates.map((template) => <TemplateRow key={template.id} template={template} currentUserId={user?.id ?? null} onExport={exportTemplateBackup} />)}
        </div>
      )}
      <div className="px-4 pb-4 text-xs text-slate-600 xl:px-7 xl:pb-6">
        Showing {visibleTemplates.length} of {templates.length} template{templates.length === 1 ? "" : "s"}
      </div>

      {setupHintOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">First-Time Template Setup</p>
                <p className="mt-1 text-sm text-slate-600">Set up branding assets first so previews and generated PDFs match what recipients receive.</p>
              </div>
              <button type="button" onClick={dismissSetupHint} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Dismiss</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {setupHintStep === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">You need two global branding pieces configured before publishing letters:</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>Communication header and footer in Branding Defaults</li>
                    <li>Default Signature block</li>
                  </ul>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setSetupHintStep(1)} tone="primary">Let&apos;s do it</Button>
                  </div>
                </div>
              ) : null}

              {setupHintStep === 1 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Step-by-step setup</p>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                    <li>Open <Link href="/settings/branding#communication-header-footer" className="font-semibold text-emerald-700 hover:underline">Branding Defaults</Link> and set the Communication Header + Footer.</li>
                    <li>Open <Link href="/settings/branding/signatures" className="font-semibold text-emerald-700 hover:underline">Signatures</Link> and set one active default signature.</li>
                    <li>Return here when done.</li>
                  </ol>
                  <div className="flex justify-between gap-2">
                    <Button onClick={() => setSetupHintStep(0)}>Back</Button>
                    <Button onClick={() => setSetupHintStep(2)} tone="primary">I&apos;ve set them up</Button>
                  </div>
                </div>
              ) : null}

              {setupHintStep === 2 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">Great. Do you want to apply the default signature to current templates now?</p>
                  {setupHintError ? <Alert tone="amber">{setupHintError}</Alert> : null}
                  <div className="flex justify-between gap-2">
                    <Button onClick={() => setSetupHintStep(1)}>Back</Button>
                    <div className="flex gap-2">
                      <Button onClick={completeSetupHint}>Skip for now</Button>
                      <Button onClick={() => void applyDefaultsToTemplates()} tone="primary" disabled={applyingDefaults}>{applyingDefaults ? "Applying..." : "Apply To All Templates"}</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TemplateBuilder({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedEditorRangeRef = useRef<Range | null>(null);
  const lastInlineSuggestionRequestRef = useRef("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const selectedEditorImageRef = useRef<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
  const [mergeSections, setMergeSections] = useState<MergeFieldSection[]>([]);
  const [signatures, setSignatures] = useState<SignatureBlock[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [constituents, setConstituents] = useState<ConstituentLookup[]>([]);
  const [activeRibbon, setActiveRibbon] = useState<"File" | "Insert" | "Format" | "Layout" | "Review" | "View" | "AI">("Insert");
  const [inspectorTab, setInspectorTab] = useState<"Document" | "Merge Fields" | "Block Settings">("Document");
  const [mergeFieldSearch, setMergeFieldSearch] = useState("");
  const [mergeLinePreviewToken, setMergeLinePreviewToken] = useState<string | null>(null);
  const [mergeLinePreview, setMergeLinePreview] = useState<MergeLinePreviewResponse | null>(null);
  const [mergeLinePreviewLoading, setMergeLinePreviewLoading] = useState(false);
  const [mergeLinePreviewError, setMergeLinePreviewError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState("Letter (8.5 x 11 in)");
  const [fontFamily, setFontFamily] = useState("Calibri");
  const [fontSize, setFontSize] = useState("11");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [snippetAlign, setSnippetAlign] = useState<LetterTextAlign>("left");
  const [tableBuilder, setTableBuilder] = useState<TableBuilderDraft>(DEFAULT_TABLE_BUILDER);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
  const [selectedImageAlt, setSelectedImageAlt] = useState("");
  const [selectedImageAlign, setSelectedImageAlign] = useState<"left" | "center" | "right">("center");
  const [zoom, setZoom] = useState(100);
  const [previewMode, setPreviewMode] = useState(false);
  const [showMarginGuides, setShowMarginGuides] = useState(true);
  const [margins, setMargins] = useState({ top: 1, bottom: 1, left: 1, right: 1 });
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [savedDraft, setSavedDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [inspectorPreflight, setInspectorPreflight] = useState<PublishValidationResult | null>(null);
  const [inspectorPreflightLoading, setInspectorPreflightLoading] = useState(false);
  const [inspectorPreflightError, setInspectorPreflightError] = useState<string | null>(null);
  const [testConstituentId, setTestConstituentId] = useState("");
  const [testConstituentLookupOpen, setTestConstituentLookupOpen] = useState(false);
  const [testConstituentSearch, setTestConstituentSearch] = useState("");
  const [editorPdfUrl, setEditorPdfUrl] = useState<string | null>(null);
  const [editorPdfTitle, setEditorPdfTitle] = useState("Server PDF Preview");
  const [editorPdfFileName, setEditorPdfFileName] = useState("letter-template-preview.pdf");
  const [editorPdfOpen, setEditorPdfOpen] = useState(false);
  const [editorPdfLoading, setEditorPdfLoading] = useState(false);
  const [editorPdfError, setEditorPdfError] = useState<string | null>(null);
  const [aiComposerOpen, setAiComposerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("Warm and grateful");
  const [aiLength, setAiLength] = useState("Short");
  const [aiUseMergeFields, setAiUseMergeFields] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<LetterAiComposeResponse | null>(null);
  const [inlineSuggestEnabled, setInlineSuggestEnabled] = useState(false);
  const [inlineSuggestion, setInlineSuggestion] = useState("");
  const [inlineSuggestionLoading, setInlineSuggestionLoading] = useState(false);
  const [inlineSuggestionError, setInlineSuggestionError] = useState<string | null>(null);
  const [aiPreferenceLoaded, setAiPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedComposerOpen = window.localStorage.getItem(LETTERS_AI_COMPOSER_OPEN_STORAGE_KEY) === "1";
      const savedInlineEnabled = window.localStorage.getItem(LETTERS_INLINE_SUGGEST_STORAGE_KEY) === "1";
      setAiComposerOpen(savedComposerOpen);
      setInlineSuggestEnabled(savedInlineEnabled);
      if (savedComposerOpen || savedInlineEnabled) setActiveRibbon("AI");
    } catch {
      // Ignore storage failures in private mode or locked-down browsers.
    } finally {
      setAiPreferenceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!aiPreferenceLoaded) return;
    try {
      window.localStorage.setItem(LETTERS_AI_COMPOSER_OPEN_STORAGE_KEY, aiComposerOpen ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode or locked-down browsers.
    }
  }, [aiComposerOpen, aiPreferenceLoaded]);

  useEffect(() => {
    if (!aiPreferenceLoaded) return;
    try {
      window.localStorage.setItem(LETTERS_INLINE_SUGGEST_STORAGE_KEY, inlineSuggestEnabled ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode or locked-down browsers.
    }
  }, [aiPreferenceLoaded, inlineSuggestEnabled]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(Boolean(templateId));
    try {
      const [fields, signatureRows, brandingRow, constituentRows] = await Promise.all([
        apiFetch<{ sections: MergeFieldSection[] }>("/api/letters/merge-fields"),
        apiFetch<SignatureBlock[]>("/api/letters/signatures"),
        apiFetch<BrandingSettings>("/api/settings/branding"),
        apiFetch<ConstituentLookup[]>("/api/constituents?limit=all").catch(() => []),
      ]);
      setMergeSections(fields.sections ?? []);
      setSignatures(signatureRows);
      setBranding(normalizeBrandingSettings(brandingRow));
      setConstituents(constituentRows);
      setTestConstituentId((current) => current || constituentRows.find((item) => !item.doNotMail)?.id || constituentRows[0]?.id || "");

      if (templateId) {
        const [template, preflightResult] = await Promise.all([
          apiFetch<LetterTemplateDetail>(`/api/letters/templates/${templateId}`),
          apiFetch<PublishValidationResult>(`/api/letters/templates/${templateId}/publish`, {
            method: "POST",
            body: JSON.stringify({ confirm: false }),
          }),
        ]);
        const nextBody = template.printBody ?? "";
        const serverDraft: TemplateDraft = {
          name: template.name ?? "",
          description: template.description ?? "",
          category: template.category ?? "GENERAL",
          status: (template.status as TemplateStatus) ?? "DRAFT",
          printSubject: template.printSubject ?? "Printable Letter",
          printBody: nextBody,
          emailSubject: template.emailSubject ?? "",
          emailBody: template.emailBody ?? "",
          headerPresetId: template.headerPresetId ?? template.headerPreset?.id ?? "",
          footerPresetId: template.footerPresetId ?? template.footerPreset?.id ?? "",
          signatureBlockId: template.signatureBlockId ?? template.signatureBlock?.id ?? "",
          logoMode: template.logoMode ?? "ORGANIZATION_DEFAULT",
          customLogoUrl: template.customLogoUrl ?? "",
        };
        const localRecovery = readTemplateRecoverySnapshot(templateId);
        const recoveredDraft = localRecovery?.draft && draftDiffers(localRecovery.draft, serverDraft)
          ? localRecovery.draft
          : null;

        setDraft(recoveredDraft ?? serverDraft);
        setSavedDraft(serverDraft);
        setSaveFailure(localRecovery?.lastError ?? null);
        setInspectorPreflight(preflightResult);
        setInspectorPreflightError(null);

        if (recoveredDraft) {
          setNotice("Recovered unsaved local draft from a previous save failure.");
        }
      } else {
        const localRecovery = readTemplateRecoverySnapshot(null);
        const recoveredDraft = localRecovery?.draft ?? null;
        setDraft(recoveredDraft ?? EMPTY_DRAFT);
        setSavedDraft(EMPTY_DRAFT);
        setSaveFailure(localRecovery?.lastError ?? null);
        setInspectorPreflight(null);
        setInspectorPreflightError(null);
        if (recoveredDraft) {
          setNotice("Recovered unsaved local draft for this new template.");
        }
      }
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load the template workspace."));
    } finally {
      setLoading(false);
    }
  }, [templateId, setTestConstituentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalizedBody = draft.printBody || "<p></p>";
    if (editor.innerHTML !== normalizedBody) editor.innerHTML = normalizedBody;
  }, [draft.printBody]);

  useEffect(() => {
    return () => {
      if (editorPdfUrl) URL.revokeObjectURL(editorPdfUrl);
    };
  }, [editorPdfUrl]);

  function readEditorPdfFileName(response: Response, fallback: string): string {
    const disposition = response.headers.get("content-disposition") ?? "";
    const quotedMatch = disposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) return quotedMatch[1];
    const plainMatch = disposition.match(/filename=([^;]+)/i);
    if (plainMatch?.[1]) return plainMatch[1].trim();
    return fallback;
  }

  function currentDraftSnapshot(): TemplateDraft {
    return {
      ...draft,
      printBody: editorRef.current?.innerHTML ?? draft.printBody,
    };
  }

  async function openServerPdfPreview(targetConstituentId = testConstituentId) {
    if (!targetConstituentId) {
      setTestConstituentLookupOpen(true);
      setEditorPdfError("Choose a test constituent before rendering the live PDF preview.");
      return;
    }

    const activeTemplateId = templateId || await save();
    if (!activeTemplateId) return;

    setEditorPdfLoading(true);
    setEditorPdfError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/templates/${encodeURIComponent(activeTemplateId)}/sample-pdf?preview=1&inline=1`, {
        method: "POST",
        body: JSON.stringify({
          constituentId: targetConstituentId,
          draft: currentDraftSnapshot(),
        }),
      });
      if (!response.ok) {
        let message = `Server PDF preview failed (${response.status}).`;
        try {
          const parsed = await response.json();
          if (parsed?.error?.message) message = String(parsed.error.message);
        } catch {
          // Keep default message when response is not JSON.
        }
        throw new Error(message);
      }

      const pdfBlob = await response.blob();
      if (pdfBlob.size === 0) throw new Error("Server PDF preview returned an empty file.");
      const objectUrl = URL.createObjectURL(pdfBlob);
      const selected = constituents.find((item) => item.id === targetConstituentId);
      setEditorPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return objectUrl;
      });
      setEditorPdfFileName(readEditorPdfFileName(response, `${sanitizeClientFileName(draft.name || "letter-template")}_preview.pdf`));
      setEditorPdfTitle(`Live PDF Preview${selected ? ` - ${personName(selected)}` : ""}`);
      setEditorPdfOpen(true);
      setTestConstituentLookupOpen(false);
      setNotice("Server-rendered PDF preview refreshed.");
    } catch (requestError) {
      setEditorPdfError(errorMessage(requestError, "Failed to render server PDF preview."));
    } finally {
      setEditorPdfLoading(false);
    }
  }

  function printEditorPdf() {
    if (!editorPdfUrl) return;
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setEditorPdfError("Browser blocked the print preview window. Allow popups for this site and try Print again.");
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head><title>${escapeHtml(editorPdfTitle)}</title></head>
        <body style="margin:0;background:#f1f5f9;">
          <iframe src="${editorPdfUrl}#toolbar=1&navpanes=0&view=FitH" style="border:0;width:100vw;height:100vh;"></iframe>
          <script>
            window.addEventListener("load", function () {
              setTimeout(function () { window.focus(); window.print(); }, 650);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function openPrintRoute() {
    const activeTemplateId = templateId || await save();
    if (!activeTemplateId) return;
    const opened = window.open(`/oyama-letters/templates/${encodeURIComponent(activeTemplateId)}/print`, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(`/oyama-letters/templates/${encodeURIComponent(activeTemplateId)}/print`);
    }
  }

  async function save(nextStatus?: TemplateStatus) {
    const payload: TemplateDraft = { ...draft, status: nextStatus ?? draft.status };
    setSaving(true);
    setError(null);
    setSaveFailure(null);
    try {
      if (!payload.name.trim()) throw new Error("Template name is required.");
      if (!payload.printBody.trim()) throw new Error("Template body is required.");
      if (templateId) {
        await apiFetch(`/api/letters/templates/${templateId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setDraft((current) => ({ ...current, status: payload.status }));
        setSavedDraft(payload);
        clearTemplateRecoverySnapshot(templateId);
        setNotice("Template saved.");
        return templateId;
      }
      const created = await apiFetch<LetterTemplateDetail>("/api/letters/templates", { method: "POST", body: JSON.stringify(payload) });
      clearTemplateRecoverySnapshot(null);
      router.replace(`/oyama-letters/templates/${created.id}`);
      return created.id;
    } catch (requestError) {
      const message = errorMessage(requestError, "Failed to save template.");
      writeTemplateRecoverySnapshot(templateId ?? null, payload, message);
      setSaveFailure(message);
      setError(`${message} Local recovery was saved; your edits are still available.`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndPublish() {
    const id = await save();
    if (id) router.push(`/oyama-letters/templates/${id}/publish`);
  }

  async function runInspectorPreflight(targetTemplateId?: string) {
    const id = (targetTemplateId ?? templateId)?.trim();
    if (!id) {
      setInspectorPreflight(null);
      setInspectorPreflightError("Save this template first to run server preflight checks.");
      return;
    }

    setInspectorPreflightLoading(true);
    setInspectorPreflightError(null);
    try {
      const result = await apiFetch<PublishValidationResult>(`/api/letters/templates/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ confirm: false }),
      });
      setInspectorPreflight(result);
      setNotice("Server preflight refreshed.");
    } catch (requestError) {
      setInspectorPreflightError(errorMessage(requestError, "Failed to run server preflight."));
    } finally {
      setInspectorPreflightLoading(false);
    }
  }

  async function saveAndRunInspectorPreflight() {
    const id = await save();
    if (!id) return;
    await runInspectorPreflight(id);
  }

  function ensureEditableDocument(): boolean {
    if (!previewMode) return true;
    setNotice("Switch from Preview to Edit mode to modify the template.");
    return false;
  }

  function rememberEditorSelection() {
    const editor = editorRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedEditorRangeRef.current = range.cloneRange();
  }

  function replaceSelection(nextValue: string, selectInserted = false) {
    if (!ensureEditableDocument()) return;
    const editor = editorRef.current;
    if (!editor) {
      commitBody(`${draft.printBody}${draft.printBody.endsWith("\n") ? "" : "\n"}${nextValue}`);
      return;
    }

    editor.focus();
    const selectionBeforeRestore = window.getSelection();
    if (selectionBeforeRestore && savedEditorRangeRef.current) {
      const currentRange = selectionBeforeRestore.rangeCount > 0 ? selectionBeforeRestore.getRangeAt(0) : null;
      if (!currentRange || !editor.contains(currentRange.commonAncestorContainer)) {
        selectionBeforeRestore.removeAllRanges();
        selectionBeforeRestore.addRange(savedEditorRangeRef.current);
      }
    }
    ensureEditorSelection(editor);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      commitBody(editor.innerHTML);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      ensureEditorSelection(editor);
    }

    const activeSelection = window.getSelection();
    if (!activeSelection || activeSelection.rangeCount === 0) {
      commitBody(editor.innerHTML);
      return;
    }

    const activeRange = activeSelection.getRangeAt(0);
    const fragment = activeRange.createContextualFragment(nextValue);
    const lastInsertedNode = fragment.lastChild;

    activeRange.deleteContents();
    activeRange.insertNode(fragment);

    if (lastInsertedNode) {
      activeRange.setStartAfter(lastInsertedNode);
      activeRange.collapse(true);
      activeSelection.removeAllRanges();
      activeSelection.addRange(activeRange);
      savedEditorRangeRef.current = activeRange.cloneRange();
    }

    commitBody(editor.innerHTML);
    if (selectInserted) editor.focus();
  }

  function selectedText(fallback = "Text"): string {
    const editor = editorRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return fallback;
    if (editor && !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const savedText = savedEditorRangeRef.current?.toString() ?? "";
      return savedText || fallback;
    }
    const value = selection?.toString() ?? "";
    return value || savedEditorRangeRef.current?.toString() || fallback;
  }

  function restoreEditorRange(): Range | null {
    const editor = editorRef.current;
    if (!editor || typeof window === "undefined") return null;
    const selection = window.getSelection();
    if (!selection) return null;
    if (savedEditorRangeRef.current && editor.contains(savedEditorRangeRef.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedEditorRangeRef.current);
      return savedEditorRangeRef.current;
    }
    if (selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      return selection.getRangeAt(0);
    }
    return null;
  }

  function closestEditableBlock(node: Node | null): HTMLElement | null {
    const editor = editorRef.current;
    if (!editor || !node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
    const block = element?.closest<HTMLElement>("p, div, h1, h2, h3, li, blockquote, td, th");
    if (!block || block === editor || !editor.contains(block)) return null;
    return block;
  }

  function selectedEditableBlocks(range: Range): HTMLElement[] {
    const editor = editorRef.current;
    if (!editor) return [];
    const blocks = Array.from(editor.querySelectorAll<HTMLElement>("p, div, h1, h2, h3, li, blockquote, td, th"))
      .filter((block) => {
        try {
          return range.intersectsNode(block);
        } catch {
          return false;
        }
      });
    if (blocks.length > 0 && !range.collapsed) return blocks;
    const current = closestEditableBlock(range.commonAncestorContainer);
    return current ? [current] : [];
  }

  function commitBody(nextBody: string) {
    setHistory((current) => [...current.slice(-24), draft.printBody]);
    setFuture([]);
    setDraft((current) => ({ ...current, printBody: nextBody }));
  }

  function syncEditorContent() {
    const html = editorRef.current?.innerHTML ?? "";
    setDraft((current) => ({ ...current, printBody: html }));
    setInlineSuggestion("");
    setInlineSuggestionError(null);
  }

  function undoBody() {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (previous === undefined) return current;
      setFuture((next) => [draft.printBody, ...next].slice(0, 25));
      setDraft((draftCurrent) => ({ ...draftCurrent, printBody: previous }));
      return current.slice(0, -1);
    });
  }

  function redoBody() {
    setFuture((current) => {
      const nextBody = current[0];
      if (nextBody === undefined) return current;
      setHistory((next) => [...next.slice(-24), draft.printBody]);
      setDraft((draftCurrent) => ({ ...draftCurrent, printBody: nextBody }));
      return current.slice(1);
    });
  }

  function insertBlock(html: string) {
    const spacer = draft.printBody.trim() ? "\n\n" : "";
    replaceSelection(`${spacer}${html}\n`, true);
  }

  function insertToken(token: string) {
    replaceSelection(token, true);
  }

  function formatInline(tag: "strong" | "em" | "u") {
    const content = selectedText("Text");
    replaceSelection(`<${tag}>${content}</${tag}>`, true);
  }

  function formatBlock(kind: "p" | "h1" | "h2" | "blockquote") {
    const content = selectedText(kind === "p" ? "Paragraph text" : "Heading text");
    replaceSelection(`<${kind}>${content}</${kind}>`, true);
  }

  function applyAlignment(align: LetterTextAlign) {
    if (!ensureEditableDocument()) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = restoreEditorRange();
    if (range) {
      const blocks = selectedEditableBlocks(range);
      if (blocks.length > 0) {
        blocks.forEach((block) => {
          block.style.textAlign = align;
        });
        commitBody(editor.innerHTML);
        setNotice(`Text alignment set to ${align}.`);
        return;
      }
    }
    replaceSelection(`<p style="text-align:${align};">${selectedText("Aligned text")}</p>`, true);
  }

  function applyLineHeight(value: string) {
    setLineHeight(value);
    const editor = editorRef.current;
    const range = savedEditorRangeRef.current;
    if (editor && range && editor.contains(range.commonAncestorContainer)) {
      const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as HTMLElement
        : range.commonAncestorContainer.parentElement;
      const block = element?.closest<HTMLElement>("p, div, h1, h2, h3, li, blockquote");
      if (block && block !== editor && editor.contains(block)) {
        block.style.lineHeight = value;
        commitBody(editor.innerHTML);
        editor.focus();
        return;
      }
    }

    const content = selectedText("");
    if (content) {
      replaceSelection(`<span style="line-height:${escapeHtml(value)};">${content}</span>`, true);
      return;
    }
    setNotice("Place the cursor in a paragraph before changing line height.");
  }

  function insertWhiteSpace(points: number) {
    const pixels = Math.round(points / 0.75);
    insertBlock(`<div data-letter-spacer="${points}" style="height:${pixels}px;" aria-label="${points / 72} inch white space"></div>`);
  }

  function insertFillSpace() {
    insertBlock('<div data-letter-spacer="fill" style="min-height:240px;" aria-label="Push following content to bottom"></div>');
  }

  function insertList(ordered = false) {
    const lines = selectedText("List item").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const items = lines.map((line) => `<li>${line}</li>`).join("");
    replaceSelection(ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`, true);
  }

  function buildLetterTableHtml(options: TableBuilderDraft): string {
    const rows = Math.min(12, Math.max(1, Math.round(options.rows)));
    const columns = Math.min(8, Math.max(1, Math.round(options.columns)));
    const widthPercent = Math.min(100, Math.max(35, Math.round(options.widthPercent)));
    const padding = Math.min(24, Math.max(2, Math.round(options.cellPadding)));
    const borderColor = options.borderStyle === "none" ? "transparent" : "#cbd5e1";
    const border = options.borderStyle === "none" ? "0" : `1px ${options.borderStyle} ${borderColor}`;
    const tableStyle = [
      `width:${widthPercent}%`,
      "border-collapse:collapse",
      "margin:12px 0",
      `text-align:${options.textAlign}`,
    ].join("; ");
    const cellStyle = [
      `border:${border}`,
      `padding:${padding}px`,
      `text-align:${options.textAlign}`,
      "vertical-align:top",
    ].join("; ");
    const headerStyle = [
      cellStyle,
      "background:#f8fafc",
      "font-weight:700",
    ].join("; ");

    return `<table data-letter-table="true" style="${tableStyle};"><tbody>${Array.from({ length: rows }).map((_, rowIndex) => {
      const isHeader = options.headerRow && rowIndex === 0;
      const tag = isHeader ? "th" : "td";
      const style = isHeader ? headerStyle : cellStyle;
      const cells = Array.from({ length: columns }).map((__, columnIndex) => {
        const label = isHeader ? `Column ${columnIndex + 1}` : "Cell text";
        return `<${tag} style="${style};">${label}</${tag}>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("")}</tbody></table>`;
  }

  function insertTable(options: TableBuilderDraft = tableBuilder) {
    if (!ensureEditableDocument()) return;
    insertBlock(buildLetterTableHtml(options));
    setNotice("Table inserted. Click any cell to edit its text.");
  }

  function insertTablePreset(preset: "donationSummary" | "impactGrid" | "signatureContact") {
    if (!ensureEditableDocument()) return;
    if (preset === "donationSummary") {
      insertBlock([
        '<table data-letter-table="donation-summary" style="width:100%; border-collapse:collapse; margin:12px 0; text-align:left;">',
        '<tbody>',
        '<tr><th style="border:1px solid #cbd5e1; padding:8px; background:#f8fafc; text-align:left;">Gift Detail</th><th style="border:1px solid #cbd5e1; padding:8px; background:#f8fafc; text-align:right;">Value</th></tr>',
        '<tr><td style="border:1px solid #cbd5e1; padding:8px;">Donation Amount</td><td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">{{donation.amount}}</td></tr>',
        '<tr><td style="border:1px solid #cbd5e1; padding:8px;">Donation Date</td><td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">{{donation.date}}</td></tr>',
        '</tbody></table>',
      ].join(""));
      return;
    }
    if (preset === "impactGrid") {
      insertBlock([
        '<table data-letter-table="impact-grid" style="width:100%; border-collapse:collapse; margin:12px 0; text-align:center;">',
        '<tbody><tr>',
        '<th style="border:1px solid #cbd5e1; padding:10px; background:#f8fafc; text-align:center;">Your Gift</th>',
        '<th style="border:1px solid #cbd5e1; padding:10px; background:#f8fafc; text-align:center;">Impact</th>',
        '<th style="border:1px solid #cbd5e1; padding:10px; background:#f8fafc; text-align:center;">Next Step</th>',
        '</tr><tr>',
        '<td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">{{donation.amount}}</td>',
        '<td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">{{organization.mission}}</td>',
        '<td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">Thank you for standing with us.</td>',
        '</tr></tbody></table>',
      ].join(""));
      return;
    }
    insertBlock([
      '<table data-letter-table="signature-contact" style="width:100%; border-collapse:collapse; margin:12px 0; text-align:left;">',
      '<tbody><tr>',
      '<td style="border:0; padding:8px; text-align:left;">{{staff.name}}<br>{{staff.title}}</td>',
      '<td style="border:0; padding:8px; text-align:right;">{{organization.phone}}<br>{{organization.website}}</td>',
      '</tr></tbody></table>',
    ].join(""));
  }

  function insertImage() {
    if (!ensureEditableDocument()) return;
    imageInputRef.current?.click();
  }

  async function handleImageFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Choose a PNG, JPG, or WEBP image.");
      return;
    }

    const maxSize = 6 * 1024 * 1024;
    if (file.size > maxSize) {
      setNotice("Images must be 6 MB or smaller.");
      return;
    }

    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const uploaded = await apiFetch<{ url: string }>("/api/letters/media", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "image/png",
          dataBase64,
          purpose: "editor",
        }),
      });
      insertBlock(`<figure data-letter-image-block="true" style="margin:12px 0; text-align:center;"><img src="${escapeHtml(uploaded.url)}" alt="${escapeHtml(file.name)}" data-letter-width="50" style="width:50%; max-width:100%; height:auto;" /></figure>`);
      setNotice(`Image inserted: ${file.name}`);
    } catch (requestError) {
      setNotice(errorMessage(requestError, "Image upload failed. Try another file."));
    }
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      selectedEditorImageRef.current = null;
      setSelectedImageWidth(null);
      setSelectedImageAlt("");
      setSelectedImageAlign("center");
      return;
    }
    selectedEditorImageRef.current = target;
    const marker = Number.parseFloat(target.dataset.letterWidth ?? "");
    const width = Number.isFinite(marker) ? marker : Math.round((target.getBoundingClientRect().width / Math.max(1, editorRef.current?.getBoundingClientRect().width ?? 1)) * 100);
    setSelectedImageWidth(Math.min(100, Math.max(10, width)));
    setSelectedImageAlt(target.alt || "");
    const container = target.closest<HTMLElement>("[data-letter-image-block], figure, p, div");
    const textAlign = container?.style.textAlign === "left" || container?.style.textAlign === "right" ? container.style.textAlign : "center";
    setSelectedImageAlign(textAlign);
    setInspectorTab("Block Settings");
  }

  function resizeSelectedImage(widthPercent: number) {
    const image = selectedEditorImageRef.current;
    const editor = editorRef.current;
    if (!image || !editor || !editor.contains(image)) {
      setNotice("Select an image in the letter before resizing it.");
      return;
    }
    const normalized = Math.min(100, Math.max(10, Math.round(widthPercent)));
    image.dataset.letterWidth = String(normalized);
    image.style.width = `${normalized}%`;
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    setSelectedImageWidth(normalized);
    commitBody(editor.innerHTML);
    setNotice(`Image width set to ${normalized}%.`);
  }

  function updateSelectedImageAlt(value: string) {
    const image = selectedEditorImageRef.current;
    const editor = editorRef.current;
    setSelectedImageAlt(value);
    if (!image || !editor || !editor.contains(image)) return;
    image.alt = value;
    commitBody(editor.innerHTML);
  }

  function alignSelectedImage(align: "left" | "center" | "right") {
    const image = selectedEditorImageRef.current;
    const editor = editorRef.current;
    if (!image || !editor || !editor.contains(image)) {
      setNotice("Select an image in the letter before aligning it.");
      return;
    }
    let container = image.closest<HTMLElement>("[data-letter-image-block], figure");
    if (!container) {
      container = document.createElement("figure");
      container.dataset.letterImageBlock = "true";
      image.replaceWith(container);
      container.appendChild(image);
    }
    container.style.margin = "12px 0";
    container.style.textAlign = align;
    setSelectedImageAlign(align);
    commitBody(editor.innerHTML);
    setNotice(`Image aligned ${align}.`);
  }

  function insertSignature(signature?: SignatureBlock | null) {
    const selected = signature ?? signatures.find((item) => item.id === draft.signatureBlockId) ?? signatures.find((item) => item.isDefault) ?? signatures[0] ?? null;
    if (!selected) {
      setNotice("No signature block exists yet. Create one in Settings > Branding > Signatures.");
      return;
    }
    setDraft((current) => ({ ...current, signatureBlockId: selected.id }));
    setNotice(`${selected.name} selected. It will render once at the end of the generated letter.`);
  }

  function findText() {
    const editor = editorRef.current;
    if (!editor) {
      setNotice("Editor is not ready yet.");
      return;
    }

    const query = window.prompt("Find text");
    if (!query) return;

    const plain = editor.textContent ?? "";
    const lowerPlain = plain.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerPlain.indexOf(lowerQuery);
    if (index < 0) {
      setNotice("No matching text found.");
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      setNotice(`Found "${query}" in the document body.`);
      return;
    }

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let traversed = 0;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;
    const endIndex = index + lowerQuery.length;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const value = node.nodeValue ?? "";
      const nextTraversed = traversed + value.length;

      if (!startNode && index >= traversed && index <= nextTraversed) {
        startNode = node;
        startOffset = index - traversed;
      }

      if (!endNode && endIndex >= traversed && endIndex <= nextTraversed) {
        endNode = node;
        endOffset = endIndex - traversed;
        break;
      }

      traversed = nextTraversed;
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, Math.max(0, startOffset));
      range.setEnd(endNode, Math.max(0, endOffset));
      selection.removeAllRanges();
      selection.addRange(range);
      const targetElement = startNode.parentElement;
      targetElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setNotice(`Found "${query}" in the saved document body.`);
  }

  function runSpellCheck() {
    if (!ensureEditableDocument()) return;
    editorRef.current?.focus();
    setNotice("Browser spellcheck is active in the document canvas.");
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (previewMode) return;
    if (event.key === "Tab" && inlineSuggestion.trim()) {
      event.preventDefault();
      acceptInlineSuggestion();
      return;
    }
    const withModifier = event.ctrlKey || event.metaKey;
    if (!withModifier) return;

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      formatInline("strong");
      return;
    }
    if (key === "i") {
      event.preventDefault();
      formatInline("em");
      return;
    }
    if (key === "u") {
      event.preventDefault();
      formatInline("u");
      return;
    }
    if (key === "s") {
      event.preventDefault();
      void save();
    }
  }

  function insertCommonSection(kind: "thankYou" | "closing" | "ps" | "impact", align: LetterTextAlign = snippetAlign) {
    const blocks = {
      thankYou: "<p>Thank you for your generous support of {{organization.name}}.</p>",
      closing: "<p>With gratitude,</p>",
      ps: "<p>P.S. Your generosity helps make this mission possible.</p>",
      impact: "<p>Because of friends like you, we can continue our mission of {{organization.mission}}.</p>",
    };
    const aligned = blocks[kind].replace("<p>", `<p style="text-align:${align};">`);
    insertBlock(aligned);
  }

  async function generateAiLetterContent() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("Describe what Steward should write.");
      return;
    }
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await apiFetch<LetterAiComposeResponse>("/api/letters/ai-compose", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          tone: aiTone,
          length: aiLength,
          useMergeFields: aiUseMergeFields,
          selectedText: selectedText(""),
          currentBodyHtml: editorRef.current?.innerHTML ?? draft.printBody,
          templateName: draft.name,
          category: draft.category,
        }),
      });
      setAiOutput(result);
      setNotice(`Steward drafted letter content${result.mergeFieldsUsed.length > 0 ? ` with ${result.mergeFieldsUsed.length} merge field${result.mergeFieldsUsed.length === 1 ? "" : "s"}` : ""}.`);
    } catch (requestError) {
      setAiError(errorMessage(requestError, "Steward could not draft letter content."));
    } finally {
      setAiGenerating(false);
    }
  }

  function insertAiOutputAtCursor() {
    if (!aiOutput?.bodyHtml) {
      setAiError("Generate content before inserting.");
      return;
    }
    replaceSelection(markLetterHtmlAsAiAssisted(aiOutput.bodyHtml), true);
    setAiComposerOpen(false);
    setNotice("AI draft inserted at the cursor.");
  }

  function textBeforeCursor(): string {
    const editor = editorRef.current;
    const range = savedEditorRangeRef.current;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) {
      return htmlToPlainTextClient(editor?.innerHTML ?? draft.printBody).slice(-1400);
    }
    const before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.endContainer, range.endOffset);
    return before.toString().slice(-1400);
  }

  async function requestInlineSuggestion() {
    const beforeCursor = textBeforeCursor();
    if (!inlineSuggestEnabled || previewMode || beforeCursor.trim().length < 20) return;
    const currentHtml = editorRef.current?.innerHTML ?? draft.printBody;
    const requestKey = `${beforeCursor.trim().slice(-500)}::${currentHtml.length}::${inlineSuggestion}`;
    if (lastInlineSuggestionRequestRef.current === requestKey) return;
    lastInlineSuggestionRequestRef.current = requestKey;
    setInlineSuggestionLoading(true);
    setInlineSuggestionError(null);
    try {
      const result = await apiFetch<LetterAiSuggestResponse>("/api/letters/ai-suggest", {
        method: "POST",
        body: JSON.stringify({
          textBeforeCursor: beforeCursor,
          currentBodyHtml: currentHtml,
          previousSuggestion: inlineSuggestion,
          templateName: draft.name,
          category: draft.category,
          useMergeFields: aiUseMergeFields,
        }),
      });
      const nextSuggestion = result.suggestion.trim();
      setInlineSuggestion(nextSuggestion === inlineSuggestion.trim() ? "" : nextSuggestion);
    } catch (requestError) {
      setInlineSuggestion("");
      setInlineSuggestionError(errorMessage(requestError, "Inline suggestion unavailable."));
    } finally {
      setInlineSuggestionLoading(false);
    }
  }

  function acceptInlineSuggestion() {
    if (!inlineSuggestion.trim()) return;
    replaceSelection(escapeHtml(inlineSuggestion), true);
    setInlineSuggestion("");
  }

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      if (draftDiffers(draft, savedDraft) || saveFailure) {
        writeTemplateRecoverySnapshot(templateId ?? null, draft, saveFailure);
      } else {
        clearTemplateRecoverySnapshot(templateId ?? null);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draft, loading, saveFailure, savedDraft, templateId]);

  useEffect(() => {
    if (!inlineSuggestEnabled || previewMode || loading) {
      setInlineSuggestion("");
      return;
    }
    const timer = window.setTimeout(() => {
      void requestInlineSuggestion();
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [draft.printBody, inlineSuggestEnabled, loading, previewMode]);

  const dirty = draftDiffers(draft, savedDraft);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, saving]);

  const allFields = mergeSections.flatMap((section) => section.fields);
  const filteredMergeSections = useMemo(() => {
    const needle = mergeFieldSearch.trim().toLowerCase();
    if (!needle) return mergeSections;
    return mergeSections
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => {
          const normalized = normalizeToken(field).toLowerCase();
          return normalized.includes(needle)
            || field.toLowerCase().includes(needle)
            || section.label.toLowerCase().includes(needle);
        }),
      }))
      .filter((section) => section.fields.length > 0);
  }, [mergeFieldSearch, mergeSections]);
  const mergeRegistry = useMemo(() => new Set(allFields.map(normalizeToken)), [allFields]);
  const detectedTokens = useMemo(
    () => extractTokens(`${draft.printSubject ?? ""} ${draft.printBody ?? ""} ${draft.emailSubject ?? ""} ${draft.emailBody ?? ""}`),
    [draft.emailBody, draft.emailSubject, draft.printBody, draft.printSubject],
  );
  const unknownTokens = useMemo(
    () => detectedTokens.filter((token) => !mergeRegistry.has(normalizeToken(token))),
    [detectedTokens, mergeRegistry],
  );
  const localChecklist = useMemo(() => [
    { key: "name", label: "Template name", ok: Boolean(draft.name.trim()), missingHint: "Add a template name." },
    { key: "printBody", label: "Print body content", ok: Boolean(draft.printBody.replace(/<[^>]+>/g, " ").trim()), missingHint: "Add printable body content." },
    {
      key: "fields",
      label: unknownTokens.length === 0 ? "All detected merge fields are known" : `Unknown merge fields: ${unknownTokens.join(", ")}`,
      ok: unknownTokens.length === 0,
      missingHint: "Use supported merge field tokens or fix typos.",
    },
  ], [draft.name, draft.printBody, unknownTokens]);
  const localChecklistReady = localChecklist.every((item) => item.ok);
  async function loadMergeLinePreview(token: string) {
    const normalized = normalizeToken(token);
    if (!mergeRegistry.has(normalized)) {
      setMergeLinePreviewToken(token);
      setMergeLinePreview(null);
      setMergeLinePreviewError("Unknown merge field. Fix the token before previewing live data.");
      return;
    }

    const line = extractLineForToken(currentDraftSnapshot().printBody, token);
    setMergeLinePreviewToken(token);
    setMergeLinePreviewLoading(true);
    setMergeLinePreviewError(null);
    try {
      const result = await apiFetch<MergeLinePreviewResponse>("/api/letters/merge-fields/line-preview", {
        method: "POST",
        body: JSON.stringify({ line, limit: 5 }),
      });
      setMergeLinePreview(result);
    } catch (requestError) {
      setMergeLinePreview(null);
      setMergeLinePreviewError(errorMessage(requestError, "Could not load live merge preview."));
    } finally {
      setMergeLinePreviewLoading(false);
    }
  }
  const wordCount = countWords(draft.printBody);
  const pageSizeShort = pageSize.includes("Letter") ? "8.5 x 11 in" : pageSize.includes("Legal") ? "8.5 x 14 in" : "A4";
  const pageMetrics = pageSizeToMetrics(pageSize);
  const editorFrameWidth = pageMetrics.width + 84;
  const selectedTestConstituent = constituents.find((item) => item.id === testConstituentId) ?? null;
  const testConstituentResults = useMemo(() => {
    const needle = testConstituentSearch.trim().toLowerCase();
    const rows = needle
      ? constituents.filter((row) => recipientSearchText(row).includes(needle))
      : constituents;
    return rows.slice(0, 80);
  }, [constituents, testConstituentSearch]);

  if (loading) return <LoadingPage label="Loading canvas builder..." />;

  return (
    <main className="flex min-h-[calc(100dvh-88px)] flex-col bg-[#edf1f5]">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleImageFileSelected}
      />
      <div className="sticky top-[89px] z-30 shrink-0 shadow-sm lg:top-0 lg:z-40">
      <div className="border-b border-slate-200 bg-white px-3 sm:px-4 xl:px-7">
        <div className="flex min-h-12 flex-wrap items-end gap-3 py-1 sm:gap-7">
          {(["File", "Insert", "Format", "Layout", "Review", "View", "AI"] as const).map((tab) => <button key={tab} type="button" onClick={() => { setActiveRibbon(tab); if (tab === "AI") setAiComposerOpen(true); }} className={["h-10 border-b-2 px-1 text-sm font-medium", activeRibbon === tab ? "border-emerald-700 text-slate-950" : "border-transparent text-slate-700"].join(" ")}>{tab}</button>)}
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 pb-2 sm:w-auto sm:gap-3">
            <span className="hidden text-xs font-semibold text-slate-600 xl:inline">Words: {wordCount}</span>
            <span className={[
              "text-xs font-semibold",
              saveFailure ? "text-red-700" : dirty ? "text-amber-700" : "text-emerald-700",
            ].join(" ")}
            >
              {saving ? "Saving..." : saveFailure ? "Save failed - recovery ready" : dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            {notice ? <span className="hidden max-w-64 truncate text-xs font-semibold text-emerald-700 2xl:inline">{notice}</span> : null}
            <IconButton label="Zoom out" onClick={() => setZoom((current) => Math.max(60, current - 10))}>-</IconButton>
            <span className="w-12 text-center text-xs font-semibold text-slate-600">{zoom}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((current) => Math.min(160, current + 10))}>+</IconButton>
            <IconButton label="Undo" onClick={undoBody} disabled={history.length === 0}>↶</IconButton>
            <IconButton label="Redo" onClick={redoBody} disabled={future.length === 0}>↷</IconButton>
            <Button onClick={() => setPreviewMode((value) => !value)}>{previewMode ? "Edit" : "Preview"}</Button>
            <Button onClick={() => setTestConstituentLookupOpen(true)}>{selectedTestConstituent ? personName(selectedTestConstituent) : "Test Constituent"}</Button>
            <Button onClick={() => void openPrintRoute()} disabled={saving}>Print Route</Button>
            <Button onClick={() => void openServerPdfPreview()} disabled={editorPdfLoading}>{editorPdfLoading ? "Rendering..." : "Live PDF"}</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            <Button onClick={() => void saveAndPublish()} tone="primary" disabled={saving}>Publish</Button>
          </div>
        </div>
      </div>
      <div className="flex min-h-[88px] items-stretch gap-3 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1 sm:min-h-[94px] sm:px-4 xl:px-7">
        {activeRibbon === "File" ? (
          <>
            <RibbonButton onClick={() => void save()}>Save Draft</RibbonButton>
            <RibbonButton onClick={() => void saveAndPublish()}>Continue to Publish</RibbonButton>
            <RibbonButton onClick={() => void openPrintRoute()}>Open Print Route</RibbonButton>
            <RibbonButton onClick={() => setDraft(EMPTY_DRAFT)}>New Blank Template</RibbonButton>
          </>
        ) : null}
        {activeRibbon === "Insert" ? (
          <>
              <RibbonGroup label="Insert">
                <RibbonToolButton iconName="merge-fields" glyph="{}" label="Merge Field" onClick={() => allFields[0] ? insertToken(allFields[0]) : setInspectorTab("Merge Fields")} />
                <RibbonToolButton iconName="signature-block" glyph="✒" label="Signature" onClick={() => insertSignature()} />
              </RibbonGroup>
            <RibbonGroup label="Font">
              <select value={fontFamily} onChange={(event) => { setFontFamily(event.target.value); replaceSelection(`<span style="font-family:${escapeHtml(event.target.value)};">${selectedText("Text")}</span>`, true); }} className="h-9 w-32 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["Calibri", "Arial", "Georgia", "Times New Roman", "Verdana"].map((font) => <option key={font} value={font}>{font}</option>)}
              </select>
              <select value={fontSize} onChange={(event) => { setFontSize(event.target.value); replaceSelection(`<span style="font-size:${escapeHtml(event.target.value)}pt;">${selectedText("Text")}</span>`, true); }} className="h-9 w-16 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["9", "10", "11", "12", "14", "16", "18", "24"].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <select aria-label="Line height" value={lineHeight} onChange={(event) => applyLineHeight(event.target.value)} className="h-9 w-24 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["1", "1.15", "1.25", "1.5", "1.75", "2"].map((value) => <option key={value} value={value}>{value} lines</option>)}
              </select>
              <RibbonButton onClick={() => formatInline("strong")}>B</RibbonButton>
              <RibbonButton onClick={() => formatInline("em")}>I</RibbonButton>
              <RibbonButton onClick={() => formatInline("u")}>U</RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              <RibbonButton onClick={() => applyAlignment("left")}>L</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("center")}>C</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("right")}>R</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("justify")}>J</RibbonButton>
              <RibbonButton onClick={() => insertList(false)}>Bullets</RibbonButton>
              <RibbonButton onClick={() => insertList(true)}>Numbered</RibbonButton>
              <RibbonButton onClick={() => formatBlock("h1")}>H1</RibbonButton>
              <RibbonButton onClick={() => formatBlock("h2")}>H2</RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Tools">
              <RibbonToolButton iconName="pdf-preview" glyph="▣" label="Image" onClick={insertImage} />
              <RibbonToolButton iconName="canvas-builder" glyph="▦" label="Table" onClick={insertTable} />
              <RibbonToolButton iconName="page-break" glyph="↵" label="Page Break" onClick={() => insertBlock('<div style="page-break-after: always;"></div>')} />
              <RibbonToolButton iconName="validation-check" glyph="✓" label="Spelling" onClick={runSpellCheck} />
            </RibbonGroup>
          </>
        ) : null}
        {activeRibbon === "Format" ? (
          <>
            <RibbonGroup label="Font">
              <select value={fontFamily} onChange={(event) => { setFontFamily(event.target.value); replaceSelection(`<span style="font-family:${escapeHtml(event.target.value)};">${selectedText("Text")}</span>`, true); }} className="h-9 w-32 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["Calibri", "Arial", "Georgia", "Times New Roman", "Verdana"].map((font) => <option key={font} value={font}>{font}</option>)}
              </select>
              <select value={fontSize} onChange={(event) => { setFontSize(event.target.value); replaceSelection(`<span style="font-size:${escapeHtml(event.target.value)}pt;">${selectedText("Text")}</span>`, true); }} className="h-9 w-16 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["9", "10", "11", "12", "14", "16", "18", "24"].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <select aria-label="Line height" value={lineHeight} onChange={(event) => applyLineHeight(event.target.value)} className="h-9 w-24 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["1", "1.15", "1.25", "1.5", "1.75", "2"].map((value) => <option key={value} value={value}>{value} lines</option>)}
              </select>
              <RibbonButton onClick={() => formatInline("strong")}>B</RibbonButton>
              <RibbonButton onClick={() => formatInline("em")}>I</RibbonButton>
              <RibbonButton onClick={() => formatInline("u")}>U</RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              <RibbonButton onClick={() => applyAlignment("left")}>L</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("center")}>C</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("right")}>R</RibbonButton>
              <RibbonButton onClick={() => applyAlignment("justify")}>J</RibbonButton>
              <RibbonButton onClick={() => insertList(false)}>Bullets</RibbonButton>
              <RibbonButton onClick={() => insertList(true)}>Numbered</RibbonButton>
              <RibbonButton onClick={() => formatBlock("h1")}>H1</RibbonButton>
              <RibbonButton onClick={() => formatBlock("h2")}>H2</RibbonButton>
            </RibbonGroup>
          </>
        ) : null}
        {activeRibbon === "Layout" ? (
          <RibbonGroup label="Tools">
            <RibbonButton onClick={() => insertBlock('<hr />')}>Divider</RibbonButton>
            <RibbonButton onClick={() => insertWhiteSpace(18)}>Blank Line</RibbonButton>
            <RibbonButton onClick={() => insertWhiteSpace(36)}>1/2 Inch</RibbonButton>
            <RibbonButton onClick={() => insertWhiteSpace(72)}>1 Inch</RibbonButton>
            <RibbonButton onClick={insertFillSpace}>Push to Bottom</RibbonButton>
            <RibbonButton onClick={() => insertBlock('<section style="margin: 24px 0;"></section>')}>Section</RibbonButton>
            <RibbonButton onClick={() => setShowMarginGuides((value) => !value)}>{showMarginGuides ? "Hide Guides" : "Show Guides"}</RibbonButton>
          </RibbonGroup>
        ) : null}
        {activeRibbon === "Review" ? (
          <RibbonGroup label="Tools">
            <RibbonButton onClick={runSpellCheck}>Spelling</RibbonButton>
            <RibbonButton onClick={findText}>Find</RibbonButton>
            <RibbonButton onClick={() => setInspectorTab("Merge Fields")}>Merge Fields</RibbonButton>
          </RibbonGroup>
        ) : null}
        {activeRibbon === "View" ? (
          <RibbonGroup label="Tools">
            <RibbonButton onClick={() => setPreviewMode(true)}>Preview</RibbonButton>
            <RibbonButton onClick={() => setTestConstituentLookupOpen(true)}>Test Constituent</RibbonButton>
            <RibbonButton onClick={() => void openServerPdfPreview()}>Live PDF</RibbonButton>
            <RibbonButton onClick={() => setInspectorTab("Document")}>Document</RibbonButton>
            <RibbonButton onClick={() => setInspectorTab("Block Settings")}>Block Settings</RibbonButton>
          </RibbonGroup>
        ) : null}
        {activeRibbon === "AI" ? (
          <>
            <RibbonGroup label="Steward Writing">
              <RibbonToolButton iconName="steward-ai" glyph="AI" label="Composer" onClick={() => setAiComposerOpen(true)} />
              <RibbonButton onClick={() => { setAiPrompt("Write a donor-first thank-you paragraph using appropriate merge fields."); setAiComposerOpen(true); }}>Thank You</RibbonButton>
              <RibbonButton onClick={() => { setAiPrompt("Rewrite the selected text to be warmer, clearer, and concise."); setAiComposerOpen(true); }}>Rewrite Selection</RibbonButton>
              <RibbonButton onClick={() => { setAiPrompt("Write a short impact paragraph that avoids unsupported claims and can work for any donor."); setAiComposerOpen(true); }}>Impact</RibbonButton>
            </RibbonGroup>
            <RibbonGroup label="Controls">
              <select value={aiTone} onChange={(event) => setAiTone(event.target.value)} className="h-9 w-40 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["Warm and grateful", "Professional", "Personal", "Concise", "Encouraging"].map((tone) => <option key={tone} value={tone}>{tone}</option>)}
              </select>
              <select value={aiLength} onChange={(event) => setAiLength(event.target.value)} className="h-9 w-28 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold">
                {["Short", "Medium", "Long"].map((length) => <option key={length} value={length}>{length}</option>)}
              </select>
              <CheckField label="Merge Fields" checked={aiUseMergeFields} onChange={setAiUseMergeFields} />
              <CheckField label="Inline Suggestions" checked={inlineSuggestEnabled} onChange={(checked) => { setInlineSuggestEnabled(checked); setInlineSuggestion(""); setInlineSuggestionError(null); }} />
            </RibbonGroup>
          </>
        ) : null}
      </div>
      </div>
      {error ? <Alert tone="amber">{error}</Alert> : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_356px]">
        <aside className="order-1 max-h-[38dvh] min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-3 lg:order-none lg:max-h-none lg:border-b-0 lg:border-r lg:p-4">
          <div className="space-y-5">
            {/* Branding group */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Branding</p>
              <div className="space-y-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Global Header + Footer</p>
                  <p className="mt-1 text-xs text-slate-600">Letters use the single communication header and footer from Branding Defaults.</p>
                  <Link href="/settings/branding#communication-header-footer" className="mt-2 inline-flex text-xs font-semibold text-emerald-700 hover:underline">Open Branding Defaults</Link>
                </div>
                <details open className="rounded-md border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Signature Blocks</summary>
                  <div className="mt-3 space-y-2">
                    {signatures.length === 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500">No signature blocks found.</p>
                        <Link href="/oyama-letters/settings?tab=signatures" className="text-xs font-semibold text-emerald-700 hover:underline">Add a signature in Settings →</Link>
                      </div>
                    ) : signatures.map((signature) => (
                      <MiniPresetCard key={signature.id} title={signature.signerName} body={signature.signerTitle ?? signature.name} action={() => insertSignature(signature)} />
                    ))}
                    <Button onClick={() => insertSignature()}>Insert</Button>
                  </div>
                </details>
              </div>
            </div>
            {/* Saved Sections group */}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Blocks & Snippets</p>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Saved Sections</p>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="mb-3 grid grid-cols-4 gap-1" aria-label="Saved section justification settings">
                  {(["left", "center", "right", "justify"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setSnippetAlign(align)}
                      className={["h-8 rounded border text-[10px] font-semibold uppercase", snippetAlign === align ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                    >
                      {align === "justify" ? "Just" : align.charAt(0)}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <SnippetButton onClick={() => insertCommonSection("thankYou")}>Thank You - General</SnippetButton>
                  <SnippetButton onClick={() => insertCommonSection("closing")}>Closing - With Gratitude</SnippetButton>
                  <SnippetButton onClick={() => insertCommonSection("ps")}>P.S. Line</SnippetButton>
                  <SnippetButton onClick={() => insertCommonSection("impact")}>Donation Impact Statement</SnippetButton>
                </div>
              </div>
            </div>
            {/* Merge Fields group */}
            {mergeSections.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Merge Fields</p>
                <div className="space-y-2">
                  {mergeSections.map((section) => (
                    <details key={section.key} open={section.key === "donor" || section.key === "constituent"} className="rounded-md border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer text-sm font-semibold">{section.label}</summary>
                      <div className="mt-3 space-y-2">
                        {section.fields.map((field) => <button key={field} type="button" onClick={() => insertToken(field)} className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-left font-mono text-[11px] hover:bg-slate-50">{field}</button>)}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
        <section className="order-2 min-w-0 overflow-auto bg-[#edf1f5] p-2 sm:p-5 lg:order-none">
          {showMarginGuides ? <EditorRuler pageWidth={pageMetrics.width} leftGutter={30} /> : null}
          <div className="mx-auto flex max-w-full gap-2" style={{ width: editorFrameWidth }}>
            {showMarginGuides ? <EditorVerticalRuler pageHeight={pageMetrics.height} /> : <div className="w-7 shrink-0" />}
            <div className="max-w-full" style={{ width: pageMetrics.width, transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
              <LetterPage
                branding={branding}
                title={draft.name || "Letter Preview"}
                subject={draft.printSubject}
                salutation={null}
                minHeight={pageMetrics.height}
                marginTop={margins.top}
                marginRight={margins.right}
                marginBottom={margins.bottom}
                marginLeft={margins.left}
                sender={{
                  name: branding.defaultLetterSignerName,
                  title: branding.defaultLetterSignerTitle,
                  email: branding.defaultLetterSignerEmail,
                  phone: branding.defaultLetterSignerPhone,
                  signatureUrl: branding.defaultLetterSignatureImageUrl,
                  closing: branding.defaultLetterClosingPhrase,
                }}
                bodySlot={(
                  <>
                    <label className="sr-only" htmlFor="printBody">Print body</label>
                    {previewMode ? (
                      <div
                        id="printBody"
                        className="min-h-[520px] w-full border-0 bg-transparent text-[14px] leading-7 text-slate-950 outline-none [&_.merge-token-badge]:inline-flex [&_.merge-token-badge]:items-center [&_.merge-token-badge]:rounded [&_.merge-token-badge]:border [&_.merge-token-badge]:border-emerald-300 [&_.merge-token-badge]:bg-emerald-50 [&_.merge-token-badge]:px-1.5 [&_.merge-token-badge]:py-0.5 [&_.merge-token-badge]:font-mono [&_.merge-token-badge]:text-[11px] [&_.merge-token-badge]:font-semibold [&_.merge-token-badge]:text-emerald-800 [&_.merge-token-badge-unknown]:border-amber-300 [&_.merge-token-badge-unknown]:bg-amber-50 [&_.merge-token-badge-unknown]:text-amber-800 [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-slate-400 [&_[data-letter-spacer]]:my-1 [&_[data-letter-spacer]]:border [&_[data-letter-spacer]]:border-dashed [&_[data-letter-spacer]]:border-slate-300 [&_[data-letter-spacer]]:bg-slate-50/50 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2"
                        dangerouslySetInnerHTML={{ __html: decorateMergeTokens(draft.printBody || "<p></p>", mergeRegistry) }}
                      />
                    ) : (
                      <div
                        id="printBody"
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={syncEditorContent}
                        onFocus={rememberEditorSelection}
                        onBlur={rememberEditorSelection}
                        onMouseUp={rememberEditorSelection}
                        onClick={handleEditorClick}
                        onKeyUp={rememberEditorSelection}
                        onKeyDown={handleEditorKeyDown}
                        className="min-h-[520px] w-full border-0 bg-transparent text-[14px] leading-7 text-slate-950 outline-none [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-slate-400 [&_[data-letter-spacer]]:my-1 [&_[data-letter-spacer]]:border [&_[data-letter-spacer]]:border-dashed [&_[data-letter-spacer]]:border-slate-300 [&_[data-letter-spacer]]:bg-slate-50/50 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2"
                        spellCheck
                      />
                    )}
                  </>
                )}
              />
            </div>
          </div>
          <div className="mx-auto mt-3 flex h-9 max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm" style={{ width: editorFrameWidth }}>
            <span className="font-semibold text-slate-700">Page 1 of 1</span>
            <span className="text-slate-300 select-none">·</span>
            <span>{pageSizeShort}</span>
            <span className="text-slate-300 select-none">·</span>
            <span>Words: {wordCount}</span>
            <span className="text-slate-300 select-none">·</span>
            <span>{previewMode ? "Preview" : "Insert"}</span>
            <span className="ml-auto">{zoom}%</span>
          </div>
        </section>
        <aside className="order-3 max-h-[46dvh] min-h-0 overflow-y-auto border-t border-slate-200 bg-[#fbfcfd] xl:order-none xl:max-h-none xl:border-l xl:border-t-0">
          <div className="sticky top-0 z-10 flex gap-3 overflow-x-auto border-b border-slate-200 bg-white px-3 pt-2 sm:gap-5 sm:px-4">
            {(["Document", "Merge Fields", "Block Settings"] as const).map((tab) => <button key={tab} type="button" onClick={() => setInspectorTab(tab)} className={["h-10 border-b-2 text-[13px] font-semibold", inspectorTab === tab ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"].join(" ")}>{tab}</button>)}
          </div>
          <div className="space-y-4 p-4">
            {inspectorTab === "Document" ? (
              <>
                <InspectorCard title="Template Info">
                  <TextField label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
                  <LabeledSelect label="Category" value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value }))} options={CATEGORIES} />
                  <TextArea label="Description" value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} />
                </InspectorCard>
                <InspectorCard title="Page Setup" tooltip="Page size and margin guides control the printable canvas used for preview and server-rendered PDF output.">
                  <LabeledSelect label="Page Size" value={pageSize} onChange={setPageSize} options={["Letter (8.5 x 11 in)", "Legal (8.5 x 14 in)", "A4 (8.27 x 11.69 in)"]} />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margins (inches)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Top" value={margins.top} onChange={(value) => setMargins((current) => ({ ...current, top: value }))} />
                    <NumberField label="Bottom" value={margins.bottom} onChange={(value) => setMargins((current) => ({ ...current, bottom: value }))} />
                    <NumberField label="Left" value={margins.left} onChange={(value) => setMargins((current) => ({ ...current, left: value }))} />
                    <NumberField label="Right" value={margins.right} onChange={(value) => setMargins((current) => ({ ...current, right: value }))} />
                  </div>
                  <CheckField label="Show Margin Guides" checked={showMarginGuides} onChange={setShowMarginGuides} />
                </InspectorCard>
                <InspectorCard title="Global Branding" tooltip="Letters use the single communication header and footer from Branding Defaults. Only signatures are selected per template.">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800">Header + footer</p>
                    <p className="mt-1">Applied from Branding Defaults to every OyamaLetters preview and output.</p>
                    <Link href="/settings/branding#communication-header-footer" className="mt-2 inline-flex font-semibold text-emerald-700 hover:underline">Edit global header/footer</Link>
                  </div>
                  <LabeledSelect label="Signature (optional)" value={draft.signatureBlockId} onChange={(value) => setDraft((current) => ({ ...current, signatureBlockId: value }))} options={["", ...signatures.map((item) => item.id)]} labels={Object.fromEntries(signatures.map((item) => [item.id, item.name]))} />
                </InspectorCard>
                <InspectorCard title="Template Status">
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-slate-600">Status</span>
                    <StatusPill label={titleCase(draft.status)} tone={draft.status === "ACTIVE" ? "green" : draft.status === "ARCHIVED" ? "slate" : "orange"} />
                  </div>
                  <LabeledSelect label="Change Status" value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value as TemplateStatus }))} options={["DRAFT", "ACTIVE", "ARCHIVED"]} />
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Version</p>
                    <p className="mt-1">Current working draft in canvas builder</p>
                  </div>
                </InspectorCard>
                <InspectorCard title="Preflight Checklist" tooltip="These checks run locally while you edit so staff can catch missing merge data, unknown tokens, and unsaved changes before publish review.">
                  <p className="text-xs text-slate-600">Live readiness checks while you edit in canvas.</p>
                  <div className="mt-3 space-y-2">
                    {localChecklist.map((item) => (
                      <div key={item.key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                          <StatusPill label={item.ok ? "OK" : "Review"} tone={item.ok ? "green" : "orange"} />
                        </div>
                        {!item.ok && item.missingHint ? <p className="mt-1 text-[11px] text-slate-500">{item.missingHint}</p> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold">Local status: {localChecklistReady ? "No local notes" : "Review notes available"}</p>
                    <p className="mt-1">Detected merge fields: {detectedTokens.length} · Unknown: {unknownTokens.length}</p>
                    {dirty ? <p className="mt-1 text-amber-700">Unsaved edits detected. Save before relying on server preflight.</p> : null}
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <p className="font-semibold">Server preflight</p>
                    {!templateId ? <p className="mt-1 text-slate-500">Save this template to enable server preflight checks.</p> : null}
                    {inspectorPreflightLoading ? <p className="mt-1 text-slate-500">Running preflight...</p> : null}
                    {inspectorPreflightError ? <p className="mt-1 text-red-700">{inspectorPreflightError}</p> : null}
                    {inspectorPreflight && !inspectorPreflightLoading ? (
                      <>
                        <p className="mt-1 font-semibold text-slate-700">
                          Server status: Informational
                        </p>
                        <p className="mt-1 text-slate-600">Validation notes: {inspectorPreflight.blockers.length} · Warnings: {inspectorPreflight.warnings.length}</p>
                      </>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => void runInspectorPreflight()} disabled={!templateId || inspectorPreflightLoading}>Refresh</Button>
                      <Button onClick={() => void saveAndRunInspectorPreflight()} disabled={saving || inspectorPreflightLoading}>{saving ? "Saving..." : "Save + Refresh"}</Button>
                    </div>
                  </div>
                </InspectorCard>
              </>
            ) : null}
            {inspectorTab === "Merge Fields" ? (
              <>
                <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Live Merge Fields</p>
                    <p className="mt-1 text-xs text-slate-600">Search, then click a field to insert it. Simple fields like {"{first}"} and slash fields like //first render from live CRM data.</p>
                  </div>
                  <SearchBox value={mergeFieldSearch} onChange={setMergeFieldSearch} placeholder="Search merge fields..." />
                  <div className="grid grid-cols-3 gap-2">
                    {["{first}", "{last}", "{name}", "{amount}", "{giftDate}", "{totalGiving}"].map((field) => (
                      <button key={field} type="button" onClick={() => insertToken(field)} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-left text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100">
                        {field}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Detected in this draft</p>
                      <StatusPill label={unknownTokens.length ? "Review" : "Known"} tone={unknownTokens.length ? "orange" : "green"} />
                    </div>
                    {detectedTokens.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detectedTokens.map((token) => {
                          const known = mergeRegistry.has(normalizeToken(token));
                          return (
                            <button
                              key={token}
                              type="button"
                              onMouseEnter={() => void loadMergeLinePreview(token)}
                              onFocus={() => void loadMergeLinePreview(token)}
                              className={[
                                "rounded border px-2 py-1 font-mono text-[11px] font-semibold",
                                known ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-amber-300 bg-amber-50 text-amber-800",
                              ].join(" ")}
                            >
                              {token}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No merge fields detected yet.</p>
                    )}
                    {mergeLinePreviewToken ? (
                      <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
                        <p className="text-[11px] font-semibold text-slate-700">Line preview for <span className="font-mono">{mergeLinePreviewToken}</span></p>
                        {mergeLinePreviewLoading ? <p className="mt-1 text-xs text-slate-500">Loading live examples...</p> : null}
                        {mergeLinePreviewError ? <p className="mt-1 text-xs text-red-700">{mergeLinePreviewError}</p> : null}
                        {!mergeLinePreviewLoading && !mergeLinePreviewError && mergeLinePreview?.items.length === 0 ? <p className="mt-1 text-xs text-slate-500">No constituents available for preview.</p> : null}
                        {!mergeLinePreviewLoading && mergeLinePreview?.items.length ? (
                          <div className="mt-2 space-y-2">
                            {mergeLinePreview.items.map((item) => (
                              <div key={`${item.constituentId}-${item.donationId ?? "none"}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                                <p className="text-[11px] font-semibold text-slate-600">{item.recipientName}</p>
                                <p className="mt-0.5 text-xs text-slate-800">{item.renderedLine || "(blank after merge)"}</p>
                                {(item.missingFields?.length || item.unsupportedFields?.length) ? (
                                  <p className="mt-1 text-[11px] text-amber-700">
                                    Notes: {[...(item.missingFields ?? []), ...(item.unsupportedFields ?? [])].join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Showing {filteredMergeSections.reduce((sum, section) => sum + section.fields.length, 0)} of {allFields.length} fields
                  </p>
                </div>
                {filteredMergeSections.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No merge fields match that search.</div>
                ) : null}
                {filteredMergeSections.map((section) => (
                  <details key={section.key} open className="rounded-md border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</summary>
                    <div className="mt-2 space-y-1">
                      {section.fields.map((field) => <button key={field} type="button" onClick={() => insertToken(field)} className="block w-full rounded border border-slate-200 px-2 py-1.5 text-left font-mono text-[11px] hover:bg-emerald-50">{field}</button>)}
                    </div>
                  </details>
                ))}
              </>
            ) : null}
            {inspectorTab === "Block Settings" ? (
              <>
                <InspectorCard title="Layout & Blocks">
                  <div className="grid gap-2">
                    <Button onClick={() => formatBlock("h1")}>Insert Heading</Button>
                    <Button onClick={() => insertBlock("<hr />")}>Insert Divider</Button>
                    <Button onClick={insertFillSpace}>Push Content to Bottom</Button>
                    <Button onClick={() => insertBlock('<div style="page-break-after: always;"></div>')}>Insert Page Break</Button>
                    <Button onClick={() => insertSignature()}>Insert Signature</Button>
                  </div>
                </InspectorCard>
                <InspectorCard title="Table Builder" tooltip="Create editable tables that preserve basic structure and alignment in server-rendered PDFs.">
                  <div className="grid grid-cols-2 gap-2">
                    <TableNumberField label="Rows" value={tableBuilder.rows} min={1} max={12} onChange={(value) => setTableBuilder((current) => ({ ...current, rows: value }))} />
                    <TableNumberField label="Columns" value={tableBuilder.columns} min={1} max={8} onChange={(value) => setTableBuilder((current) => ({ ...current, columns: value }))} />
                    <TableNumberField label="Width %" value={tableBuilder.widthPercent} min={35} max={100} onChange={(value) => setTableBuilder((current) => ({ ...current, widthPercent: value }))} />
                    <TableNumberField label="Cell Padding" value={tableBuilder.cellPadding} min={2} max={24} onChange={(value) => setTableBuilder((current) => ({ ...current, cellPadding: value }))} />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={tableBuilder.headerRow}
                      onChange={(event) => setTableBuilder((current) => ({ ...current, headerRow: event.target.checked }))}
                    />
                    Include header row
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LabeledSelect
                      label="Border"
                      value={tableBuilder.borderStyle}
                      onChange={(value) => setTableBuilder((current) => ({ ...current, borderStyle: value as LetterTableBorderStyle }))}
                      options={["solid", "dashed", "none"]}
                      labels={{ solid: "Solid", dashed: "Dashed", none: "None" }}
                    />
                    <LabeledSelect
                      label="Text Align"
                      value={tableBuilder.textAlign}
                      onChange={(value) => setTableBuilder((current) => ({ ...current, textAlign: value as LetterTextAlign }))}
                      options={["left", "center", "right", "justify"]}
                      labels={{ left: "Left", center: "Center", right: "Right", justify: "Justify" }}
                    />
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Button onClick={() => insertTable(tableBuilder)} tone="primary">Insert Custom Table</Button>
                    <Button onClick={() => insertTablePreset("donationSummary")}>Donation Summary Table</Button>
                    <Button onClick={() => insertTablePreset("impactGrid")}>Impact Grid Table</Button>
                    <Button onClick={() => insertTablePreset("signatureContact")}>Signature Contact Table</Button>
                  </div>
                </InspectorCard>
                <InspectorCard title="Selected Image Size">
                  {selectedImageWidth === null ? (
                    <p className="text-xs text-slate-500">Select an image in the letter to resize it.</p>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Alt Text
                        <input
                          value={selectedImageAlt}
                          onChange={(event) => updateSelectedImageAlt(event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
                        />
                      </label>
                      <input
                        aria-label="Selected image width"
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={selectedImageWidth}
                        onChange={(event) => resizeSelectedImage(Number(event.target.value))}
                        className="w-full"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 75, 100].map((width) => <Button key={width} onClick={() => resizeSelectedImage(width)}>{width}%</Button>)}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <Button key={align} onClick={() => alignSelectedImage(align)} tone={selectedImageAlign === align ? "primary" : "default"}>
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </InspectorCard>
              </>
            ) : null}
          </div>
        </aside>
      </div>
      {aiComposerOpen ? (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-5xl rounded-full border border-slate-300 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">AI</span>
              <input
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void generateAiLetterContent();
                  }
                }}
                placeholder="Ask Steward to draft or rewrite letter content..."
                className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={aiUseMergeFields} onChange={(event) => setAiUseMergeFields(event.target.checked)} />
                Merge fields
              </label>
              <Button onClick={() => void generateAiLetterContent()} disabled={aiGenerating}>{aiGenerating ? "Writing..." : "Generate"}</Button>
              <Button onClick={insertAiOutputAtCursor} tone="primary" disabled={!aiOutput?.bodyHtml || aiGenerating}>Insert at Cursor</Button>
              <IconButton label="Close AI composer" onClick={() => setAiComposerOpen(false)}>×</IconButton>
            </div>
          </div>
          {aiError ? <p className="mt-2 px-12 text-xs font-semibold text-red-700">{aiError}</p> : null}
          {inlineSuggestEnabled && (inlineSuggestion || inlineSuggestionLoading || inlineSuggestionError) ? (
            <div className="mx-1 mt-2 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-slate-800">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Suggestion</span>
              <span className="min-w-0 flex-1 truncate">{inlineSuggestionLoading ? "Thinking..." : inlineSuggestionError || inlineSuggestion}</span>
              {inlineSuggestion ? <Button onClick={acceptInlineSuggestion}>Accept</Button> : null}
              {inlineSuggestion ? <span className="text-xs text-slate-500">Tab</span> : null}
            </div>
          ) : null}
          {aiOutput ? (
            <div className="mx-1 mt-2 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <p className="whitespace-pre-wrap leading-6">{aiOutput.bodyText || htmlToPlainTextClient(aiOutput.bodyHtml)}</p>
              {aiOutput.mergeFieldsUsed.length > 0 ? (
                <p className="mt-2 border-t border-slate-200 pt-2 font-mono text-[11px] text-slate-500">
                  Merge fields: {aiOutput.mergeFieldsUsed.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {testConstituentLookupOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 xl:p-8">
          <button type="button" aria-label="Close test constituent lookup" className="absolute inset-0 bg-slate-950/55" onClick={() => setTestConstituentLookupOpen(false)} />
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Test Constituent Lookup</p>
                <p className="text-sm text-slate-600">Choose the sample constituent used by the server-rendered live PDF preview.</p>
              </div>
              <Button onClick={() => setTestConstituentLookupOpen(false)}>Close</Button>
            </div>
            <div className="border-b border-slate-200 p-4">
              <SearchBox value={testConstituentSearch} onChange={setTestConstituentSearch} placeholder="Search by name, email, or address..." />
            </div>
            <div className="max-h-[62vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Mail</th><th className="px-4 py-3">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {testConstituentResults.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No constituents match this search.</td></tr>
                  ) : testConstituentResults.map((row) => (
                    <tr key={row.id} className={row.id === testConstituentId ? "bg-emerald-50/60" : undefined}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{personName(row)}</p>
                        <p className="text-xs text-slate-500">{row.email || "No email"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatAddress(row) || "No address"}</td>
                      <td className="px-4 py-3"><StatusPill label={row.doNotMail ? "Do Not Mail" : hasAddress(row) ? "Ready" : "Missing Address"} tone={row.doNotMail ? "red" : hasAddress(row) ? "green" : "orange"} /></td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => { setTestConstituentId(row.id); void openServerPdfPreview(row.id); }} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={editorPdfLoading}>
                          Use & Render
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {editorPdfOpen && editorPdfUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button type="button" aria-label="Close live PDF preview" className="absolute inset-0 bg-slate-950/60" onClick={() => setEditorPdfOpen(false)} />
          <div className="relative z-10 flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{editorPdfTitle}</p>
                <p className="truncate text-xs text-slate-600">Server-rendered final PDF preview · {editorPdfFileName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={editorPdfUrl} download={editorPdfFileName} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Save PDF</a>
                <Button onClick={printEditorPdf}>Print</Button>
                <Button onClick={() => setEditorPdfOpen(false)}>Close</Button>
              </div>
            </div>
            {editorPdfError ? <Alert tone="amber">{editorPdfError}</Alert> : null}
            <object title="Editor Live PDF Preview" data={`${editorPdfUrl}#toolbar=1&navpanes=0&view=FitH`} type="application/pdf" className="min-h-0 flex-1 bg-slate-100">
              <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                This browser is not rendering the PDF inline. Use Print to open the print preview window or Save PDF to download it.
              </div>
            </object>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PublishWorkspace({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const [template, setTemplate] = useState<LetterTemplateDetail | null>(null);
  const [sections, setSections] = useState<MergeFieldSection[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [validation, setValidation] = useState<PublishValidationResult | null>(null);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [samplePdfLoading, setSamplePdfLoading] = useState(false);
  const [savedPreviewPdfUrl, setSavedPreviewPdfUrl] = useState<string | null>(null);
  const [savedPreviewPdfLoading, setSavedPreviewPdfLoading] = useState(false);
  const [savedPreviewPdfError, setSavedPreviewPdfError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activePublishTab, setActivePublishTab] = useState<PublishReviewTab>("summary");

  const load = useCallback(async () => {
    if (!templateId) {
      setError("Save the template before publishing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [templateResult, fieldsResult, brandingResult, validationResult, historyResult] = await Promise.all([
        apiFetch<LetterTemplateDetail>(`/api/letters/templates/${templateId}`),
        apiFetch<{ sections: MergeFieldSection[] }>("/api/letters/merge-fields"),
        apiFetch<BrandingSettings>("/api/settings/branding"),
        apiFetch<PublishValidationResult>(`/api/letters/templates/${templateId}/publish`, {
          method: "POST",
          body: JSON.stringify({ confirm: false }),
        }),
        apiFetch<PublishHistoryResponse>(`/api/letters/templates/${templateId}/publish-history?limit=10`),
      ]);
      setTemplate(templateResult);
      setSections(fieldsResult.sections ?? []);
      setBranding(normalizeBrandingSettings(brandingResult));
      setValidation(validationResult);
      setPublishHistory(historyResult.items ?? []);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load publish workspace."));
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (savedPreviewPdfUrl) {
        URL.revokeObjectURL(savedPreviewPdfUrl);
      }
    };
  }, [savedPreviewPdfUrl]);

  const registry = useMemo(() => new Set(sections.flatMap((section) => section.fields).map(normalizeToken)), [sections]);
  const tokens = useMemo(() => extractTokens(`${template?.printSubject ?? ""} ${template?.printBody ?? ""} ${template?.emailSubject ?? ""} ${template?.emailBody ?? ""}`), [template]);
  const unknownTokens = tokens.filter((token) => !registry.has(normalizeToken(token)));
  const validationBlockers = validation?.blockers ?? [];
  const validationWarnings = validation?.warnings ?? [];
  const samplePdfPreflight = validation?.samplePdfPreflight ?? null;
  const validationIssueCount = unknownTokens.length + validationBlockers.length;
  const canPublishNow = Boolean(templateId);

  async function publish() {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    logLetterPublishDiagnostics({
      stage: "before-publish",
      template,
      branding,
      unknownTokens,
      validation,
    });
    try {
      const result = await apiFetch<PublishValidationResult>(`/api/letters/templates/${templateId}/publish`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      setValidation(result);
      if (!result.canPublish || !result.published) {
        setError("Publish request did not complete. Review server response and try again.");
        return;
      }
      logLetterPublishDiagnostics({
        stage: "after-publish",
        template,
        branding,
        unknownTokens,
        validation: result,
      });
      setNotice(validationIssueCount > 0
        ? "Template published with validation notes. Review the browser console for developer diagnostics."
        : "Template published. Opening Generate workspace...");
      router.push(`/oyama-letters/generate?templateId=${encodeURIComponent(templateId)}&mode=batch&target=print`);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to publish template."));
    } finally {
      setSaving(false);
    }
  }

  async function openSampleServerPdf() {
    if (!templateId) return;
    setSamplePdfLoading(true);
    setError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/templates/${encodeURIComponent(templateId)}/sample-pdf?preview=1&inline=1`, {
        method: "POST",
      });
      if (!response.ok) {
        let message = `Sample PDF export failed (${response.status}).`;
        try {
          const parsed = await response.json();
          if (parsed?.error?.message) message = String(parsed.error.message);
        } catch {
          // Keep default message when response is not JSON.
        }
        throw new Error(message);
      }

      const pdfBlob = await response.blob();
      if (pdfBlob.size === 0) {
        throw new Error("Sample PDF export returned an empty file.");
      }

      const objectUrl = URL.createObjectURL(pdfBlob);
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.assign(objectUrl);
      }
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
      setNotice("Opened server-rendered sample PDF in a new tab.");
    } catch (requestError) {
      console.warn("[OyamaLetters PDF Preview Diagnostics] Failed to open sample server PDF.", {
        templateId,
        templateName: template?.name ?? null,
        error: errorMessage(requestError, "Failed to open sample PDF preview."),
        rawPrintBodyHtml: template?.printBody ?? "",
      });
      setError(errorMessage(requestError, "Failed to open sample PDF preview."));
    } finally {
      setSamplePdfLoading(false);
    }
  }

  const loadSavedPreviewPdf = useCallback(async () => {
    if (!templateId) return;
    setSavedPreviewPdfLoading(true);
    setSavedPreviewPdfError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/templates/${encodeURIComponent(templateId)}/sample-pdf?preview=1&inline=1`, {
        method: "POST",
      });
      if (!response.ok) {
        let message = `Sample PDF preview failed (${response.status}).`;
        try {
          const parsed = await response.json();
          if (parsed?.error?.message) message = String(parsed.error.message);
        } catch {
          // Keep default message when response is not JSON.
        }
        throw new Error(message);
      }
      const pdfBlob = await response.blob();
      if (pdfBlob.size === 0) {
        throw new Error("Sample PDF preview returned an empty file.");
      }
      const nextUrl = URL.createObjectURL(pdfBlob);
      setSavedPreviewPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
    } catch (requestError) {
      console.warn("[OyamaLetters PDF Preview Diagnostics] Failed to load inline server preview.", {
        templateId,
        templateName: template?.name ?? null,
        error: errorMessage(requestError, "Unable to load server preview."),
        rawPrintBodyHtml: template?.printBody ?? "",
      });
      setSavedPreviewPdfError(errorMessage(requestError, "Unable to load server preview."));
      setSavedPreviewPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    } finally {
      setSavedPreviewPdfLoading(false);
    }
  }, [template?.name, template?.printBody, templateId]);

  useEffect(() => {
    void loadSavedPreviewPdf();
  }, [loadSavedPreviewPdf]);

  if (loading) return <LoadingPage label="Loading publish workspace..." />;

  const publishTabs: Array<{ key: PublishReviewTab; label: string }> = [
    { key: "summary", label: "Template Summary" },
    { key: "fields", label: "Merge Fields" },
    { key: "validation", label: "Validation Notes" },
    { key: "recipient", label: "Recipient Compatibility" },
    { key: "pdf", label: "PDF Preview" },
    { key: "confirm", label: "Publish Confirmation" },
  ];
  const activePublishTabIndex = Math.max(0, publishTabs.findIndex((tab) => tab.key === activePublishTab));
  const previousPublishTab = publishTabs[activePublishTabIndex - 1] ?? null;
  const nextPublishTab = publishTabs[activePublishTabIndex + 1] ?? null;

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fa]">
      <PageHero title="Publish Template" subtitle="Review merge fields, validation notes, and PDF output before generation. Publishing is allowed even when validation notes need follow-up.">
        <Button href={templateId ? `/oyama-letters/templates/${templateId}` : "/oyama-letters"}>Back to Canvas</Button>
        <Button onClick={() => void load()}>Validate</Button>
        <Button onClick={() => void openSampleServerPdf()} disabled={samplePdfLoading || !templateId}>{samplePdfLoading ? "Rendering Sample PDF..." : "Open Sample Server PDF"}</Button>
        <Button onClick={() => void publish()} tone="primary" disabled={saving || !canPublishNow}>{saving ? "Publishing..." : "Publish & Continue"}</Button>
      </PageHero>
      {error ? <Alert tone="amber">{error}</Alert> : null}
      {notice ? <Alert tone="green">{notice}</Alert> : null}
      <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 xl:px-6">
        <span className="font-semibold">Publish policy:</span> validation is advisory. Unknown merge fields, missing sample data, or PDF preflight warnings are logged for review but do not prevent publishing.
      </div>
      <div className="border-b border-slate-200 bg-white px-4 xl:px-6">
        <div className="flex gap-6 overflow-x-auto">
          {publishTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePublishTab(tab.key)}
              className={["h-12 shrink-0 border-b-2 text-xs font-semibold", activePublishTab === tab.key ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_400px] xl:p-5">
        <section className="space-y-4">
          {activePublishTab === "summary" ? (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold">Template Summary</h2>
                  <p className="mt-1 text-xs text-slate-600">Confirm the saved template that will become available for generation.</p>
                </div>
                <StatusPill label={template?.status ?? "Unknown"} tone={template?.status === "ACTIVE" ? "green" : "orange"} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ReviewFact label="Template name" value={template?.name || "Untitled"} />
                <ReviewFact label="Category" value={template?.category?.replaceAll("_", " ") || "General"} />
                <ReviewFact label="Print subject" value={template?.printSubject || "No print subject"} />
                <ReviewFact label="Signature" value={template?.signatureBlock?.name || "Optional, not selected"} />
              </div>
              <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                This publish step activates the saved template for staff generation. It does not create letters, print files, mail records, or emails.
              </div>
            </div>
          ) : null}

          {activePublishTab === "fields" ? (
            <>
              <div>
                <h2 className="text-[18px] font-semibold">Detected Merge Fields ({tokens.length})</h2>
                <p className="mt-1 text-xs text-slate-600">Review every token found in the saved print and email content.</p>
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr><th className="px-4 py-3">Merge Field</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Behavior</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tokens.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No merge fields detected in this saved template.</td></tr>
                    ) : tokens.map((token) => {
                      const known = registry.has(normalizeToken(token));
                      return (
                        <tr key={token}>
                          <td className="px-4 py-3 font-mono text-xs">{token}</td>
                          <td className="px-4 py-3">{tokenSource(token)}</td>
                          <td className="px-4 py-3"><StatusPill label={known ? "Known" : "Unknown"} tone={known ? "green" : "orange"} /></td>
                          <td className="px-4 py-3 text-slate-600">{known ? "Available for preview and generation" : "Review before generation; publishing is still allowed"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activePublishTab === "validation" ? (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[18px] font-semibold">Validation Notes</h2>
              <p className="mt-1 text-xs text-slate-600">These notes are informational. Publish remains available so staff can decide whether to proceed.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ReviewMetric label="Unknown fields" value={unknownTokens.length} tone={unknownTokens.length ? "amber" : "green"} />
                <ReviewMetric label="Server notes" value={validationBlockers.length} tone={validationBlockers.length ? "amber" : "green"} />
                <ReviewMetric label="Warnings" value={validationWarnings.length} tone={validationWarnings.length ? "amber" : "green"} />
              </div>
              <ValidationList title="Unknown merge fields" items={unknownTokens} empty="No unknown merge fields detected." tone="amber" />
              <ValidationList title="Server validation notes" items={validationBlockers} empty="No server validation notes returned." tone="amber" />
              <ValidationList title="Warnings" items={validationWarnings} empty="No warnings returned." tone="amber" />
            </div>
          ) : null}

          {activePublishTab === "recipient" ? (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[18px] font-semibold">Recipient Compatibility</h2>
              <p className="mt-1 text-xs text-slate-600">Sample recipient checks help catch missing address or merge data before staff generate real letters.</p>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className={["text-sm font-semibold", validation?.sampleValidation?.valid === false ? "text-amber-800" : "text-emerald-800"].join(" ")}>
                  {validation?.sampleValidation?.valid === false ? "Sample recipient has notes" : "Sample recipient check is clear or not required"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {(validation?.sampleValidation?.reasons ?? ["VALID"]).join(", ")}
                </p>
              </div>
            </div>
          ) : null}

          {activePublishTab === "pdf" ? (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold">PDF Preview</h2>
                  <p className="mt-1 text-xs text-slate-600">Verify the same server-rendered path used by generated letter PDFs.</p>
                </div>
                <Button onClick={() => void openSampleServerPdf()} disabled={samplePdfLoading || !templateId}>{samplePdfLoading ? "Rendering..." : "Open Server PDF"}</Button>
              </div>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className={["font-semibold", samplePdfPreflight?.canRender ? "text-emerald-800" : "text-amber-800"].join(" ")}>
                  PDF Parity Check: {samplePdfPreflight?.canRender ? "Server Render Verified" : samplePdfPreflight?.checked ? "Render Needs Attention" : "Preflight Skipped"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Uses server renderer ({samplePdfPreflight?.renderer ?? "SERVER_RENDER"}) with parser {samplePdfPreflight?.parser ?? "htmlToPdfBlocks"} for preview parity checks.
                </p>
                <p className="mt-2 text-xs text-slate-700">Parsed block count: {String(samplePdfPreflight?.blockCount ?? 0)}</p>
                {samplePdfPreflight?.reason === "NO_SAMPLE_RECIPIENT" ? (
                  <p className="mt-2 text-xs text-amber-700">No sample recipient was available. The server will use a synthetic preview recipient for direct sample PDF rendering.</p>
                ) : null}
                {samplePdfPreflight?.reason === "PARSER_FAILURE" ? (
                  <p className="mt-2 text-xs text-red-700">Server parser failed during preflight. Publishing is still allowed, but generated PDFs may need review before mailing.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activePublishTab === "confirm" ? (
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[18px] font-semibold">Publish Confirmation</h2>
              <p className="mt-1 text-xs text-slate-600">Publishing activates this template for the Generate Letters workspace.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ReviewMetric label="Fields" value={tokens.length} tone="slate" />
                <ReviewMetric label="Notes" value={validationIssueCount} tone={validationIssueCount ? "amber" : "green"} />
                <ReviewMetric label="PDF blocks" value={samplePdfPreflight?.blockCount ?? 0} tone={samplePdfPreflight?.canRender ? "green" : "amber"} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => void load()}>Refresh Review</Button>
                <Button onClick={() => void publish()} tone="primary" disabled={saving || !canPublishNow}>{saving ? "Publishing..." : "Publish & Continue"}</Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <Button onClick={() => previousPublishTab ? setActivePublishTab(previousPublishTab.key) : undefined} disabled={!previousPublishTab}>Previous Review Step</Button>
            <div className="text-xs font-semibold text-slate-600">
              Step {activePublishTabIndex + 1} of {publishTabs.length}: {publishTabs[activePublishTabIndex]?.label ?? "Review"}
            </div>
            {nextPublishTab ? (
              <Button onClick={() => setActivePublishTab(nextPublishTab.key)} tone="primary">Next Review Step</Button>
            ) : (
              <Button onClick={() => void publish()} tone="primary" disabled={saving || !canPublishNow}>{saving ? "Publishing..." : "Publish & Continue"}</Button>
            )}
          </div>
        </section>
        <aside className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="font-semibold">Saved Template Preview</h2>
            <p className="mt-1 text-xs text-slate-600">Server-rendered PDF preview with official header/footer/signature branding.</p>
            <div className="mt-4 rounded-md border border-slate-200 bg-[#f3f5f8] p-4">
              {savedPreviewPdfLoading ? (
                <p className="py-12 text-center text-xs text-slate-600">Rendering branded sample PDF...</p>
              ) : savedPreviewPdfUrl ? (
                <object title="Saved template server preview" data={`${savedPreviewPdfUrl}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" className="h-[500px] w-full rounded border border-slate-200 bg-white">
                  <div className="flex h-[500px] items-center justify-center p-6 text-center text-xs text-slate-700">
                    Inline PDF preview is unavailable in this browser. Use Open Sample Server PDF above.
                  </div>
                </object>
              ) : (
                <>
                  <MiniDocument html={template?.printBody || ""} branding={branding} />
                  <p className="mt-3 text-xs text-amber-700">{savedPreviewPdfError || "Server preview unavailable, showing raw template body."}</p>
                </>
              )}
            </div>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="font-semibold text-emerald-900">Merge Fields Summary</p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-emerald-200 text-center">
              <SummaryNumber label="Detected" value={String(tokens.length)} />
              <SummaryNumber label="Known" value={String(tokens.length - unknownTokens.length)} />
              <SummaryNumber label="Unknown" value={String(unknownTokens.length)} tone={unknownTokens.length ? "red" : "green"} />
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="font-semibold">Publish History</h2>
            <p className="mt-1 text-xs text-slate-600">Immutable publish snapshots for this template.</p>
            <div className="mt-3 space-y-2">
              {publishHistory.length === 0 ? (
                <p className="text-xs text-slate-500">No publish snapshots yet.</p>
              ) : publishHistory.map((entry) => (
                <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{formatDate(entry.createdAt)}</span>
                    <StatusPill label={`${entry.previousStatus} -> ${entry.nextStatus}`} tone="green" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">Warnings: {entry.warnings.length} · Unsupported fields: {entry.unsupportedFields.length}</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    PDF preflight: {entry.samplePdfPreflight?.canRender ? "verified" : entry.samplePdfPreflight?.checked ? "failed" : "skipped"}
                    {entry.samplePdfPreflight ? ` · Blocks: ${entry.samplePdfPreflight.blockCount}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function buildLetterPublishHtml(template: LetterTemplateDetail | null, branding: BrandingSettings): string {
  const organizationName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization";
  const headerHtml = branding.globalHeaderHtml
    || `<div><strong>${escapeHtml(organizationName)}</strong>${branding.tagline ? `<div>${escapeHtml(branding.tagline)}</div>` : ""}</div>`;
  const address = formatBrandingAddress(branding);
  const footerHtml = branding.globalFooterHtml
    || `<div>${escapeHtml(branding.footerLegalText || organizationName)}</div>${address ? `<div>${escapeHtml(address)}</div>` : ""}`;

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(template?.name || "Letter Template")}</title>`,
    "</head>",
    `<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial, Helvetica, sans-serif;">`,
    '<main style="max-width:760px;margin:0 auto;background:#ffffff;padding:40px;">',
    `<header data-oyama-global-letter-header="true">${headerHtml}</header>`,
    `<article data-oyama-letter-body="true">${template?.printBody || ""}</article>`,
    `<footer data-oyama-global-letter-footer="true">${footerHtml}</footer>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReviewMetric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "slate" }) {
  const toneClass = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-900";
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function ValidationList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "amber" | "green";
}) {
  const toneClass = tone === "green" ? "text-emerald-800" : "text-amber-800";
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className={`text-sm font-semibold ${toneClass}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function logLetterPublishDiagnostics({
  stage,
  template,
  branding,
  unknownTokens,
  validation,
}: {
  stage: "before-publish" | "after-publish";
  template: LetterTemplateDetail | null;
  branding: BrandingSettings;
  unknownTokens: string[];
  validation: PublishValidationResult | null;
}) {
  const fullHtml = buildLetterPublishHtml(template, branding);
  const rawBodyHtml = template?.printBody || "";
  const diagnostics = {
    stage,
    publishedAt: new Date().toISOString(),
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    status: template?.status ?? null,
    printSubject: template?.printSubject ?? null,
    emailSubject: template?.emailSubject ?? null,
    unknownTokens,
    validationBlockers: validation?.blockers ?? [],
    validationWarnings: validation?.warnings ?? [],
    sampleValidation: validation?.sampleValidation ?? null,
    samplePdfPreflight: validation?.samplePdfPreflight ?? null,
    fullHtmlLength: fullHtml.length,
    rawBodyHtmlLength: rawBodyHtml.length,
    globalHeaderConfigured: Boolean(branding.globalHeaderHtml.trim()),
    globalFooterConfigured: Boolean(branding.globalFooterHtml.trim()),
  };

  console.groupCollapsed(`[OyamaLetters Publish Diagnostics] ${stage}: ${template?.id ?? "unsaved"}`);
  console.info("Summary", diagnostics);
  console.info("Entire letter HTML output", fullHtml);
  console.info("Raw letter body HTML", rawBodyHtml);
  console.groupEnd();
}

function GenerateWorkspace() {
  const searchParams = useSearchParams();
  const temporaryListId = searchParams.get("temporaryListId") ?? "";
  const [temporaryRecipientList, setTemporaryRecipientList] = useState<TemporaryRecipientList | null>(null);
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [generated, setGenerated] = useState<GeneratedLetterSummary[]>([]);
  const [constituents, setConstituents] = useState<ConstituentLookup[]>([]);
  const [recipientLists, setRecipientLists] = useState<RecipientListSummary[]>([]);
  const [tagCatalog, setTagCatalog] = useState<ConstituentTagCatalog[]>([]);
  const [listMembersById, setListMembersById] = useState<Record<string, RecipientListDetail["recipients"]>>({});
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [workflowPolicy, setWorkflowPolicy] = useState<WorkflowPolicy | null>(null);
  const [donations, setDonations] = useState<DonationLookup[]>([]);
  const [templateId, setTemplateId] = useState(searchParams.get("templateId") ?? "");
  const [constituentId, setConstituentId] = useState(searchParams.get("constituentId") ?? "");
  const [donationId, setDonationId] = useState(searchParams.get("donationId") ?? "");
  const modeParam = (searchParams.get("mode") ?? "").toLowerCase();
  const targetParam = (searchParams.get("target") ?? "").toLowerCase();
  const quickPrint = searchParams.get("quickPrint") === "1";
  const [generateMode, setGenerateMode] = useState<GenerateMode>(modeParam === "single" ? "single" : "batch");
  const [deliveryTarget, setDeliveryTarget] = useState<DeliveryTarget>(
    targetParam === "mail" ? "MAIL_QUEUE" : targetParam === "print" ? "PRINT_QUEUE" : "PDF_ONLY",
  );
  const [query, setQuery] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"individuals" | "lists" | "segments" | "filters">("individuals");
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [selectedIndividualIds, setSelectedIndividualIds] = useState<string[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [selectedDonorStatuses, setSelectedDonorStatuses] = useState<string[]>([]);
  const [pickerLoadingListId, setPickerLoadingListId] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<LetterTemplateDetail | null>(null);
  const [recipientTab, setRecipientTab] = useState<"all" | "missingAddress" | "missingRequired" | "suppressed">("all");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [recipientStepTab, setRecipientStepTab] = useState<"lists" | "segments" | "filters" | "individuals">("segments");
  const [donationMode, setDonationMode] = useState<DonationMode>("recent");
  const [donationDateRange, setDonationDateRange] = useState("Last 90 days");
  const [donationType, setDonationType] = useState("All Types");
  const [donationMinimum, setDonationMinimum] = useState("");
  const [donationAdvancedOpen, setDonationAdvancedOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("Generated PDF Viewer");
  const [pdfViewerFileName, setPdfViewerFileName] = useState("generated-letter.pdf");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfFileName, setPreviewPdfFileName] = useState("letter-preview.pdf");
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const list = readTemporaryRecipientList(temporaryListId);
    if (!list) return;
    setTemporaryRecipientList(list);
    setSelectedRecipientIds(list.constituentIds);
    setSelectedIndividualIds(list.constituentIds);
    if ((list.donationIds ?? []).length > 0) {
      setDonationMode("selected");
    }
    setGenerateMode("batch");
    setRecipientStepTab("individuals");
  }, [temporaryListId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, generatedRows, constituentRows, listRows, tagRows, brandingRow, workflowPolicyRow] = await Promise.all([
        apiFetch<LetterTemplateSummary[]>("/api/letters/templates"),
        apiFetch<GeneratedLetterSummary[]>("/api/letters/generated?limit=25"),
        apiFetch<ConstituentLookup[]>("/api/constituents?limit=all").catch(() => []),
        apiFetch<RecipientListSummary[]>("/api/email-campaigns/lists").catch(() => []),
        apiFetch<ConstituentTagCatalog[]>("/api/constituents/tags/catalog").catch(() => []),
        apiFetch<BrandingSettings>("/api/settings/branding").catch(() => DEFAULT_BRANDING_SETTINGS),
        apiFetch<WorkflowPolicy>("/api/letters/workflow-settings").catch(() => null),
      ]);
      setTemplates(templateRows);
      setGenerated(generatedRows);
      setConstituents(constituentRows);
      setRecipientLists(listRows);
      setTagCatalog(tagRows);
      setBranding(normalizeBrandingSettings(brandingRow));
      setWorkflowPolicy(workflowPolicyRow);
      if (!templateId && templateRows.length > 0) setTemplateId((templateRows.find((item) => item.status === "ACTIVE") ?? templateRows[0]).id);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load generation workspace."));
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!templateId) {
      setSelectedTemplateDetail(null);
      return;
    }

    void apiFetch<LetterTemplateDetail>(`/api/letters/templates/${templateId}`)
      .then((detail) => {
        if (!cancelled) setSelectedTemplateDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setSelectedTemplateDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Quick Print: when arriving from a constituent profile with quickPrint=1,
  // skip recipient selection and jump straight to step 3 (Donation Context)
  // once the template and constituent are both resolved.
  useEffect(() => {
    if (!quickPrint || !constituentId || !templateId || loading) return;
    setWizardStep(3);
  }, [quickPrint, constituentId, templateId, loading]);

  useEffect(() => {
    setGenerateMode(modeParam === "single" ? "single" : "batch");
    setDeliveryTarget(targetParam === "mail" ? "MAIL_QUEUE" : targetParam === "print" ? "PRINT_QUEUE" : "PDF_ONLY");
  }, [modeParam, targetParam]);

  useEffect(() => {
    if (workflowPolicy && !workflowPolicy.allowDirectMailQueue && deliveryTarget === "MAIL_QUEUE") {
      setDeliveryTarget("PRINT_QUEUE");
    }
  }, [deliveryTarget, workflowPolicy]);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "25" });
    if (constituentId) params.set("constituentId", constituentId);
    apiFetch<{ items: DonationLookup[] }>(`/api/donations?${params.toString()}`)
      .then((payload) => setDonations(payload.items ?? []))
      .catch(() => setDonations([]));
  }, [constituentId]);

  const emailToConstituentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of constituents) {
      const normalizedEmail = row.email?.trim().toLowerCase();
      if (normalizedEmail && !map.has(normalizedEmail)) {
        map.set(normalizedEmail, row.id);
      }
    }
    return map;
  }, [constituents]);

  const resolvedListRecipientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const listId of selectedListIds) {
      const recipients = listMembersById[listId] ?? [];
      for (const recipient of recipients) {
        const mapped = emailToConstituentId.get(recipient.email.trim().toLowerCase());
        if (mapped) ids.add(mapped);
      }
    }
    return Array.from(ids);
  }, [emailToConstituentId, listMembersById, selectedListIds]);

  const resolvedSegmentRecipientIds = useMemo(() => {
    if (selectedTagNames.length === 0) return [];
    const selected = new Set(selectedTagNames.map((name) => name.toLowerCase()));
    return constituents
      .filter((row) => (row.tags ?? []).some((entry) => selected.has((entry.tag?.name ?? "").toLowerCase())))
      .map((row) => row.id);
  }, [constituents, selectedTagNames]);

  const resolvedStatusRecipientIds = useMemo(() => {
    if (selectedDonorStatuses.length === 0) return [];
    const selected = new Set(selectedDonorStatuses.map((status) => status.toUpperCase()));
    return constituents
      .filter((row) => selected.has((row.donorStatus ?? "").toUpperCase()))
      .map((row) => row.id);
  }, [constituents, selectedDonorStatuses]);

  const selectedListMemberCount = useMemo(() => {
    const counts = new Map(recipientLists.map((list) => [list.id, list.recipientsCount]));
    return selectedListIds.reduce((sum, listId) => sum + (counts.get(listId) ?? 0), 0);
  }, [recipientLists, selectedListIds]);

  const selectedSegmentsRecipientCount = resolvedSegmentRecipientIds.length;
  const selectedFiltersRecipientCount = resolvedStatusRecipientIds.length;
  const selectedIndividualsCount = selectedIndividualIds.length;
  const unresolvedSelectedListCount = selectedListIds.filter((listId) => !listMembersById[listId]).length;

  const pendingRecipientIds = useMemo(() => Array.from(new Set([
    ...selectedIndividualIds,
    ...resolvedListRecipientIds,
    ...resolvedSegmentRecipientIds,
    ...resolvedStatusRecipientIds,
  ])), [resolvedListRecipientIds, resolvedSegmentRecipientIds, resolvedStatusRecipientIds, selectedIndividualIds]);

  const activeRecipientIds = useMemo(() => {
    if (selectedRecipientIds.length > 0) return selectedRecipientIds;
    if (constituentId) return [constituentId];
    return [];
  }, [constituentId, selectedRecipientIds]);

  const pickerIndividuals = useMemo(() => {
    const needle = pickerSearch.trim().toLowerCase();
    if (!needle) return constituents;
    return constituents.filter((row) => recipientSearchText(row).includes(needle));
  }, [constituents, pickerSearch]);

  async function toggleListSelection(listId: string) {
    const willSelect = !selectedListIds.includes(listId);
    setSelectedListIds((previous) => (willSelect ? [...previous, listId] : previous.filter((value) => value !== listId)));
    if (!willSelect || listMembersById[listId]) return;
    setPickerError(null);
    setPickerLoadingListId(listId);
    try {
      const detail = await apiFetch<RecipientListDetail>(`/api/email-campaigns/lists/${listId}`);
      setListMembersById((previous) => ({ ...previous, [listId]: detail.recipients ?? [] }));
    } catch (requestError) {
      setPickerError(errorMessage(requestError, "Failed to load list members."));
      setSelectedListIds((previous) => previous.filter((value) => value !== listId));
    } finally {
      setPickerLoadingListId(null);
    }
  }

  function toggleSelection(value: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((previous) => (previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]));
  }

  async function applyRecipientSelection(nextStep: 2 | 3 = 2) {
    setPickerError(null);
    let nextListMembersById = listMembersById;
    const missingListIds = selectedListIds.filter((listId) => !nextListMembersById[listId]);

    if (missingListIds.length > 0) {
      try {
        const loadedLists = await Promise.all(
          missingListIds.map(async (listId) => {
            const detail = await apiFetch<RecipientListDetail>(`/api/email-campaigns/lists/${listId}`);
            return [listId, detail.recipients ?? []] as const;
          }),
        );
        nextListMembersById = { ...nextListMembersById };
        for (const [listId, recipients] of loadedLists) {
          nextListMembersById[listId] = recipients;
        }
        setListMembersById(nextListMembersById);
      } catch (requestError) {
        setPickerError(errorMessage(requestError, "Failed to load one or more selected lists."));
        return;
      }
    }

    const resolvedListIds = new Set<string>();
    for (const listId of selectedListIds) {
      for (const recipient of nextListMembersById[listId] ?? []) {
        const mapped = emailToConstituentId.get(recipient.email.trim().toLowerCase());
        if (mapped) resolvedListIds.add(mapped);
      }
    }

    const finalIds = Array.from(new Set([
      ...selectedIndividualIds,
      ...Array.from(resolvedListIds),
      ...resolvedSegmentRecipientIds,
      ...resolvedStatusRecipientIds,
    ]));

    if (finalIds.length === 0) {
      setError("Select at least one recipient source before applying.");
      return;
    }

    setSelectedRecipientIds(finalIds);
    setConstituentId(finalIds.length === 1 ? finalIds[0] : "");
    setRecipientPickerOpen(false);
    setNotice(`${finalIds.length} recipients selected for generation.`);
    setWizardStep(nextStep);
  }

  async function proceedFromRecipientsStep() {
    const hasPickerSelection = selectedIndividualIds.length > 0 || selectedListIds.length > 0 || selectedTagNames.length > 0 || selectedDonorStatuses.length > 0;
    const hasAppliedSelection = selectedRecipientIds.length > 0 || Boolean(constituentId);
    if (!hasPickerSelection && !hasAppliedSelection) {
      setError("Select at least one recipient source before continuing.");
      return;
    }
    if (!hasPickerSelection) {
      if (constituentId && selectedRecipientIds.length === 0) {
        setSelectedRecipientIds([constituentId]);
      }
      setWizardStep(3);
      return;
    }
    await applyRecipientSelection(3);
  }

  useEffect(() => {
    return () => {
      if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl);
    };
  }, [pdfViewerUrl]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  function readPdfFileName(response: Response, fallback: string): string {
    const disposition = response.headers.get("content-disposition") ?? "";
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const quotedMatch = disposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) return quotedMatch[1];
    const plainMatch = disposition.match(/filename=([^;]+)/i);
    if (plainMatch?.[1]) return plainMatch[1].trim();
    return fallback;
  }

  async function requestPdfBlobUrl(endpoint: string, payload?: unknown, fallbackFileName = "generated-letter.pdf") {
    const response = await apiFetchResponse(endpoint, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      let message = `PDF export failed (${response.status}).`;
      try {
        const parsed = await response.json();
        if (parsed?.error?.message) message = String(parsed.error.message);
      } catch {
        // Keep default message when response is not JSON.
      }
      throw new Error(message);
    }

    const pdfBlob = await response.blob();
    if (pdfBlob.size === 0) {
      throw new Error("PDF export returned an empty file.");
    }
    return {
      objectUrl: URL.createObjectURL(pdfBlob),
      fileName: readPdfFileName(response, fallbackFileName),
    };
  }

  function buildDonationContextPayload() {
    const selectedDonationIds = temporaryRecipientList?.donationIds ?? [];
    return {
      donationMode,
      donationId: donationMode === "specific" ? donationId || undefined : undefined,
      donationIds: donationMode === "selected" ? selectedDonationIds : undefined,
      donationDateRange,
      donationType,
      donationMinimum: donationMinimum ? Number(donationMinimum) : undefined,
    };
  }

  function printCurrentPdf() {
    if (!pdfViewerUrl) return;
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setPdfError("Browser blocked the print preview window. Allow popups for this site and try Print again.");
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head><title>${escapeHtml(pdfViewerTitle)}</title></head>
        <body style="margin:0;background:#f1f5f9;">
          <iframe src="${pdfViewerUrl}#toolbar=1&navpanes=0&view=FitH" style="border:0;width:100vw;height:100vh;"></iframe>
          <script>
            window.addEventListener("load", function () {
              setTimeout(function () { window.focus(); window.print(); }, 650);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function openIndividualPdf(letterId: string) {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdf = await requestPdfBlobUrl(
        `/api/letters/generated/${encodeURIComponent(letterId)}/export-pdf?preview=1&inline=1`,
        undefined,
        `letter_${letterId}.pdf`,
      );
      setPdfViewerUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return pdf.objectUrl;
      });
      setPdfViewerFileName(pdf.fileName);
      setPdfViewerTitle("Individual Letter PDF");
      setPdfViewerOpen(true);
      setWizardStep(5);
    } catch (requestError) {
      setPdfError(errorMessage(requestError, "Failed to open individual PDF."));
    } finally {
      setPdfLoading(false);
    }
  }

  async function openBatchPdf(letterIds: string[]) {
    if (letterIds.length === 0) {
      setPdfError("No generated letters are available yet for batch PDF preview.");
      return;
    }
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdf = await requestPdfBlobUrl(
        "/api/letters/generated/export-pdf-batch?preview=1&inline=1",
        { letterIds },
        `letters_batch_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      setPdfViewerUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return pdf.objectUrl;
      });
      setPdfViewerFileName(pdf.fileName);
      setPdfViewerTitle(`Batch PDF (${letterIds.length} letters)`);
      setPdfViewerOpen(true);
      setWizardStep(5);
    } catch (requestError) {
      setPdfError(errorMessage(requestError, "Failed to open batch PDF."));
    } finally {
      setPdfLoading(false);
    }
  }

  async function loadProductionPreviewPdf(previewRecipientId: string) {
    setPreviewPdfLoading(true);
    setPreviewPdfError(null);
    try {
      const pdf = await requestPdfBlobUrl(
        "/api/letters/generated/preview-pdf?preview=1&inline=1",
        {
          templateId,
          constituentId: previewRecipientId,
          ...buildDonationContextPayload(),
          year: new Date().getFullYear(),
        },
        "letter-preview.pdf",
      );
      setPreviewPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return pdf.objectUrl;
      });
      setPreviewPdfFileName(pdf.fileName);
    } catch (requestError) {
      setPreviewPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setPreviewPdfError(errorMessage(requestError, "Failed to load production PDF preview."));
      console.warn("[OyamaLetters Preview Diagnostics] Production PDF preview failed.", {
        templateId,
        previewRecipientId,
        donationMode,
        donationId: donationMode === "specific" ? donationId || null : null,
        donationIds: donationMode === "selected" ? temporaryRecipientList?.donationIds ?? [] : [],
        donationDateRange,
        donationType,
        donationMinimum,
        error: errorMessage(requestError, "Failed to load production PDF preview."),
        mergedPreviewHtml: preview?.mergedPrintBody ?? "",
      });
    } finally {
      setPreviewPdfLoading(false);
    }
  }

  async function runPreview(targetRecipientId?: string) {
    if (!templateId) return setError("Choose a template first.");
    const previewRecipientId = targetRecipientId || constituentId || selectedRecipientIds[0] || pendingRecipientIds[0];
    if (!previewRecipientId) return setError("Pick at least one recipient before previewing.");
    setWorking(true);
    setError(null);
    try {
      const previewResult = await apiFetch<PreviewResult>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          constituentId: previewRecipientId,
          ...buildDonationContextPayload(),
          year: new Date().getFullYear(),
        }),
      });
      setPreview(previewResult);
      setConstituentId(previewRecipientId);
      await loadProductionPreviewPdf(previewRecipientId);
      setNotice(`Preview ready. Missing fields: ${previewResult.missingFields.length}. Unsupported fields: ${previewResult.unsupportedFields.length}.`);
      setWizardStep(4);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to preview letter."));
    } finally {
      setWorking(false);
    }
  }

  async function generateOne() {
    if (!templateId) return setError("Choose a template first.");
    if (selectedTemplate?.status !== "ACTIVE") {
      return setError("Only ACTIVE templates can be generated. Publish this template first.");
    }
    const targetRecipientId = constituentId || selectedRecipientIds[0] || pendingRecipientIds[0];
    if (!targetRecipientId) return setError("Pick at least one recipient before generating a letter.");
    setWorking(true);
    setError(null);
    try {
      await apiFetch<GeneratedLetterSummary>("/api/letters/generated", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          constituentId: targetRecipientId,
          deliveryTarget,
          ...buildDonationContextPayload(),
          year: new Date().getFullYear(),
        }),
      });
      if (deliveryTarget === "PRINT_QUEUE") {
        setNotice(workflowPolicy?.requirePrintApproval ? "Letter generated for print review." : "Letter generated and queued for print.");
      } else if (deliveryTarget === "MAIL_QUEUE") {
        setNotice("Letter generated and queued for mail workflow.");
      } else {
        setNotice("Letter generated.");
      }
      await load();
      setWizardStep(5);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to generate letter."));
    } finally {
      setWorking(false);
    }
  }

  async function runBatch(dryRun: boolean) {
    if (!templateId) return setError("Choose a template first.");
    if (!dryRun && selectedTemplate?.status !== "ACTIVE") {
      return setError("Only ACTIVE templates can be generated. Publish this template first.");
    }
    const runtimeRecipientIds = activeRecipientIds.length > 0 ? activeRecipientIds : pendingRecipientIds;
    setWorking(true);
    setError(null);
    try {
      const result = await apiFetch<BatchResult>("/api/letters/generated/batch", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          dryRun,
          constituentIds: runtimeRecipientIds.length > 0 ? runtimeRecipientIds : undefined,
          filterType: "ALL",
          deliveryTarget,
          ...buildDonationContextPayload(),
        }),
      });

      setBatch(result);
      setNotice(dryRun
        ? "Batch validation complete."
        : deliveryTarget === "MAIL_QUEUE"
          ? "Batch generated and queued for mail workflow."
          : deliveryTarget === "PRINT_QUEUE"
            ? workflowPolicy?.requirePrintApproval ? "Batch generated for print review." : "Batch generated and queued for print."
            : "Batch generated.");
      if (!dryRun) await load();
      setWizardStep(5);
    } catch (requestError) {
      setError(errorMessage(requestError, dryRun ? "Failed to validate batch." : "Failed to generate batch."));
    } finally {
      setWorking(false);
    }
  }

  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const previewHeaderDraft = buildImportedHeaderPreset(branding);
  const previewFooterDraft = buildImportedFooterPreset(branding);
  const selectedDirectRecipientId = constituentId || activeRecipientIds[0] || pendingRecipientIds[0] || "";
  const selectedConstituent = constituents.find((row) => row.id === selectedDirectRecipientId) ?? null;
  const effectiveRecipientIds = activeRecipientIds.length > 0 ? activeRecipientIds : pendingRecipientIds;
  const constituentById = new Map(constituents.map((row) => [row.id, row]));
  const sourceRecipients = effectiveRecipientIds
    .map((id) => constituentById.get(id))
    .filter((row): row is ConstituentLookup => Boolean(row));
  const searchedRecipients = sourceRecipients.filter((row) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return recipientSearchText(row, formatAddress(row)).includes(needle);
  });
  const missingRequired = sourceRecipients.filter((row) => !hasRecipientName(row)).length;
  const totalRecipients = sourceRecipients.length;
  const missingAddress = sourceRecipients.filter((row) => !hasAddress(row)).length;
  const suppressed = sourceRecipients.filter((row) => row.doNotMail).length;
  const validRecipients = sourceRecipients.filter((row) => hasAddress(row) && !row.doNotMail && hasRecipientName(row)).length;
  const donorStatusOptions = ["ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"];
  const filteredRecipients = searchedRecipients.filter((row) => {
    if (recipientTab === "missingAddress") return !hasAddress(row) && !row.doNotMail;
    if (recipientTab === "missingRequired") return !hasRecipientName(row);
    if (recipientTab === "suppressed") return Boolean(row.doNotMail);
    return true;
  });
  const recipientSearch = query.trim().toLowerCase();
  const recipientStepListRows = recipientLists.filter((row) => !recipientSearch || row.name.toLowerCase().includes(recipientSearch));
  const recipientStepSegmentRows = tagCatalog.filter((row) => !recipientSearch || row.name.toLowerCase().includes(recipientSearch));
  const recipientStepIndividualRows = constituents.filter((row) => !recipientSearch || recipientSearchText(row).includes(recipientSearch));
  const recipientStepFilterRows = donorStatusOptions
    .map((status) => ({
      status,
      count: constituents.filter((row) => (row.donorStatus ?? "").toUpperCase() === status).length,
    }))
    .filter((row) => !recipientSearch || row.status.toLowerCase().includes(recipientSearch));
  const selectedRecipientRows = sourceRecipients.slice(0, 8);
  const selectedSourceLabel = selectedTagNames.length > 0
    ? `Segment · ${selectedTagNames.slice(0, 2).join(" · ")}`
    : selectedListIds.length > 0
      ? `List · ${selectedListIds.length} list${selectedListIds.length === 1 ? "" : "s"}`
      : selectedDonorStatuses.length > 0
        ? `Filter · ${selectedDonorStatuses[0].replaceAll("_", " ")}`
        : selectedIndividualIds.length > 0
          ? "Individuals"
          : constituentId
            ? `${donationId ? "Donation donor" : "Selected donor"}${selectedConstituent ? ` · ${personName(selectedConstituent)}` : ""}`
            : selectedRecipientIds.length > 0
              ? `${selectedRecipientIds.length} selected recipient${selectedRecipientIds.length === 1 ? "" : "s"}`
              : "No source selected";
  const donationAmounts = donations
    .map((item) => Number(item.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const averageDonationAmount = donationAmounts.length > 0
    ? donationAmounts.reduce((sum, amount) => sum + amount, 0) / donationAmounts.length
    : 0;
  const mostRecentDonation = donations
    .map((item) => ({ item, date: new Date(item.date) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.item;
  const donationApplicationLabel = donationMode === "none"
    ? "No donation information"
    : donationMode === "specific"
      ? "Specific donation (all recipients)"
      : donationMode === "selected"
        ? `Selected donations (per recipient)${temporaryRecipientList?.donationIds?.length ? ` · ${temporaryRecipientList.donationIds.length} gift${temporaryRecipientList.donationIds.length === 1 ? "" : "s"}` : ""}`
        : "Most recent donation (per recipient)";
  const qualifyingDonationRecipients = donationMode === "none" ? 0 : totalRecipients;
  const generatedForTemplate = generated.filter((row) => row.templateId === templateId);
  const generatedForAudience = activeRecipientIds.length > 0
    ? generatedForTemplate.filter((row) => (row.constituentId ? activeRecipientIds.includes(row.constituentId) : false))
    : generatedForTemplate;
  const batchPdfIds = (
    batch?.generatedIds
    ?? batch?.generated?.map((sample) => sample.id)
    ?? batch?.generatedSample?.map((sample) => sample.id)
    ?? generatedForAudience.map((row) => row.id)
  ).filter(Boolean).slice(0, 100);
  const focusedGenerated = generatedForAudience.find((row) => row.constituentId === (constituentId || activeRecipientIds[0]))
    ?? generatedForAudience[0]
    ?? generatedForTemplate[0]
    ?? null;
  const hasRecipientIntent = selectedIndividualIds.length > 0
    || selectedListIds.length > 0
    || selectedTagNames.length > 0
    || selectedDonorStatuses.length > 0
    || pendingRecipientIds.length > 0
    || activeRecipientIds.length > 0;
  const canOpenRecipientsStep = Boolean(templateId);
  const canAdvanceFromSelection = Boolean(templateId && hasRecipientIntent);
  const canOpenFinalStep = generatedForTemplate.length > 0;
  const generationBlockedByTemplate = selectedTemplate ? selectedTemplate.status !== "ACTIVE" : false;
  const previewRecipientPool = sourceRecipients.length > 0 ? sourceRecipients : constituents;
  const previewFocusId = constituentId || previewRecipientPool[0]?.id || "";
  const previewFocusIndex = Math.max(previewRecipientPool.findIndex((row) => row.id === previewFocusId), 0);
  const previewFocus = previewRecipientPool[previewFocusIndex] ?? null;
  const previewMissingFieldCount = preview?.missingFields?.length ?? 0;
  const previewUnsupportedFieldCount = preview?.unsupportedFields?.length ?? 0;
  const deliveryLabel = deliveryTarget === "MAIL_QUEUE"
    ? "Mail Queue"
    : deliveryTarget === "PRINT_QUEUE"
      ? workflowPolicy?.requirePrintApproval ? "Print Review Queue" : "Print Queue"
      : "PDF Only";
  const mailQueueUnavailable = workflowPolicy ? !workflowPolicy.allowDirectMailQueue : false;
  const queuePolicyMessage = mailQueueUnavailable
    ? "Direct mail queue is disabled by workflow policy. Generate to PDF or print review first."
    : workflowPolicy?.requirePrintApproval
      ? "Print queue generation starts in Needs Review until approved."
      : "Print queue generation is queued for print immediately.";
  const selectedSegmentSummary = selectedTagNames.length > 0 ? selectedTagNames.slice(0, 2).join(", ") : "No segment";
  const wizardSteps: Array<{ id: 1 | 2 | 3 | 4 | 5; title: string; helper: string }> = [
    { id: 1, title: "Select", helper: "Template and options configured" },
    { id: 2, title: "Recipients", helper: "Choose recipients and review count" },
    { id: 3, title: "Donation Context", helper: "Add donation information (optional)" },
    { id: 4, title: "Preview", helper: "Review sample letter and batch summary" },
    { id: 5, title: "Generate", helper: "Confirm and generate letters" },
  ];

  function cyclePreviewRecipient(direction: "prev" | "next") {
    if (previewRecipientPool.length === 0) return;
    const delta = direction === "next" ? 1 : -1;
    const raw = previewFocusIndex + delta;
    const nextIndex = (raw + previewRecipientPool.length) % previewRecipientPool.length;
    const target = previewRecipientPool[nextIndex];
    if (!target) return;
    setConstituentId(target.id);
    if (wizardStep === 4) {
      void runPreview(target.id);
    }
  }

  const topNextLabel = wizardStep === 1
    ? "Start Generation"
    : wizardStep === 2
      ? "Next: Donation Context"
      : wizardStep === 3
        ? "Next: Preview"
        : wizardStep === 4
          ? "Next: Generate"
          : generateMode === "single"
            ? "Generate One"
            : "Generate Batch";
  const backLabel = wizardStep === 1
    ? "Back to Template Library"
    : wizardStep === 2
      ? "Back: Select"
      : wizardStep === 3
        ? "Back: Recipients"
        : wizardStep === 4
          ? "Back: Donation Context"
          : "Back: Preview";
  const topNextDisabled = wizardStep === 1
    ? !canOpenRecipientsStep
    : wizardStep === 2
      ? !canAdvanceFromSelection
      : wizardStep === 3
        ? !canAdvanceFromSelection
        : wizardStep === 4
          ? !canOpenFinalStep
          : working || !canAdvanceFromSelection || generationBlockedByTemplate || (deliveryTarget === "MAIL_QUEUE" && mailQueueUnavailable);

  function handleWorkflowBack() {
    if (wizardStep === 1) {
      window.location.assign("/oyama-letters");
      return;
    }
    setWizardStep((wizardStep - 1) as 1 | 2 | 3 | 4 | 5);
  }

  function handleTopNext() {
    if (wizardStep === 1) {
      if (!canOpenRecipientsStep) {
        setError("Choose a template first.");
        return;
      }
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      void proceedFromRecipientsStep();
      return;
    }
    if (wizardStep === 3) {
      void runPreview();
      return;
    }
    if (wizardStep === 4) {
      setWizardStep(5);
      return;
    }
    if (generateMode === "single") {
      void generateOne();
      return;
    }
    void runBatch(false);
  }

  if (loading) return <LoadingPage label="Loading generation workspace..." />;

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fa]">
      <PageHero
        title="Generate Letters"
        subtitle="Create and deliver personalized letters in a few simple steps."
        tooltip="Generation creates a live batch from one reusable template plus one recipient selection. Preview and queue actions in this workspace do not rewrite the underlying template."
      >
        <div className="w-full max-w-4xl">
          <WorkflowActionBar
            backLabel={backLabel}
            onBack={handleWorkflowBack}
            nextLabel={topNextLabel}
            onNext={handleTopNext}
            nextDisabled={topNextDisabled}
            secondaryAction={<Button onClick={() => setNotice("Generation setup saved as draft for this session.")}>Save session draft</Button>}
          />
        </div>
      </PageHero>
      {error ? <Alert tone="amber">{error}</Alert> : null}
      {notice ? <Alert tone="green">{notice}</Alert> : null}
      <section className="border-b border-slate-200 bg-white px-4 xl:px-6">
        <div className="grid gap-2 py-4 sm:grid-cols-2 xl:grid-cols-5">
          {wizardSteps.map((step, index) => {
            const active = wizardStep === step.id;
            const completed = wizardStep > step.id;
            const allowed = step.id === 1
              || (step.id === 2 && canOpenRecipientsStep)
              || (step.id > 2 && step.id < 5 && canAdvanceFromSelection)
              || (step.id === 5 && canOpenFinalStep);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => (allowed ? setWizardStep(step.id) : undefined)}
                disabled={!allowed}
                className="group rounded-md border border-transparent px-2 py-2 text-left transition hover:border-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className={[
                    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-base font-semibold",
                    completed
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : active
                        ? "border-emerald-600 bg-white text-emerald-800"
                        : "border-slate-300 text-slate-500",
                  ].join(" ")}>
                    {completed ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M6 12.5l3.5 3.5L18 7.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : step.id}
                  </span>
                  {index < wizardSteps.length - 1 ? <span className="inline-flex text-lg text-slate-300">→</span> : null}
                  <span>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="text-xs text-slate-600">{step.helper}</p>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {wizardStep === 1 ? (
        <section className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_500px] xl:p-5">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <WorkspaceHint title="Step 1 Guidance" tone="slate">
              Pick the reusable template first, then decide whether this run is for one recipient, a temporary donation list, or a broader batch. Donation context is optional and only needed when the letter references gift details.
            </WorkspaceHint>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Select Your Options</h2>
              <p className="text-sm text-slate-600">Choose the template, recipients, and context for your letters.</p>
            </div>
            {temporaryRecipientList ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-950">{temporaryRecipientList.name}</p>
                <p className="mt-1 text-xs text-emerald-800">
                  Temporary list loaded from selected donations with {temporaryRecipientList.constituentIds.length} unique donor{temporaryRecipientList.constituentIds.length === 1 ? "" : "s"}
                  {temporaryRecipientList.donationIds?.length ? ` and ${temporaryRecipientList.donationIds.length} selected gift${temporaryRecipientList.donationIds.length === 1 ? "" : "s"}` : ""}. Choose a template, then continue to review recipients.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><LettersPackIcon name="template-library" className="h-5 w-5" fallback="T" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Template</p>
                    <p className="text-sm text-slate-700">{selectedTemplate?.name || "No template selected"}</p>
                    <p className="text-xs text-slate-500">{selectedTemplate ? `${selectedTemplate.category.replaceAll("_", " ")} · ${selectedTemplate.status}` : "Choose a published template"}</p>
                  </div>
                </div>
                <div className="w-44">
                  <LabeledSelect label="" value={templateId} onChange={setTemplateId} options={templates.map((item) => item.id)} labels={Object.fromEntries(templates.map((item) => [item.id, `${item.name} (${item.status})`]))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><LettersPackIcon name="recipient-list" className="h-5 w-5" fallback="R" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Recipients</p>
                    <p className="text-sm text-slate-700">{pendingRecipientIds.length || activeRecipientIds.length} recipients selected</p>
                    <p className="text-xs text-slate-500">Segment: {selectedSegmentSummary || "None"}</p>
                  </div>
                </div>
                <Button onClick={() => setWizardStep(2)}>Edit</Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><LettersPackIcon name="approval-review" className="h-5 w-5" fallback="$" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Donation Context</p>
                    <p className="text-sm text-slate-700">{donationMode === "specific" && donationId ? formatDonation(donations.find((item) => item.id === donationId) ?? { id: donationId, amount: "-", date: new Date().toISOString() }) : donationApplicationLabel}</p>
                    <p className="text-xs text-slate-500">Date range: {donationDateRange.toLowerCase()}</p>
                  </div>
                </div>
                <div className="w-52">
                  <LabeledSelect label="" value={donationId} onChange={setDonationId} options={["", ...donations.map((item) => item.id)]} labels={Object.fromEntries(donations.map((item) => [item.id, formatDonation(item)]))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><LettersPackIcon name="print-queue" className="h-5 w-5" fallback="Q" /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Delivery</p>
                    <p className="text-sm text-slate-700">{deliveryLabel}</p>
                    <p className="text-xs text-slate-500">{queuePolicyMessage}</p>
                  </div>
                </div>
                <Button onClick={() => setWizardStep(5)}>Edit</Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Batch Summary</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <SummaryNumber label="Total Recipients" value={String(totalRecipients)} tone="green" />
                <SummaryNumber label="Valid" value={String(validRecipients)} tone="green" />
                <SummaryNumber label="Missing Address" value={String(missingAddress)} tone="red" />
                <SummaryNumber label="Missing Required" value={String(missingRequired)} tone="red" />
                <SummaryNumber label="Suppressed" value={String(suppressed)} tone="red" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setWizardStep(2)} tone="primary" disabled={!canOpenRecipientsStep}>Next: Recipients</Button>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Sample Letter Preview</p>
                <p className="text-sm text-slate-600">This is a preview of how your letter will look.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => cyclePreviewRecipient("prev")} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700">‹</button>
                <span className="inline-flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">{previewFocus ? personName(previewFocus) : "No recipient"}</span>
                <button type="button" onClick={() => cyclePreviewRecipient("next")} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700">›</button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[#f3f5f8] p-3">
              <div className="mx-auto min-h-[520px] max-w-[330px] bg-white px-8 py-7 text-[10px] leading-5 shadow-sm ring-1 ring-slate-200">
                <LetterPreviewHeader branding={branding} header={previewHeaderDraft} />
                <MiniDocument html={preview?.mergedPrintBody || ""} emptyText="Run review preview in Step 2 to load merged output." showLetterhead={false} />
                <LetterPreviewFooter branding={branding} footer={previewFooterDraft} />
              </div>
            </div>
              <Button onClick={() => setWizardStep(2)} disabled={!canOpenRecipientsStep}>Edit Recipient Selection</Button>
          </aside>
        </section>
      ) : null}

      {wizardStep === 2 ? (
        <section className="grid gap-4 px-3 pb-5 pt-3 xl:grid-cols-[minmax(0,1fr)_430px] xl:px-5">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Select Recipients</h2>
              <p className="text-sm text-slate-600">Choose the audience you would like to send letters to. Lists and segments are best for batches. Individuals are best for one-off letters and spot checks.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">How to use this step</p>
              <p className="mt-1">Start with the source that already matches your real workflow. If you came from selected donations, the temporary list is already loaded. If not, choose a list, segment, donor-status filter, or individual recipients below.</p>
            </div>
            <div className="flex gap-5 border-b border-slate-200">
              {([
                ["lists", "Lists"],
                ["segments", "Segments"],
                ["filters", "Filters"],
                ["individuals", "Individuals"],
              ] as const).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setRecipientStepTab(tabKey)}
                  className={[
                    "h-10 border-b-2 text-sm font-semibold",
                    recipientStepTab === tabKey ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
              <span className="font-semibold">{recipientStepTab === "lists" ? "Lists" : recipientStepTab === "segments" ? "Segments" : recipientStepTab === "filters" ? "Filters" : "Individuals"}:</span>{" "}
              {recipientStepTab === "lists"
                ? "Use a saved audience when this batch should be repeatable."
                : recipientStepTab === "segments"
                  ? "Use tags when staff already curates donor groups in CRM."
                  : recipientStepTab === "filters"
                    ? "Use donor status when you need a broad operational filter."
                    : "Search and check specific constituents for one-off or temporary sends."}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchBox value={query} onChange={setQuery} placeholder={recipientStepTab === "individuals" ? "Search recipients by name, email, or address..." : "Search recipients..."} />
              <Button onClick={() => void load()}>Refresh</Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="w-12 px-3 py-2" />
                    <th className="px-3 py-2">{recipientStepTab === "individuals" ? "Recipient" : recipientStepTab === "filters" ? "Filter" : recipientStepTab === "lists" ? "List Name" : "Segment Name"}</th>
                    <th className="w-28 px-3 py-2 text-right">Recipients</th>
                    <th className="w-28 px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recipientStepTab === "lists" ? recipientStepListRows.map((row) => {
                    const members = listMembersById[row.id] ?? [];
                    const matched = members
                      .map((member) => emailToConstituentId.get(member.email.trim().toLowerCase()))
                      .filter((value): value is string => Boolean(value));
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2"><input type="checkbox" checked={selectedListIds.includes(row.id)} onChange={() => void toggleListSelection(row.id)} /></td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">{row.description || "Saved list"}</p>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{row.recipientsCount}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = matched[0];
                              if (targetId) setConstituentId(targetId);
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            disabled={matched.length === 0}
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    );
                  }) : null}

                  {recipientStepTab === "segments" ? recipientStepSegmentRows.map((row) => {
                    const previewCandidate = constituents.find((item) => (item.tags ?? []).some((entry) => (entry.tag?.name ?? "").toLowerCase() === row.name.toLowerCase()));
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2"><input type="checkbox" checked={selectedTagNames.includes(row.name)} onChange={() => toggleSelection(row.name, setSelectedTagNames)} /></td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">Tag-based segment</p>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{row.constituentsCount ?? 0}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => previewCandidate ? setConstituentId(previewCandidate.id) : undefined} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={!previewCandidate}>Preview</button>
                        </td>
                      </tr>
                    );
                  }) : null}

                  {recipientStepTab === "filters" ? recipientStepFilterRows.map((row) => {
                    const previewCandidate = constituents.find((item) => (item.donorStatus ?? "").toUpperCase() === row.status);
                    return (
                      <tr key={row.status}>
                        <td className="px-3 py-2"><input type="checkbox" checked={selectedDonorStatuses.includes(row.status)} onChange={() => toggleSelection(row.status, setSelectedDonorStatuses)} /></td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{row.status.replaceAll("_", " ")}</p>
                          <p className="text-xs text-slate-500">Donor status filter</p>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{row.count}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => previewCandidate ? setConstituentId(previewCandidate.id) : undefined} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={!previewCandidate}>Preview</button>
                        </td>
                      </tr>
                    );
                  }) : null}

                  {recipientStepTab === "individuals" ? recipientStepIndividualRows.slice(0, 120).map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedIndividualIds.includes(row.id)} onChange={() => toggleSelection(row.id, setSelectedIndividualIds)} /></td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900">{personName(row)}</p>
                        <p className="text-xs text-slate-500">{row.email || "No email"}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">1</td>
                      <td className="px-3 py-2 text-right"><button type="button" onClick={() => setConstituentId(row.id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Preview</button></td>
                    </tr>
                  )) : null}

                  {((recipientStepTab === "lists" && recipientStepListRows.length === 0)
                    || (recipientStepTab === "segments" && recipientStepSegmentRows.length === 0)
                    || (recipientStepTab === "filters" && recipientStepFilterRows.length === 0)
                    || (recipientStepTab === "individuals" && recipientStepIndividualRows.length === 0)) ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No rows found for this tab.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-700">{pendingRecipientIds.length || activeRecipientIds.length} selected</p>
              <button
                type="button"
                className="font-semibold text-emerald-700"
                onClick={() => {
                  setSelectedRecipientIds([]);
                  setSelectedIndividualIds([]);
                  setSelectedListIds([]);
                  setSelectedTagNames([]);
                  setSelectedDonorStatuses([]);
                  setConstituentId("");
                }}
              >
                Clear Selection
              </button>
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3">
              <Button onClick={() => setWizardStep(1)}>Back: Select Options</Button>
              <div className="flex items-center gap-2">
                <Button onClick={() => setRecipientPickerOpen(true)}>Advanced Source Selector</Button>
                <Button onClick={() => void proceedFromRecipientsStep()} tone="primary" disabled={!canAdvanceFromSelection}>Next: Donation Context</Button>
              </div>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Recipient Summary</h3>
              <p className="text-sm text-slate-600">Review your selected recipients.</p>
            </div>

            <div className="rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 border-b border-slate-200">
                <div className="p-3">
                  <p className="text-xs text-slate-500">Total Selected</p>
                  <p className="text-4xl font-semibold text-emerald-800">{pendingRecipientIds.length || activeRecipientIds.length}</p>
                  <p className="text-xs text-slate-500">recipients</p>
                </div>
                <div className="border-l border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Source</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedSourceLabel}</p>
                </div>
              </div>
              <SummaryStatusRow label="Valid Recipients" count={validRecipients} tone="green" />
              <SummaryStatusRow label="Missing Address" count={missingAddress} tone="orange" />
              <SummaryStatusRow label="Missing Required Data" count={missingRequired} tone="red" />
              <SummaryStatusRow label="Suppressed" count={suppressed} tone="slate" />
            </div>

            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2">
                <p className="font-semibold text-slate-900">Selected Recipients ({sourceRecipients.length})</p>
              </div>
              <div className="max-h-[300px] overflow-auto px-3 py-2">
                {selectedRecipientRows.length === 0 ? <p className="text-sm text-slate-500">No selected recipients yet.</p> : (
                  <ul className="space-y-2">
                    {selectedRecipientRows.map((row) => (
                      <li key={row.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{personName(row)}</span>
                        <span className="text-xs text-slate-600">{formatAddress(row) || "No address"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Button onClick={() => setRecipientPickerOpen(true)} disabled={false}>Preview Recipient List</Button>
          </aside>
        </section>
      ) : null}

      {wizardStep === 3 ? (
        <section className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_530px] xl:p-5">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Donation Context (Optional)</h2>
              <p className="text-sm text-slate-600">Select donation information to include in this letter. If left blank, donation fields in the template will be hidden.</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">Donation Selection</p>
              <div className="mt-3 space-y-3 text-sm">
                {temporaryRecipientList?.donationIds?.length ? (
                  <label className="flex items-start gap-3">
                    <input type="radio" checked={donationMode === "selected"} onChange={() => setDonationMode("selected")} className="mt-1" />
                    <span>
                      <span className="font-semibold text-slate-900">Use the selected donations from this run</span>
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Recommended</span>
                      <span className="mt-1 block text-xs text-slate-600">Matches each recipient to the gift rows selected before opening OyamaLetters.</span>
                    </span>
                  </label>
                ) : null}
                <label className="flex items-start gap-3">
                  <input type="radio" checked={donationMode === "recent"} onChange={() => setDonationMode("recent")} className="mt-1" />
                  <span>
                    <span className="font-semibold text-slate-900">Use each recipient's most recent donation</span>
                    {!temporaryRecipientList?.donationIds?.length ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Recommended</span> : null}
                    <span className="mt-1 block text-xs text-slate-600">Automatically pulls the most recent qualifying donation for each recipient.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="radio" checked={donationMode === "specific"} onChange={() => setDonationMode("specific")} className="mt-1" />
                  <span>
                    <span className="font-semibold text-slate-900">Use a specific donation</span>
                    <span className="mt-1 block text-xs text-slate-600">Use the same donation for all recipients.</span>
                  </span>
                </label>
                {donationMode === "specific" ? (
                  <div className="pl-6">
                    <LabeledSelect label="Donation" value={donationId} onChange={setDonationId} options={["", ...donations.map((item) => item.id)]} labels={Object.fromEntries(donations.map((item) => [item.id, formatDonation(item)]))} />
                  </div>
                ) : null}
                <label className="flex items-start gap-3">
                  <input type="radio" checked={donationMode === "none"} onChange={() => setDonationMode("none")} className="mt-1" />
                  <span>
                    <span className="font-semibold text-slate-900">No donation information</span>
                    <span className="mt-1 block text-xs text-slate-600">Generate letters without donation details.</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Filters (optional)</p>
              <p className="text-xs text-slate-600">Refine which donation is used.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <LabeledSelect label="Date Range" value={donationDateRange} onChange={setDonationDateRange} options={["Last 30 days", "Last 90 days", "Last 12 months", "All time"]} />
                <LabeledSelect label="Donation Type" value={donationType} onChange={setDonationType} options={["All Types", "One-Time", "Recurring", "Major Gift"]} />
                <label className="block text-xs font-semibold text-slate-700">
                  Minimum Amount (optional)
                  <input value={donationMinimum} onChange={(event) => setDonationMinimum(event.target.value)} placeholder="e.g. 25.00" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" />
                </label>
              </div>
            </div>

            <button type="button" onClick={() => setDonationAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700">
              <span>Advanced Options (deduplication, exclusions, limits)</span>
              <span>{donationAdvancedOpen ? "−" : "+"}</span>
            </button>
            {donationAdvancedOpen ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Advanced constraints are available in the full recipient source selector.</p> : null}

            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <LettersPackIcon name="approval-review" className="h-4 w-4" fallback="i" />
                <span className="font-semibold text-emerald-900">Your template includes donation fields</span>
              </div>
              <Button onClick={() => setWizardStep(4)}>View Template Fields</Button>
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3">
              <Button onClick={() => setWizardStep(2)}>Back: Recipients</Button>
              <Button onClick={() => void runPreview()} tone="primary" disabled={working || !canAdvanceFromSelection}>Next: Preview</Button>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Donation Summary</h3>
              <p className="text-sm text-slate-600">Preview of how donation data will be applied.</p>
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 border-b border-slate-200">
                <div className="p-3">
                  <p className="text-xs text-slate-500">Application</p>
                  <p className="text-sm font-semibold text-slate-900">{donationApplicationLabel}</p>
                </div>
                <div className="border-l border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Date Range</p>
                  <p className="text-sm font-semibold text-slate-900">{donationDateRange}</p>
                </div>
              </div>
              <SummaryStatusRow label="Recipients" count={totalRecipients} tone="slate" />
              <SummaryStatusRow label="Recipients with qualifying donations" count={qualifyingDonationRecipients} tone="green" />
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">Average Donation Amount</span>
                <span className="font-semibold text-slate-900">{averageDonationAmount > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(averageDonationAmount) : "-"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">Most Recent Donation Date</span>
                <span className="font-semibold text-slate-900">{mostRecentDonation ? donationDateLabel(mostRecentDonation) : "-"}</span>
              </div>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              During preview, you'll be able to see the donation details for each recipient before generating.
            </div>
          </aside>
        </section>
      ) : null}

      {wizardStep === 4 ? (
        <section className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_620px] xl:p-5">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Batch Summary</h3>
              <p className="text-sm text-slate-600">Review your batch details before generating.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <SummaryNumber label="Total Recipients" value={String(totalRecipients)} tone="green" />
                <SummaryNumber label="Valid" value={String(validRecipients)} tone="green" />
                <SummaryNumber label="Missing Address" value={String(missingAddress)} tone="red" />
                <SummaryNumber label="Missing Required Data" value={String(missingRequired)} tone="red" />
              </div>
              <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Template</span><span className="text-slate-900">{selectedTemplate?.name || "-"}</span></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Recipient Source</span><span className="text-slate-900">{selectedSourceLabel}</span></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Donation Context</span><span className="text-slate-900">{donationApplicationLabel}</span></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Delivery</span><span className="text-slate-900">{deliveryLabel}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setWizardStep(1)}>Edit Selections</Button>
                <Button onClick={() => void runPreview()} disabled={working || !canAdvanceFromSelection}>Refresh Preview</Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Data Check</h3>
              <p className="text-sm text-slate-600">Ensure your data is ready for generation.</p>
              <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200">
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Merge Resolution</span><StatusPill label={previewMissingFieldCount === 0 && previewUnsupportedFieldCount === 0 ? "Passed" : `Missing ${previewMissingFieldCount} · Unsupported ${previewUnsupportedFieldCount}`} tone={previewMissingFieldCount === 0 && previewUnsupportedFieldCount === 0 ? "green" : "red"} /></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Recipient Required Fields</span><StatusPill label={missingRequired === 0 ? "Passed" : "Needs Attention"} tone={missingRequired === 0 ? "green" : "red"} /></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Addresses</span><StatusPill label={missingAddress === 0 ? "Passed" : "Needs Attention"} tone={missingAddress === 0 ? "green" : "orange"} /></div>
                <div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">Suppression</span><StatusPill label={suppressed === 0 ? "Passed" : "Needs Attention"} tone={suppressed === 0 ? "green" : "red"} /></div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <Button onClick={() => setWizardStep(3)}>Back: Donation Context</Button>
              <Button onClick={() => setWizardStep(5)} tone="primary">Next: Generate</Button>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Production PDF Preview</h3>
                <p className="text-sm text-slate-600">Server-rendered preview using the same PDF path as generated letters.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => cyclePreviewRecipient("prev")} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700">‹</button>
                <span className="inline-flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">{previewFocus ? `${personName(previewFocus)} (${previewFocusIndex + 1} of ${previewRecipientPool.length})` : "No recipient"}</span>
                <button type="button" onClick={() => cyclePreviewRecipient("next")} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700">›</button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[#f3f5f8] p-3">
              {previewPdfLoading ? (
                <div className="flex min-h-[520px] items-center justify-center rounded border border-slate-200 bg-white text-sm font-semibold text-slate-600">
                  Rendering server PDF preview...
                </div>
              ) : null}
              {!previewPdfLoading && previewPdfUrl ? (
                <object
                  title="Production letter PDF preview"
                  data={`${previewPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                  type="application/pdf"
                  className="h-[620px] w-full rounded border border-slate-200 bg-white"
                >
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Inline PDF preview is unavailable in this browser. Use the buttons below to open or save the server-rendered preview.
                  </div>
                </object>
              ) : null}
              {!previewPdfLoading && !previewPdfUrl ? (
                <div className="mx-auto min-h-[520px] max-w-[330px] bg-white px-8 py-7 text-[10px] leading-5 shadow-sm ring-1 ring-slate-200">
                  {previewPdfError ? <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{previewPdfError}</p> : null}
                  <LetterPreviewHeader branding={branding} header={previewHeaderDraft} />
                  <MiniDocument html={preview?.mergedPrintBody || ""} emptyText="Run preview to render the letter sample." showLetterhead={false} />
                  <LetterPreviewFooter branding={branding} footer={previewFooterDraft} />
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {previewPdfUrl ? (
                <a href={previewPdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Open Server Preview</a>
              ) : (
                <Button onClick={() => previewFocus ? void loadProductionPreviewPdf(previewFocus.id) : undefined} disabled={!previewFocus || previewPdfLoading}>{previewPdfLoading ? "Rendering..." : "Render Server Preview"}</Button>
              )}
              {previewPdfUrl ? (
                <a href={previewPdfUrl} download={previewPdfFileName} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Save Preview PDF</a>
              ) : (
                <Button onClick={() => void openIndividualPdf(focusedGenerated?.id || "")} disabled={!focusedGenerated || pdfLoading}>Open Generated PDF</Button>
              )}
            </div>
          </aside>
        </section>
      ) : null}

      {wizardStep === 5 ? (
        <section className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_420px] xl:p-5">
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Generate Letters</p>
              <p className="mt-1 text-xs text-slate-600">Confirm settings, generate letters, and open PDFs without leaving this page.</p>
              {generationBlockedByTemplate ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Selected template is {selectedTemplate?.status ?? "not active"}. Only ACTIVE templates can generate production letters.
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Mode</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setGenerateMode("single")} className={["rounded border px-2 py-1 text-xs font-semibold", generateMode === "single" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>Single</button>
                    <button type="button" onClick={() => setGenerateMode("batch")} className={["rounded border px-2 py-1 text-xs font-semibold", generateMode === "batch" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>Batch</button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Delivery Target</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setDeliveryTarget("PDF_ONLY")} className={["rounded border px-2 py-1 text-xs font-semibold", deliveryTarget === "PDF_ONLY" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>PDF Only</button>
                    <button type="button" onClick={() => setDeliveryTarget("PRINT_QUEUE")} className={["rounded border px-2 py-1 text-xs font-semibold", deliveryTarget === "PRINT_QUEUE" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>Print Queue</button>
                    <button type="button" onClick={() => setDeliveryTarget("MAIL_QUEUE")} disabled={mailQueueUnavailable} title={mailQueueUnavailable ? queuePolicyMessage : undefined} className={["rounded border px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50", deliveryTarget === "MAIL_QUEUE" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>Mail Queue</button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{queuePolicyMessage}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => (generateMode === "single" ? void generateOne() : void runBatch(false))}
                  tone="primary"
                  disabled={working || !canAdvanceFromSelection || generationBlockedByTemplate || (deliveryTarget === "MAIL_QUEUE" && mailQueueUnavailable)}
                >
                  {generateMode === "single" ? "Generate One Letter" : "Generate Batch"}
                </Button>
                {generateMode === "batch" ? <Button onClick={() => void runBatch(true)} disabled={working || !canAdvanceFromSelection}>Validate Batch</Button> : null}
                <Button onClick={() => void openBatchPdf(batchPdfIds)} disabled={pdfLoading || batchPdfIds.length === 0}>View Batch PDF</Button>
                <Button onClick={() => (focusedGenerated ? void openIndividualPdf(focusedGenerated.id) : undefined)} disabled={pdfLoading || !focusedGenerated}>View Individual PDF</Button>
                <Button onClick={() => void load()}>Refresh Generated</Button>
                <Button href="/oyama-letters/queue">Continue to Queue</Button>
                <Button onClick={() => setWizardStep(1)}>Start New Run</Button>
              </div>
              {batch ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryNumber label="Generated" value={String(batch.generatedCount ?? 0)} tone="green" />
                    <SummaryNumber label="Skipped" value={String(batch.skippedCount ?? batch.skipped?.length ?? 0)} tone={(batch.skippedCount ?? batch.skipped?.length ?? 0) > 0 ? "red" : "green"} />
                    <SummaryNumber label="Eligible" value={String(batch.eligible ?? 0)} tone="slate" />
                  </div>
                  {batch.skippedByReason && Object.keys(batch.skippedByReason).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {Object.entries(batch.skippedByReason).map(([reason, count]) => (
                        <span key={reason} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800">{reason}: {count}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">PDF Viewer</p>
                  <p className="mt-1 text-xs text-slate-600">
                    PDFs are rendered on the server with the current Letters branding, then opened here for saving and printing.
                  </p>
                </div>
                {pdfLoading ? <StatusPill label="Loading PDF" tone="orange" /> : null}
              </div>
              {pdfError ? <div className="mt-3"><Alert tone="amber">{pdfError}</Alert></div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void openBatchPdf(batchPdfIds)} disabled={pdfLoading || batchPdfIds.length === 0}>Generate Server Batch PDF</Button>
                <Button onClick={() => (focusedGenerated ? void openIndividualPdf(focusedGenerated.id) : undefined)} disabled={pdfLoading || !focusedGenerated}>Generate Server Individual PDF</Button>
                {pdfViewerUrl ? <Button onClick={() => setPdfViewerOpen(true)}>Reopen Last PDF</Button> : null}
              </div>
            </div>
          </div>
          <aside className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="font-semibold text-slate-900">Generated Letters ({generatedForTemplate.length})</p>
              <p className="text-xs text-slate-600">Most recent letters for the current template.</p>
            </div>
            <div className="max-h-[980px] overflow-auto">
              {generatedForTemplate.length === 0 ? (
                <p className="p-4 text-sm text-slate-600">No generated letters yet for this template.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Generated</th><th className="px-3 py-2">PDF</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {generatedForTemplate.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{row.constituent ? personName(row.constituent) : "Unknown recipient"}</p>
                          <p className="text-xs text-slate-600">{row.constituent?.email || "No email"}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{formatDate(row.generatedAt)}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => void openIndividualPdf(row.id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={pdfLoading}>View PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </section>
      ) : null}

      {pdfViewerOpen && pdfViewerUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close PDF viewer"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setPdfViewerOpen(false)}
          />
          <div className="relative z-10 flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{pdfViewerTitle}</p>
                <p className="truncate text-xs text-slate-600">{pdfViewerFileName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={pdfViewerUrl}
                  download={pdfViewerFileName}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Save PDF
                </a>
                <Button onClick={printCurrentPdf}>Print</Button>
                <Button onClick={() => setPdfViewerOpen(false)}>Close</Button>
              </div>
            </div>
            <object
              id="oyama-letters-pdf-viewer"
              aria-label="Generated PDF"
              title="Generated PDF"
              data={`${pdfViewerUrl}#toolbar=1&navpanes=0&view=FitH`}
              type="application/pdf"
              className="min-h-0 flex-1 bg-slate-100"
            >
              <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                This browser is not rendering the PDF inline. Use Print to open the print preview window or Save PDF to download it.
              </div>
            </object>
          </div>
        </div>
      ) : null}

      {recipientPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 xl:p-8">
          <button
            type="button"
            aria-label="Close recipient selector"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setRecipientPickerOpen(false)}
          />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Recipient Source Selector</p>
                <p className="text-sm text-slate-600">Choose individuals, saved lists, tag segments, and filters to build your generation audience.</p>
                <p className="mt-2 text-xs text-slate-600">
                  Selected segments: <span className="font-semibold text-slate-800">{selectedTagNames.length}</span>
                  {" · "}
                  Recipients selected to send: <span className="font-semibold text-emerald-800">{pendingRecipientIds.length}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={`${pendingRecipientIds.length} pending`} tone={pendingRecipientIds.length > 0 ? "green" : "slate"} />
                <Button onClick={() => setRecipientPickerOpen(false)}>Close</Button>
              </div>
            </div>
            <div className="flex gap-5 overflow-x-auto border-b border-slate-200 px-5">
              <button type="button" onClick={() => setPickerTab("individuals")} className={["h-11 shrink-0 border-b-2 text-xs font-semibold uppercase tracking-wide", pickerTab === "individuals" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"].join(" ")}>Individuals ({selectedIndividualIds.length})</button>
              <button type="button" onClick={() => setPickerTab("lists")} className={["h-11 shrink-0 border-b-2 text-xs font-semibold uppercase tracking-wide", pickerTab === "lists" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"].join(" ")}>Saved Lists ({selectedListIds.length})</button>
              <button type="button" onClick={() => setPickerTab("segments")} className={["h-11 shrink-0 border-b-2 text-xs font-semibold uppercase tracking-wide", pickerTab === "segments" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"].join(" ")}>Segments ({selectedTagNames.length})</button>
              <button type="button" onClick={() => setPickerTab("filters")} className={["h-11 shrink-0 border-b-2 text-xs font-semibold uppercase tracking-wide", pickerTab === "filters" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"].join(" ")}>More Filters ({selectedDonorStatuses.length})</button>
            </div>
            {pickerError ? <Alert tone="amber">{pickerError}</Alert> : null}
            <div className="max-h-[62vh] overflow-y-auto p-5">
              {pickerTab === "individuals" ? (
                <div className="space-y-3">
                  <SearchBox value={pickerSearch} onChange={setPickerSearch} placeholder="Search constituents by name or email..." />
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr><th className="w-16 px-3 py-2">Pick</th><th className="px-3 py-2">Constituent</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {pickerIndividuals.slice(0, 250).map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={selectedIndividualIds.includes(row.id)} onChange={() => toggleSelection(row.id, setSelectedIndividualIds)} />
                            </td>
                            <td className="px-3 py-2 font-semibold">{personName(row)}</td>
                            <td className="px-3 py-2 text-slate-600">{row.email || "-"}</td>
                            <td className="px-3 py-2"><StatusPill label={row.donorStatus || "UNKNOWN"} tone="slate" /></td>
                          </tr>
                        ))}
                        {pickerIndividuals.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No constituents match your search.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {pickerTab === "lists" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <span>
                      Lists selected: <span className="font-semibold text-slate-900">{selectedListIds.length}</span>
                      {" · "}
                      Total list members: <span className="font-semibold text-slate-900">{selectedListMemberCount}</span>
                      {" · "}
                      CRM matched recipients: <span className="font-semibold text-emerald-800">{resolvedListRecipientIds.length}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
                        onClick={() => setSelectedListIds(recipientLists.map((list) => list.id))}
                        disabled={recipientLists.length === 0}
                      >
                        Select All Lists
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
                        onClick={() => setSelectedListIds([])}
                        disabled={selectedListIds.length === 0}
                      >
                        Clear Lists
                      </button>
                    </div>
                  </div>
                  {recipientLists.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">No saved lists found.</p> : recipientLists.map((list) => {
                    const members = listMembersById[list.id] ?? [];
                    const matched = members.filter((member) => emailToConstituentId.has(member.email.trim().toLowerCase())).length;
                    return (
                      <label key={list.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedListIds.includes(list.id)} onChange={() => void toggleListSelection(list.id)} />
                          <div>
                            <p className="font-semibold text-slate-900">{list.name}</p>
                            <p className="text-xs text-slate-600">{list.description || "Saved recipient list"}</p>
                            <p className="mt-1 text-xs text-slate-500">List members: {list.recipientsCount} · CRM matches: {matched || 0}</p>
                          </div>
                        </div>
                        {pickerLoadingListId === list.id ? <span className="text-xs font-semibold text-emerald-700">Loading...</span> : null}
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {pickerTab === "segments" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <span>
                      Selected segments: <span className="font-semibold text-slate-900">{selectedTagNames.length}</span>
                      {" · "}
                      Segment recipients: <span className="font-semibold text-emerald-800">{selectedSegmentsRecipientCount}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
                        onClick={() => setSelectedTagNames(tagCatalog.map((tag) => tag.name))}
                        disabled={tagCatalog.length === 0}
                      >
                        Select All Segments
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700"
                        onClick={() => setSelectedTagNames([])}
                        disabled={selectedTagNames.length === 0}
                      >
                        Clear Segments
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {tagCatalog.map((tag) => {
                      const active = selectedTagNames.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleSelection(tag.name, setSelectedTagNames)}
                          className={[
                            "rounded-md border px-3 py-2 text-left text-sm font-semibold",
                            active ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700",
                          ].join(" ")}
                        >
                          <span>{tag.name}</span>
                          <span className="mt-1 block text-xs font-medium text-slate-500">{tag.constituentsCount ?? 0} constituents</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {pickerTab === "filters" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Add donor-status cohorts as an additional audience source.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {donorStatusOptions.map((status) => (
                      <label key={status} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                        <span className="font-semibold text-slate-800">{status.replaceAll("_", " ")}</span>
                        <input type="checkbox" checked={selectedDonorStatuses.includes(status)} onChange={() => toggleSelection(status, setSelectedDonorStatuses)} />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-700">
                <p>
                  Pending recipients resolved from selected sources: <span className="font-semibold text-slate-900">{pendingRecipientIds.length}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Individuals {selectedIndividualsCount} · Lists {selectedListIds.length} ({selectedListMemberCount} members) · Segments {selectedTagNames.length} ({selectedSegmentsRecipientCount} recipients) · Filters {selectedDonorStatuses.length} ({selectedFiltersRecipientCount} recipients)
                </p>
                {unresolvedSelectedListCount > 0 ? <p className="text-xs text-amber-700">{unresolvedSelectedListCount} selected list(s) still need member lookup. Apply will resolve them automatically.</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setRecipientPickerOpen(false)}>Cancel</Button>
                <Button onClick={() => void applyRecipientSelection()} tone="primary" disabled={pickerLoadingListId !== null}>Apply Recipients</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur xl:px-5">
        <WorkflowActionBar
          backLabel={backLabel}
          onBack={handleWorkflowBack}
          nextLabel={topNextLabel}
          onNext={handleTopNext}
          nextDisabled={topNextDisabled}
          secondaryAction={wizardStep === 5 ? <Button onClick={() => setWizardStep(1)}>Start New Run</Button> : undefined}
        />
      </div>
    </main>
  );
}

function QueueWorkspace() {
  const [printRows, setPrintRows] = useState<LetterPrintQueueItem[]>([]);
  const [mailRows, setMailRows] = useState<LetterMailQueueItem[]>([]);
  const [tab, setTab] = useState<"print" | "mail">("print");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(25);
  const [queueNote, setQueueNote] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [batchId, setBatchId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [previewRow, setPreviewRow] = useState<LetterPrintQueueItem | LetterMailQueueItem | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("Generated Letter PDF");
  const [pdfViewerFileName, setPdfViewerFileName] = useState("generated-letter.pdf");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [actionWorking, setActionWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [print, mail] = await Promise.all([
        apiFetch<LetterPrintQueueItem[]>("/api/letters/generated/queue/print"),
        apiFetch<LetterMailQueueItem[]>("/api/letters/generated/queue/mail"),
      ]);
      setPrintRows(print);
      setMailRows(mail);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load queue."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds([]);
    setStatusFilter("ALL");
    setQueuePage(1);
  }, [tab]);

  useEffect(() => {
    return () => {
      if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl);
    };
  }, [pdfViewerUrl]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const allRows = tab === "print" ? printRows : mailRows;
  const availableStatuses = useMemo(() => ["ALL", ...Array.from(new Set(allRows.map((row) => row.queueStatus))).sort()], [allRows]);
  const rows = useMemo(
    () => statusFilter === "ALL" ? allRows : allRows.filter((row) => row.queueStatus === statusFilter),
    [allRows, statusFilter],
  );
  const totalQueuePages = Math.max(1, Math.ceil(rows.length / queuePageSize));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedRows = rows.slice((safeQueuePage - 1) * queuePageSize, safeQueuePage * queuePageSize);
  const selectedRows = useMemo(() => {
    const ids = new Set(selectedIds);
    return allRows.filter((row) => ids.has(row.id));
  }, [allRows, selectedIds]);
  const selectedPreviewRow = selectedRows[0] ?? null;
  const visibleIds = paginatedRows.map((row) => row.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const selectedReadyCount = selectedRows.filter((row) => row.addressComplete).length;
  const selectedIssueCount = selectedRows.length - selectedReadyCount;

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleVisibleRows() {
    setSelectedIds((current) => {
      const currentSet = new Set(current);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => currentSet.has(id));
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      for (const id of visibleIds) currentSet.add(id);
      return Array.from(currentSet);
    });
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    setQueuePage(1);
  }

  function queueReadPdfFileName(response: Response, fallback: string): string {
    const disposition = response.headers.get("content-disposition") ?? "";
    const quotedMatch = disposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) return quotedMatch[1];
    const plainMatch = disposition.match(/filename=([^;]+)/i);
    if (plainMatch?.[1]) return plainMatch[1].trim();
    return fallback;
  }

  async function requestQueuePdfBlobUrl(endpoint: string, payload?: unknown, fallbackFileName = "generated-letter.pdf") {
    const response = await apiFetchResponse(endpoint, {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) {
      let message = `PDF export failed (${response.status}).`;
      try {
        const parsed = await response.json();
        if (parsed?.error?.message) message = String(parsed.error.message);
      } catch {
        // Keep default message when response is not JSON.
      }
      throw new Error(message);
    }
    const pdfBlob = await response.blob();
    if (pdfBlob.size === 0) throw new Error("PDF export returned an empty file.");
    return {
      objectUrl: URL.createObjectURL(pdfBlob),
      fileName: queueReadPdfFileName(response, fallbackFileName),
    };
  }

  async function openQueuePdf(letterId: string) {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdf = await requestQueuePdfBlobUrl(
        `/api/letters/generated/${encodeURIComponent(letterId)}/export-pdf?preview=1&inline=1`,
        undefined,
        `letter_${letterId}.pdf`,
      );
      setPdfViewerUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return pdf.objectUrl;
      });
      setPdfViewerFileName(pdf.fileName);
      setPdfViewerTitle("Generated Letter PDF");
      setPdfViewerOpen(true);
    } catch (requestError) {
      setPdfError(errorMessage(requestError, "Failed to open generated letter PDF."));
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewPdf(letterId: string) {
      setPreviewPdfLoading(true);
      setPreviewPdfError(null);
      try {
        const pdf = await requestQueuePdfBlobUrl(
          `/api/letters/generated/${encodeURIComponent(letterId)}/export-pdf?preview=1&inline=1`,
          undefined,
          `letter_${letterId}.pdf`,
        );
        if (cancelled) {
          URL.revokeObjectURL(pdf.objectUrl);
          return;
        }
        setPreviewPdfUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return pdf.objectUrl;
        });
      } catch (requestError) {
        if (!cancelled) {
          setPreviewPdfError(errorMessage(requestError, "Failed to render queue preview PDF."));
          setPreviewPdfUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return null;
          });
        }
      } finally {
        if (!cancelled) setPreviewPdfLoading(false);
      }
    }

    if (!previewRow) {
      setPreviewPdfLoading(false);
      setPreviewPdfError(null);
      setPreviewPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      return () => {
        cancelled = true;
      };
    }

    void loadPreviewPdf(previewRow.id);

    return () => {
      cancelled = true;
    };
  }, [previewRow?.id]);

  async function openSelectedBatchPdf(title = "Selected Letters PDF") {
    if (selectedIds.length === 0) {
      setPdfError("Select at least one queue item first.");
      return;
    }
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdf = await requestQueuePdfBlobUrl(
        "/api/letters/generated/export-pdf-batch?preview=1&inline=1",
        { letterIds: selectedIds },
        `letters_${tab}_queue_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      setPdfViewerUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return pdf.objectUrl;
      });
      setPdfViewerFileName(pdf.fileName);
      setPdfViewerTitle(`${title} (${selectedIds.length})`);
      setPdfViewerOpen(true);
    } catch (requestError) {
      setPdfError(errorMessage(requestError, "Failed to open selected queue PDFs."));
    } finally {
      setPdfLoading(false);
    }
  }

  function printQueuePdf() {
    if (!pdfViewerUrl) return;
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setPdfError("Browser blocked the print preview window. Allow popups for this site and try Print again.");
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head><title>${escapeHtml(pdfViewerTitle)}</title></head>
        <body style="margin:0;background:#f1f5f9;">
          <iframe src="${pdfViewerUrl}#toolbar=1&navpanes=0&view=FitH" style="border:0;width:100vw;height:100vh;"></iframe>
          <script>
            window.addEventListener("load", function () {
              setTimeout(function () { window.focus(); window.print(); }, 650);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function applyQueueAction(action: string) {
    if (selectedIds.length === 0) {
      setError("Select at least one queue item first.");
      return;
    }
    setActionWorking(true);
    setError(null);
    setNotice(null);
    try {
      const endpoint = tab === "print"
        ? "/api/letters/generated/queue/print/actions"
        : "/api/letters/generated/queue/mail/actions";
      const payload = tab === "print"
        ? { action, letterIds: selectedIds, note: queueNote || undefined, priority, batchId: batchId || undefined }
        : { action, letterIds: selectedIds, note: queueNote || undefined, returnReason: returnReason || undefined };
      const result = await apiFetch<{ updatedCount: number; action: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(`${titleCase(result.action)} applied to ${result.updatedCount} letter${result.updatedCount === 1 ? "" : "s"}.`);
      setSelectedIds([]);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to update queue."));
    } finally {
      setActionWorking(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fa]">
      <PageHero title="Print & Mail Queue" subtitle="Review generated letters already stored in the live letters queue.">
        <Button onClick={() => void load()}>Refresh</Button>
        <Button href="/oyama-letters/generate" tone="primary">Generate Letters</Button>
      </PageHero>
      {error ? <Alert tone="amber">{error}</Alert> : null}
      {notice ? <Alert tone="green">{notice}</Alert> : null}
      <div className="p-4 xl:p-6">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">Queue Controls</p>
              <p className="mt-1 text-sm text-slate-600">{selectedIds.length} selected across the {tab === "print" ? "print" : "mail"} lane.</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <SummaryNumber label="Selected" value={String(selectedIds.length)} tone="slate" />
                <SummaryNumber label="Ready" value={String(selectedReadyCount)} tone="green" />
                <SummaryNumber label="Issues" value={String(selectedIssueCount)} tone={selectedIssueCount > 0 ? "orange" : "slate"} />
              </div>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Status Filter
                  <select value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal">
                    {availableStatuses.map((status) => <option key={status} value={status}>{status === "ALL" ? "All statuses" : status.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Operator Note
                  <textarea value={queueNote} onChange={(event) => setQueueNote(event.target.value)} className="mt-1 h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Optional note for audit trail and queue history" />
                </label>
                {tab === "print" ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Print Priority
                      <select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal">
                        {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Batch Label
                      <input value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" placeholder="Optional print batch ID" />
                    </label>
                  </div>
                ) : (
                  <label className="block text-xs font-semibold text-slate-700">
                    Return Reason
                    <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" placeholder="Required when marking returned" />
                  </label>
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">{tab === "print" ? "Print Management" : "Mail Management"}</p>
              <div className="mt-3 grid gap-2">
                {tab === "print" ? (
                  <>
                    <Button onClick={() => void applyQueueAction("APPROVE")} disabled={actionWorking || selectedIds.length === 0}>Approve</Button>
                    <Button onClick={() => void applyQueueAction("QUEUE_FOR_PRINT")} disabled={actionWorking || selectedIds.length === 0}>Queue For Print</Button>
                    <Button onClick={() => void openSelectedBatchPdf("Print File")} disabled={pdfLoading || selectedIds.length === 0}>Print Selected PDFs</Button>
                    <Button onClick={() => void openSelectedBatchPdf("Download File")} disabled={pdfLoading || selectedIds.length === 0}>Download Selected PDFs</Button>
                    <Button onClick={() => void applyQueueAction("MARK_PRINTED")} disabled={actionWorking || selectedIds.length === 0}>Mark Printed</Button>
                    <Button onClick={() => void applyQueueAction("MOVE_TO_MAIL_QUEUE")} disabled={actionWorking || selectedIds.length === 0}>Move To Mail Queue</Button>
                    <Button onClick={() => void applyQueueAction("CANCEL")} disabled={actionWorking || selectedIds.length === 0}>Cancel Print Job</Button>
                    <Button onClick={() => void applyQueueAction("ARCHIVE")} disabled={actionWorking || selectedIds.length === 0}>Archive</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => void applyQueueAction("QUEUE_FOR_MAIL")} disabled={actionWorking || selectedIds.length === 0}>Queue For Mail</Button>
                    <Button onClick={() => void openSelectedBatchPdf("Mail File")} disabled={pdfLoading || selectedIds.length === 0}>Download Selected PDFs</Button>
                    <Button onClick={() => void applyQueueAction("MARK_MAILED")} disabled={actionWorking || selectedIds.length === 0}>Mark Mailed</Button>
                    <Button onClick={() => void applyQueueAction("MARK_RETURNED")} disabled={actionWorking || selectedIds.length === 0}>Mark Returned</Button>
                    <Button onClick={() => void applyQueueAction("ADDRESS_ISSUE")} disabled={actionWorking || selectedIds.length === 0}>Flag Address Issue</Button>
                    <Button onClick={() => void applyQueueAction("REPRINT")} disabled={actionWorking || selectedIds.length === 0}>Send Back To Print</Button>
                    <Button onClick={() => void applyQueueAction("DELETE_PRINTS")} disabled={actionWorking || selectedIds.length === 0}>Delete Prints</Button>
                    <Button onClick={() => void applyQueueAction("ARCHIVE")} disabled={actionWorking || selectedIds.length === 0}>Archive</Button>
                  </>
                )}
              </div>
              {pdfError ? <div className="mt-3"><Alert tone="amber">{pdfError}</Alert></div> : null}
            </section>
          </aside>

          <section className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-5 border-b border-slate-200 px-4">
            <TabButton active={tab === "print"} onClick={() => setTab("print")}>Print Queue ({printRows.length})</TabButton>
            <TabButton active={tab === "mail"} onClick={() => setTab("mail")}>Mail Queue ({mailRows.length})</TabButton>
            </div>
            <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bulk File Tool Strip</p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedIds.length > 0 ? `${selectedIds.length} selected file${selectedIds.length === 1 ? "" : "s"} ready for ${tab === "print" ? "print" : "mail"} actions.` : "Select generated letters to manage PDFs, print jobs, and mail files."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => selectedPreviewRow ? setPreviewRow(selectedPreviewRow) : undefined} disabled={!selectedPreviewRow} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Preview First</button>
                <button type="button" onClick={() => selectedPreviewRow ? void openQueuePdf(selectedPreviewRow.id) : undefined} disabled={!selectedPreviewRow || pdfLoading} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Open PDF</button>
                <button type="button" onClick={() => void openSelectedBatchPdf(tab === "print" ? "Print File" : "Mail File")} disabled={selectedIds.length === 0 || pdfLoading} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Download PDFs</button>
                <button type="button" onClick={() => void openSelectedBatchPdf("Print Preview File")} disabled={selectedIds.length === 0 || pdfLoading} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Print Preview</button>
                {tab === "print" ? (
                  <>
                    <button type="button" onClick={() => void applyQueueAction("MARK_PRINTED")} disabled={selectedIds.length === 0 || actionWorking} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Mark Printed</button>
                    <button type="button" onClick={() => void applyQueueAction("MOVE_TO_MAIL_QUEUE")} disabled={selectedIds.length === 0 || actionWorking} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Move To Mail</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => void applyQueueAction("MARK_MAILED")} disabled={selectedIds.length === 0 || actionWorking} className="h-9 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Mark Mailed</button>
                    <button type="button" onClick={() => void applyQueueAction("DELETE_PRINTS")} disabled={selectedIds.length === 0 || actionWorking} className="h-9 rounded border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">Delete Prints</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{rows.length}</span> total
                {" · "}
                Page <span className="font-semibold text-slate-900">{safeQueuePage}</span> of <span className="font-semibold text-slate-900">{totalQueuePages}</span>
                {" · "}
                <span className="font-semibold text-slate-900">{selectedVisibleCount}</span> selected on this page
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={queuePageSize} onChange={(event) => { setQueuePageSize(Number(event.target.value)); setQueuePage(1); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                </select>
                <Button onClick={() => setQueuePage((current) => Math.max(1, current - 1))} disabled={safeQueuePage <= 1}>Previous</Button>
                <Button onClick={() => setQueuePage((current) => Math.min(totalQueuePages, current + 1))} disabled={safeQueuePage >= totalQueuePages}>Next</Button>
                <Button onClick={toggleVisibleRows} disabled={paginatedRows.length === 0}>{selectedVisibleCount === paginatedRows.length && paginatedRows.length > 0 ? "Clear Page" : "Select Page"}</Button>
                <Button onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>Clear Selection</Button>
              </div>
            </div>
            {loading ? <LoadingRows /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Queue Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Address</th>
                      <th className="px-4 py-3">Generated</th>
                      <th className="px-4 py-3">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No live queue records found.</td></tr>
                    ) : paginatedRows.map((row) => (
                      <tr key={row.id} className={selectedIds.includes(row.id) ? "bg-emerald-50/50" : undefined}>
                        <td className="px-4 py-3">
                          <input aria-label={`Select ${row.template?.name ?? "letter"}`} type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.template?.name ?? "Untitled template"}</p>
                          <p className="text-xs text-slate-500">{row.mergedPrintSubject || row.template?.category || "Generated letter"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{row.constituent ? personName(row.constituent) : "-"}</p>
                          <p className="text-xs text-slate-500">{row.constituent ? formatAddress(row.constituent) || "No address" : "No recipient"}</p>
                        </td>
                        <td className="px-4 py-3"><StatusPill label={row.queueStatus} tone={row.queueStatus.includes("FAILED") || row.queueStatus.includes("RETURNED") || row.queueStatus.includes("CANCELED") ? "red" : row.queueStatus.includes("PRINTED") || row.queueStatus.includes("MAILED") || row.queueStatus.includes("APPROVED") ? "green" : "slate"} /></td>
                        <td className="px-4 py-3">{row.priority}</td>
                        <td className="px-4 py-3"><StatusPill label={row.addressComplete ? "Complete" : "Missing"} tone={row.addressComplete ? "green" : "orange"} /></td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.generatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setPreviewRow(row)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Preview</button>
                            <button type="button" onClick={() => void openQueuePdf(row.id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={pdfLoading}>PDF</button>
                            <button type="button" onClick={() => { setSelectedIds([row.id]); void openQueuePdf(row.id); }} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={pdfLoading}>Download</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {previewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button type="button" aria-label="Close generated content preview" className="absolute inset-0 bg-slate-950/60" onClick={() => setPreviewRow(null)} />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{previewRow.mergedPrintSubject || previewRow.template?.name || "Generated Letter"}</p>
                <p className="truncate text-xs text-slate-600">{previewRow.constituent ? personName(previewRow.constituent) : "No recipient"} · {formatDate(previewRow.generatedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void openQueuePdf(previewRow.id)} disabled={pdfLoading}>Open PDF</Button>
                <Button onClick={() => setPreviewRow(null)}>Close</Button>
              </div>
            </div>
            <div className="overflow-auto bg-[#f3f5f8] p-5">
              {previewPdfLoading ? (
                <div className="flex min-h-[65vh] items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-600">
                  Rendering server preview...
                </div>
              ) : null}
              {!previewPdfLoading && previewPdfError ? (
                <div className="space-y-3">
                  <Alert tone="amber">{previewPdfError}</Alert>
                  <MiniDocument html={previewRow.mergedPrintBody || ""} emptyText="No generated print content is available for this letter." />
                </div>
              ) : null}
              {!previewPdfLoading && !previewPdfError && previewPdfUrl ? (
                <object
                  aria-label="Queue preview PDF"
                  title="Queue preview PDF"
                  data={`${previewPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                  type="application/pdf"
                  className="min-h-[72vh] w-full rounded-md border border-slate-200 bg-white"
                >
                  <div className="flex min-h-[65vh] items-center justify-center rounded-md border border-slate-200 bg-white p-6 text-center text-sm text-slate-700">
                    This browser is not rendering the PDF inline. Use Open PDF to view and download the server-rendered preview.
                  </div>
                </object>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pdfViewerOpen && pdfViewerUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button type="button" aria-label="Close PDF viewer" className="absolute inset-0 bg-slate-950/60" onClick={() => setPdfViewerOpen(false)} />
          <div className="relative z-10 flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{pdfViewerTitle}</p>
                <p className="truncate text-xs text-slate-600">{pdfViewerFileName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={pdfViewerUrl} download={pdfViewerFileName} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Save PDF</a>
                <Button onClick={printQueuePdf}>Print</Button>
                <Button onClick={() => setPdfViewerOpen(false)}>Close</Button>
              </div>
            </div>
            <object
              id="oyama-letters-queue-pdf-viewer"
              aria-label="Queue Generated PDF"
              title="Queue Generated PDF"
              data={`${pdfViewerUrl}#toolbar=1&navpanes=0&view=FitH`}
              type="application/pdf"
              className="min-h-0 flex-1 bg-slate-100"
            >
              <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-700">
                This browser is not rendering the PDF inline. Use Print to open the print preview window or Save PDF to download it.
              </div>
            </object>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SettingsWorkspace() {
  const [tab, setTab] = useState<SettingsTab>("organization");

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fa]">
      <PageHero
        title="OyamaLetters Settings"
        subtitle="Letter branding now uses the global Branding Settings source of truth. Workflow policy remains here."
        tooltip="Branding is shared infrastructure for every letter. This workspace keeps only letters-specific workflow policy, queue defaults, and operational guidance."
      >
        <Button href="/settings/branding" tone="primary">Global Branding</Button>
      </PageHero>
      <div className="border-b border-slate-200 bg-white px-4 xl:px-7">
        <div className="flex gap-6 overflow-x-auto">
          <TabButton active={tab === "organization"} onClick={() => setTab("organization")}>Branding Source</TabButton>
          <TabButton active={tab === "workflow"} onClick={() => setTab("workflow")}>Workflow</TabButton>
        </div>
      </div>
      <div className="p-4 xl:p-6">
        {tab === "organization" ? (
          <div className="grid gap-4 xl:grid-cols-3">
            <SettingsCard title="Identity & Logo" body="Organization name, address, colors, and logos used by server-rendered letter PDFs." href="/settings/branding" />
            <SettingsCard title="Global Header + Footer" body="The single communication header and footer used by all letters and emails." href="/settings/branding#communication-header-footer" />
            <SettingsCard title="Signatures" body="Reusable signer blocks used by templates and generated PDFs." href="/settings/branding/signatures" />
          </div>
        ) : null}
        {tab === "workflow" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
            <SettingsCard title="Branding Settings" body="Letter branding, presets, and signatures are managed in global Branding Settings." href="/settings/branding" />
            <WorkflowPolicyPanel />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function LettersOrganizationSettingsPanel() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const brandingRow = await apiFetch<BrandingSettings>("/api/settings/branding");
      setBranding(normalizeBrandingSettings(brandingRow));
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load Letters organization settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logo = branding.logoUrl || branding.logoSquareUrl;
  const orgName = branding.organizationDisplayName || branding.legalOrganizationName || "No organization name configured";
  const address = formatBrandingAddress(branding);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Organization Import Source</p>
            <p className="mt-1 text-sm text-slate-600">These values come from global Organization and Branding Settings.</p>
          </div>
          <Button onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
        {loading ? <p className="mt-5 text-sm text-slate-500">Loading branding...</p> : null}
        {error ? <Alert tone="amber">{error}</Alert> : null}
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4 rounded-md border border-slate-200 p-3">
            <div className="flex h-16 w-24 items-center justify-center rounded-md bg-slate-50">
              {logo ? <img src={logo} alt="" className="max-h-14 max-w-20 object-contain" /> : <LogoMark className="h-10 w-10 text-emerald-800" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{orgName}</p>
              <p className="mt-1 text-xs text-slate-500">{branding.tagline || "No tagline configured"}</p>
            </div>
          </div>
          <BrandRow label="Legal Name" value={branding.legalOrganizationName} />
          <BrandRow label="Mission" value={branding.missionStatement} />
          <BrandRow label="Address" value={address} />
          <BrandRow label="Phone" value={branding.contactPhone} />
          <BrandRow label="Email" value={branding.contactEmail} />
          <BrandRow label="Website" value={branding.websiteUrl} />
          <BrandRow label="Tax ID" value={branding.taxId} />
          <div className="grid grid-cols-2 gap-3">
            <ColorSwatch label="Primary" value={branding.primaryColor} />
            <ColorSwatch label="Accent" value={branding.accentColor} />
          </div>
          <Button href="/settings/branding#communication-header-footer" tone="primary">Edit Branding Defaults</Button>
        </div>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <p className="font-semibold">Letters Default Preview</p>
        <p className="mt-1 text-sm text-slate-600">This preview uses the global Communication Header + Footer from Branding Defaults.</p>
        <div className="mt-5 rounded-md border border-slate-200 bg-[#f3f5f8] p-5">
          <div className="mx-auto max-w-[640px] bg-white px-10 py-8 shadow-sm ring-1 ring-slate-200">
            <LetterPreviewHeader branding={branding} header={buildImportedHeaderPreset(branding)} />
            <div className="py-10 text-sm leading-7 text-slate-700">
              <p>Dear {"{{donor.firstName}}"},</p>
              <p className="mt-5">Your Letters templates use this organization identity and the global communication header/footer.</p>
              <p className="mt-5">With gratitude,</p>
            </div>
            <LetterPreviewFooter branding={branding} footer={buildImportedFooterPreset(branding)} />
          </div>
        </div>
      </section>
    </div>
  );
}

function LettersPresetManager({ mode }: { mode: "headers" | "footers" }) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [headers, setHeaders] = useState<HeaderPreset[]>([]);
  const [footers, setFooters] = useState<FooterPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [headerDraft, setHeaderDraft] = useState<HeaderPresetDraft>(EMPTY_HEADER_PRESET);
  const [footerDraft, setFooterDraft] = useState<FooterPresetDraft>(EMPTY_FOOTER_PRESET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandingRow, headerRows, footerRows] = await Promise.all([
        apiFetch<BrandingSettings>("/api/settings/branding"),
        apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
        apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
      ]);
      setBranding(normalizeBrandingSettings(brandingRow));
      setHeaders(headerRows);
      setFooters(footerRows);
      const rows = mode === "headers" ? headerRows : footerRows;
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to load Letters presets."));
    } finally {
      setLoading(false);
    }
  }, [mode, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const row = headers.find((item) => item.id === selectedId);
    if (!row) return;
    setHeaderDraft({
      name: row.name,
      logoAlignment: row.logoAlignment ?? "LEFT",
      showOrganizationName: row.showOrganizationName ?? true,
      showTagline: row.showTagline ?? false,
      showAddress: row.showAddress ?? true,
      showPhone: row.showPhone ?? true,
      showWebsite: row.showWebsite ?? true,
      customHtml: row.customHtml ?? "",
      isDefault: row.isDefault,
      isActive: row.isActive,
    });
  }, [headers, selectedId]);

  useEffect(() => {
    const row = footers.find((item) => item.id === selectedId);
    if (!row) return;
    setFooterDraft({
      name: row.name,
      showOrganizationName: row.showOrganizationName ?? true,
      showAddress: row.showAddress ?? true,
      showPhone: row.showPhone ?? true,
      showEmail: row.showEmail ?? true,
      showWebsite: row.showWebsite ?? true,
      showTaxId: row.showTaxId ?? false,
      showPageNumber: row.showPageNumber ?? false,
      customText: row.customText ?? "",
      customHtml: row.customHtml ?? "",
      isDefault: row.isDefault,
      isActive: row.isActive,
    });
  }, [footers, selectedId]);

  async function savePreset() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      if (mode === "headers") {
        const payload = { ...headerDraft, customHtml: headerDraft.customHtml || null };
        const saved = selectedId
          ? await apiFetch<HeaderPreset>(`/api/letters/header-presets/${selectedId}`, { method: "PATCH", body: JSON.stringify(payload) })
          : await apiFetch<HeaderPreset>("/api/letters/header-presets", { method: "POST", body: JSON.stringify(payload) });
        setSelectedId(saved.id);
        setNotice("Header preset saved.");
      } else {
        const payload = { ...footerDraft, customText: footerDraft.customText || null, customHtml: footerDraft.customHtml || null };
        const saved = selectedId
          ? await apiFetch<FooterPreset>(`/api/letters/footer-presets/${selectedId}`, { method: "PATCH", body: JSON.stringify(payload) })
          : await apiFetch<FooterPreset>("/api/letters/footer-presets", { method: "POST", body: JSON.stringify(payload) });
        setSelectedId(saved.id);
        setNotice("Footer preset saved.");
      }
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to save Letters preset."));
    } finally {
      setSaving(false);
    }
  }

  async function importDefaultsFromOrganization() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      if (mode === "headers") {
        const defaultHeader = headers.find((item) => item.isDefault) ?? null;
        const payload = buildImportedHeaderPreset(branding);
        const saved = defaultHeader
          ? await apiFetch<HeaderPreset>(`/api/letters/header-presets/${defaultHeader.id}`, { method: "PATCH", body: JSON.stringify(payload) })
          : await apiFetch<HeaderPreset>("/api/letters/header-presets", { method: "POST", body: JSON.stringify(payload) });
        setSelectedId(saved.id);
        setNotice("Imported organization defaults into Letters header presets.");
      } else {
        const defaultFooter = footers.find((item) => item.isDefault) ?? null;
        const payload = buildImportedFooterPreset(branding);
        const saved = defaultFooter
          ? await apiFetch<FooterPreset>(`/api/letters/footer-presets/${defaultFooter.id}`, { method: "PATCH", body: JSON.stringify(payload) })
          : await apiFetch<FooterPreset>("/api/letters/footer-presets", { method: "POST", body: JSON.stringify(payload) });
        setSelectedId(saved.id);
        setNotice("Imported organization defaults into Letters footer presets.");
      }
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to import organization defaults."));
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setSelectedId("");
    if (mode === "headers") setHeaderDraft({ ...buildImportedHeaderPreset(branding), name: "New Letter Header" });
    else setFooterDraft({ ...buildImportedFooterPreset(branding), name: "New Letter Footer" });
  }

  const rows = mode === "headers" ? headers : footers;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">{mode === "headers" ? "Letter Headers" : "Letter Footers"}</p>
          <div className="flex items-center gap-2">
            <Button onClick={() => void importDefaultsFromOrganization()} disabled={saving || loading}>Import Defaults</Button>
            <Button onClick={startNew}>New</Button>
          </div>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Loading presets...</p> : null}
        <div className="mt-4 space-y-2">
          {rows.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No Letters-only presets yet. Use New or import branding from Organization.</p> : null}
          {rows.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={["w-full rounded-md border px-3 py-2 text-left", item.id === selectedId ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"].join(" ")}>
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.isDefault ? "Default" : "Custom"} · {item.isActive ? "Active" : "Inactive"}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        {error ? <Alert tone="amber">{error}</Alert> : null}
        {notice ? <Alert tone="green">{notice}</Alert> : null}
        {mode === "headers" ? (
          <HeaderPresetEditor draft={headerDraft} setDraft={setHeaderDraft} onSave={() => void savePreset()} saving={saving} />
        ) : (
          <FooterPresetEditor draft={footerDraft} setDraft={setFooterDraft} onSave={() => void savePreset()} saving={saving} />
        )}
      </section>
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <p className="font-semibold">Live Letter Preview</p>
        <div className="mt-4 rounded-md border border-slate-200 bg-[#f3f5f8] p-4">
          <div className="bg-white px-7 py-6 text-xs shadow-sm ring-1 ring-slate-200">
            <LetterPreviewHeader branding={branding} header={headerDraft} />
            <div className="py-10 leading-6 text-slate-600">Letter content preview</div>
            <LetterPreviewFooter branding={branding} footer={footerDraft} />
          </div>
        </div>
      </section>
    </div>
  );
}

function HeaderPresetEditor({ draft, setDraft, onSave, saving }: { draft: HeaderPresetDraft; setDraft: (next: HeaderPresetDraft) => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="space-y-4">
      <p className="font-semibold">Header Setup</p>
      <TextField label="Preset Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <LabeledSelect label="Logo Alignment" value={draft.logoAlignment} onChange={(value) => setDraft({ ...draft, logoAlignment: value })} options={["LEFT", "CENTER", "RIGHT", "NONE"]} />
      <div className="grid gap-2 sm:grid-cols-2">
        <CheckField label="Show organization name" checked={draft.showOrganizationName} onChange={(value) => setDraft({ ...draft, showOrganizationName: value })} />
        <CheckField label="Show tagline" checked={draft.showTagline} onChange={(value) => setDraft({ ...draft, showTagline: value })} />
        <CheckField label="Show address" checked={draft.showAddress} onChange={(value) => setDraft({ ...draft, showAddress: value })} />
        <CheckField label="Show phone" checked={draft.showPhone} onChange={(value) => setDraft({ ...draft, showPhone: value })} />
        <CheckField label="Show website" checked={draft.showWebsite} onChange={(value) => setDraft({ ...draft, showWebsite: value })} />
        <CheckField label="Make default header" checked={draft.isDefault} onChange={(value) => setDraft({ ...draft, isDefault: value })} />
        <CheckField label="Active" checked={draft.isActive} onChange={(value) => setDraft({ ...draft, isActive: value })} />
      </div>
      <TextArea label="Custom Header HTML" value={draft.customHtml} onChange={(value) => setDraft({ ...draft, customHtml: value })} />
      <Button onClick={onSave} tone="primary" disabled={saving || !draft.name.trim()}>{saving ? "Saving..." : "Save Header"}</Button>
    </div>
  );
}

function FooterPresetEditor({ draft, setDraft, onSave, saving }: { draft: FooterPresetDraft; setDraft: (next: FooterPresetDraft) => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="space-y-4">
      <p className="font-semibold">Footer Setup</p>
      <TextField label="Preset Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <CheckField label="Show organization name" checked={draft.showOrganizationName} onChange={(value) => setDraft({ ...draft, showOrganizationName: value })} />
        <CheckField label="Show address" checked={draft.showAddress} onChange={(value) => setDraft({ ...draft, showAddress: value })} />
        <CheckField label="Show phone" checked={draft.showPhone} onChange={(value) => setDraft({ ...draft, showPhone: value })} />
        <CheckField label="Show email" checked={draft.showEmail} onChange={(value) => setDraft({ ...draft, showEmail: value })} />
        <CheckField label="Show website" checked={draft.showWebsite} onChange={(value) => setDraft({ ...draft, showWebsite: value })} />
        <CheckField label="Show Tax ID" checked={draft.showTaxId} onChange={(value) => setDraft({ ...draft, showTaxId: value })} />
        <CheckField label="Make default footer" checked={draft.isDefault} onChange={(value) => setDraft({ ...draft, isDefault: value })} />
        <CheckField label="Active" checked={draft.isActive} onChange={(value) => setDraft({ ...draft, isActive: value })} />
      </div>
      <TextArea label="Custom Footer Text" value={draft.customText} onChange={(value) => setDraft({ ...draft, customText: value })} />
      <TextArea label="Custom Footer HTML" value={draft.customHtml} onChange={(value) => setDraft({ ...draft, customHtml: value })} />
      <Button onClick={onSave} tone="primary" disabled={saving || !draft.name.trim()}>{saving ? "Saving..." : "Save Footer"}</Button>
    </div>
  );
}

function LetterPreviewHeader({ branding, header }: { branding: BrandingSettings; header: HeaderPresetDraft }) {
  const logo = branding.logoUrl || branding.logoSquareUrl;
  const orgName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization Name";
  const address = formatBrandingAddress(branding);
  const align = header.logoAlignment === "CENTER" ? "text-center" : header.logoAlignment === "RIGHT" ? "text-right" : "text-left";

  if (header.customHtml.trim()) {
    return <div className="border-b border-slate-200 pb-4 text-slate-700 [&_img]:max-h-20 [&_img]:max-w-full [&_p]:my-1" dangerouslySetInnerHTML={{ __html: header.customHtml }} />;
  }

  return (
    <header className={`border-b border-slate-200 pb-4 ${align}`}>
      {header.logoAlignment !== "NONE" && logo ? <img src={logo} alt="" className="mb-2 inline-block max-h-16 max-w-48 object-contain" /> : null}
      {header.logoAlignment !== "NONE" && !logo ? <LogoMark className="mb-2 inline-block h-10 w-10 text-emerald-800" /> : null}
      {header.showOrganizationName ? <p className="text-lg font-semibold text-emerald-900">{orgName}</p> : null}
      {header.showTagline && branding.tagline ? <p className="text-xs text-slate-500">{branding.tagline}</p> : null}
      {header.showAddress && address ? <p className="text-xs text-slate-500">{address}</p> : null}
      {header.showPhone && branding.contactPhone ? <p className="text-xs text-slate-500">{branding.contactPhone}</p> : null}
      {header.showWebsite && branding.websiteUrl ? <p className="text-xs text-slate-500">{branding.websiteUrl}</p> : null}
    </header>
  );
}

function LetterPreviewFooter({ branding, footer }: { branding: BrandingSettings; footer: FooterPresetDraft }) {
  const orgName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization Name";
  const address = formatBrandingAddress(branding);
  const contact = [
    footer.showPhone ? branding.contactPhone : "",
    footer.showEmail ? branding.contactEmail : "",
    footer.showWebsite ? branding.websiteUrl : "",
  ].filter(Boolean).join(" | ");

  if (footer.customHtml.trim()) {
    return <div className="border-t border-slate-200 pt-3 text-center text-xs text-slate-600 [&_img]:max-h-16 [&_img]:max-w-full [&_p]:my-1" dangerouslySetInnerHTML={{ __html: footer.customHtml }} />;
  }

  return (
    <footer className="border-t border-slate-200 pt-3 text-center text-[11px] leading-5 text-slate-500">
      {footer.showOrganizationName ? <p className="font-semibold text-slate-700">{orgName}</p> : null}
      {footer.showAddress && address ? <p>{address}</p> : null}
      {contact ? <p>{contact}</p> : null}
      {footer.showTaxId && branding.taxId ? <p>Tax ID: {branding.taxId}</p> : null}
      {footer.customText ? <p className="whitespace-pre-line">{footer.customText}</p> : null}
    </footer>
  );
}

function BrandRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-800">{value || "-"}</p>
    </div>
  );
}

function ColorSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: value }} />
        <span className="text-sm font-mono text-slate-700">{value}</span>
      </div>
    </div>
  );
}

function buildImportedHeaderPreset(branding: BrandingSettings): HeaderPresetDraft {
  return {
    ...EMPTY_HEADER_PRESET,
    name: "Letters Default Header",
    customHtml: "",
    showTagline: Boolean(branding.tagline),
    showAddress: Boolean(formatBrandingAddress(branding)),
    showPhone: Boolean(branding.contactPhone),
    showWebsite: Boolean(branding.websiteUrl),
  };
}

function buildImportedFooterPreset(branding: BrandingSettings): FooterPresetDraft {
  return {
    ...EMPTY_FOOTER_PRESET,
    name: "Letters Default Footer",
    customText: branding.footerLegalText || "",
    customHtml: "",
    showAddress: Boolean(formatBrandingAddress(branding)),
    showPhone: Boolean(branding.contactPhone),
    showEmail: Boolean(branding.contactEmail),
    showWebsite: Boolean(branding.websiteUrl),
    showTaxId: Boolean(branding.taxId),
  };
}

function WorkflowPolicyPanel() {
  const [policy, setPolicy] = useState<WorkflowPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const row = await apiFetch<WorkflowPolicy>("/api/letters/workflow-settings");
        if (mounted) setPolicy(row);
      } catch (requestError) {
        if (mounted) setError(errorMessage(requestError, "Failed to load workflow policy."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    if (!policy) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await apiFetch<WorkflowPolicy>("/api/letters/workflow-settings", { method: "PUT", body: JSON.stringify(policy) });
      setPolicy(saved);
      setNotice("Workflow policy saved.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Failed to save workflow policy."));
    } finally {
      setSaving(false);
    }
  }

  function patchPolicy(next: Partial<WorkflowPolicy>) {
    setPolicy((current) => current ? { ...current, ...next } : current);
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Workflow Policy</p>
          <p className="mt-1 text-sm text-slate-600">Print approval, queue defaults, address gates, and PDF fallback behavior from the live letters API.</p>
        </div>
        <Button onClick={() => void save()} tone="primary" disabled={!policy || saving}>{saving ? "Saving..." : "Save Policy"}</Button>
      </div>
      {loading ? <div className="mt-5 text-sm text-slate-500">Loading workflow policy...</div> : null}
      {error ? <Alert tone="amber">{error}</Alert> : null}
      {notice ? <Alert tone="green">{notice}</Alert> : null}
      {policy ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <CheckField label="Auto-queue batch letters to print" checked={policy.autoQueueBatchToPrint} onChange={(value) => patchPolicy({ autoQueueBatchToPrint: value })} />
          <CheckField label="Require print approval" checked={policy.requirePrintApproval} onChange={(value) => patchPolicy({ requirePrintApproval: value })} />
          <CheckField label="Allow direct mail queue" checked={policy.allowDirectMailQueue} onChange={(value) => patchPolicy({ allowDirectMailQueue: value })} />
          <CheckField label="Gate incomplete addresses" checked={policy.enableAddressValidationGate} onChange={(value) => patchPolicy({ enableAddressValidationGate: value })} />
          <LabeledSelect label="Default Priority" value={policy.defaultPriority} onChange={(value) => patchPolicy({ defaultPriority: value as WorkflowPolicy["defaultPriority"] })} options={["LOW", "NORMAL", "HIGH", "URGENT"]} />
          <LabeledSelect label="PDF Fallback" value={policy.pdfFallbackMode} onChange={(value) => patchPolicy({ pdfFallbackMode: value as WorkflowPolicy["pdfFallbackMode"] })} options={["SERVER_RENDER", "BROWSER_PRINT", "DISABLED"]} />
          <label className="block text-xs font-semibold text-slate-700">
            Mailing SLA Days
            <input
              type="number"
              min={1}
              max={30}
              value={policy.mailingSlaDays}
              onChange={(event) => patchPolicy({ mailingSlaDays: Number(event.target.value) })}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal"
            />
          </label>
          <div className="lg:col-span-2">
            <TextArea label="Policy Notes" value={policy.notes} onChange={(value) => patchPolicy({ notes: value })} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-700" />
      {label}
    </label>
  );
}

function TemplateCard({ template, currentUserId, onExport }: { template: LetterTemplateSummary; currentUserId: string | null; onExport: (template: LetterTemplateSummary) => void }) {
  const ownershipLabel = template.createdBy?.id === currentUserId ? "Created by you" : template.createdBy ? "Shared by team" : "Creator unknown";
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <Link href={`/oyama-letters/templates/${template.id}`} className="block">
        <DocumentThumb template={template} />
      </Link>
      <div className="space-y-3 border-t border-slate-200 p-4">
        <div>
          <Link href={`/oyama-letters/templates/${template.id}`} className="text-[17px] font-semibold text-slate-950 hover:text-emerald-800">{template.name}</Link>
          <p className="mt-1 text-sm text-slate-600">{template.category.replaceAll("_", " ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{ownershipLabel}</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${template.aiAssisted ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {template.aiAssisted ? "AI-assisted" : "User created"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusPill label={template.status === "ACTIVE" ? "Published" : titleCase(template.status)} tone={template.status === "ACTIVE" ? "green" : template.status === "DRAFT" ? "orange" : "slate"} />
          <p className="text-xs text-slate-500">Updated {formatDate(template.updatedAt)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Usage</p>
            <p className="mt-1 font-semibold text-slate-800">{template._count?.generatedLetters ?? 0} runs</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">State</p>
            <p className="mt-1 font-semibold text-slate-800">{template.status === "ACTIVE" ? "Live" : titleCase(template.status)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/oyama-letters/templates/${template.id}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50">
            Open Template
          </Link>
          <button
            type="button"
            onClick={() => onExport(template)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Export
          </button>
          <Link
            href={template.status === "ACTIVE" ? `/oyama-letters/generate?templateId=${encodeURIComponent(template.id)}` : `/oyama-letters/templates/${template.id}/publish`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {template.status === "ACTIVE" ? "Continue Workflow" : "Continue to Publish"}
          </Link>
        </div>
      </div>
    </article>
  );
}

function TemplateRow({ template, currentUserId, onExport }: { template: LetterTemplateSummary; currentUserId: string | null; onExport: (template: LetterTemplateSummary) => void }) {
  const ownershipLabel = template.createdBy?.id === currentUserId ? "Created by you" : template.createdBy ? "Shared by team" : "Creator unknown";
  return (
    <article className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="w-24 shrink-0"><DocumentThumb template={template} small /></div>
      <div className="min-w-0 flex-1">
        <Link href={`/oyama-letters/templates/${template.id}`} className="font-semibold text-slate-950 hover:text-emerald-800">{template.name}</Link>
        <p className="mt-1 text-sm text-slate-600">{template.category.replaceAll("_", " ")} · {template.status}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{ownershipLabel}</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${template.aiAssisted ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {template.aiAssisted ? "AI-assisted" : "User created"}
          </span>
        </div>
      </div>
      <p className="hidden text-sm text-slate-500 md:block">Updated {formatDate(template.updatedAt)}</p>
      <p className="hidden text-sm text-slate-500 lg:block">Used {template._count?.generatedLetters ?? 0} times</p>
      <button type="button" onClick={() => onExport(template)} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        Export
      </button>
      <Button href={`/oyama-letters/templates/${template.id}`}>Open</Button>
    </article>
  );
}

function DocumentThumb({ template, small = false }: { template: LetterTemplateSummary; small?: boolean }) {
  return (
    <div className={`${small ? "h-24" : "h-[188px]"} bg-[linear-gradient(140deg,#f8fafc,#eef3f8)] p-3`}>
      <div className="mx-auto h-full max-w-[150px] rounded-md border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-800" /><span className="h-1.5 w-14 rounded bg-slate-700" /></div>
          <div className="space-y-1">{[24, 20, 28].map((width) => <div key={width} className="h-1 rounded bg-slate-300" style={{ width }} />)}</div>
        </div>
        <div className="mt-6 space-y-1.5">
          {Array.from({ length: small ? 5 : 10 }).map((_, index) => <div key={index} className="h-1 rounded bg-slate-200" />)}
        </div>
        <p className="mt-4 truncate text-[9px] font-semibold text-slate-500">{template.name}</p>
      </div>
    </div>
  );
}

function PageHero({ title, subtitle, tooltip, children }: { title: string; subtitle: string; tooltip?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-slate-200 bg-white px-4 py-5 xl:px-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800"><BookIcon /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[32px] font-semibold leading-9 tracking-normal text-slate-950">{title}</h1>
              {tooltip ? <InfoTooltip label={`About ${title}`}>{tooltip}</InfoTooltip> : null}
            </div>
            <p className="mt-1 text-[13px] text-slate-600">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </section>
  );
}

function CategoryTabs({ category, setCategory }: { category: string; setCategory: (category: string) => void }) {
  const tabs = ["ALL", ...CATEGORIES];
  return (
    <div className="border-b border-slate-200 bg-white px-4 xl:px-7">
      <div className="flex gap-4 overflow-x-auto">
        {tabs.map((tab) => <button key={tab} type="button" onClick={() => setCategory(tab)} className={["h-12 shrink-0 border-b-2 px-1 text-[11px] font-semibold uppercase tracking-wide", category === tab ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-950"].join(" ")}>{tab === "ALL" ? "All Templates" : tab.replaceAll("_", " ")}</button>)}
      </div>
    </div>
  );
}

function MiniDocument({ html, emptyText = "No document content available.", showLetterhead = true, branding = DEFAULT_BRANDING_SETTINGS }: { html: string; emptyText?: string; showLetterhead?: boolean; branding?: BrandingSettings }) {
  if (!showLetterhead) {
    // Used when wrapped by LetterPreviewHeader/Footer — no standalone card, no internal letterhead
    if (!html.trim()) return <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p>;
    return <div className="prose prose-sm max-w-none [&_p]:my-2" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (!html.trim()) return <div className="mx-auto flex min-h-[420px] max-w-[330px] items-center justify-center bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">{emptyText}</div>;
  return (
    <div className="mx-auto h-[520px] max-w-[360px] overflow-hidden">
      <div className="origin-top-left scale-[0.44]" style={{ width: 816 }}>
        <LetterPage
          branding={branding}
          title="Mini letter preview"
          subject=""
          salutation={null}
          bodyHtml={html}
          marginTop={0.7}
          marginRight={0.7}
          marginBottom={0.6}
          marginLeft={0.7}
        />
      </div>
    </div>
  );
}

function SettingsCard({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="block rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:shadow-md">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </Link>
  );
}

function SetupCard({ title, iconName, children }: { title: string; iconName?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {iconName ? <img src={`/icons/oyama-letters/${iconName}.svg`} alt="" className="h-4 w-4" /> : null}
        <p className="text-[12px] font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "green" | "orange" | "red" }) {
  const color = tone === "green" ? "text-emerald-800" : tone === "orange" ? "text-orange-600" : tone === "red" ? "text-red-600" : "text-slate-950";
  return <div><p className="text-sm text-slate-600">{label}</p><p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p></div>;
}

function SummaryNumber({ label, value, tone = "green" }: { label: string; value: string; tone?: "green" | "orange" | "red" | "slate" }) {
  const valueClass = tone === "red"
    ? "text-red-600"
    : tone === "orange"
      ? "text-orange-600"
      : tone === "slate"
        ? "text-slate-950"
        : "text-emerald-800";
  return <div><p className="text-xs text-slate-600">{label}</p><p className={`mt-2 text-3xl font-semibold ${valueClass}`}>{value}</p></div>;
}

function SummaryStatusRow({ label, count, tone }: { label: string; count: number; tone: "green" | "orange" | "red" | "slate" }) {
  const iconClass = tone === "green"
    ? "text-emerald-700"
    : tone === "orange"
      ? "text-orange-600"
      : tone === "red"
        ? "text-red-600"
        : "text-slate-500";

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={iconClass}>
          {tone === "green" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M6 12.5l3.5 3.5L18 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : tone === "orange" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
              <path d="M12 8v4" strokeLinecap="round" />
              <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          ) : tone === "red" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 4 3 19h18L12 4Z" strokeLinejoin="round" />
              <path d="M12 10v4" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span className="font-semibold text-slate-700">{label}</span>
      </div>
      <span className="font-semibold text-slate-900">{count}</span>
    </div>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

function RibbonButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="h-10 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50">{children}</button>;
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative flex h-[84px] shrink-0 flex-col justify-between px-2 py-1">
      <div className="flex items-start gap-1.5">{children}</div>
      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <span className="absolute bottom-1 top-1 -right-1 w-px bg-slate-200" aria-hidden="true" />
    </div>
  );
}

function RibbonToolButton({ glyph, iconName, label, onClick }: { glyph: string; iconName?: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[58px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-700 hover:bg-emerald-50"
    >
      {iconName ? <LettersPackIcon name={iconName} className="h-[18px] w-[18px]" fallback={glyph} /> : <span className="text-base leading-none text-slate-800">{glyph}</span>}
      <span className="leading-none text-[10px]">{label}</span>
    </button>
  );
}

function LettersPackIcon({ name, className, fallback }: { name: string; className: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-base leading-none text-slate-800">{fallback}</span>;
  return <img src={`/icons/oyama-letters/${name}.svg`} alt="" className={className} onError={() => setFailed(true)} />;
}

function EditorRuler({ pageWidth, leftGutter = 0 }: { pageWidth: number; leftGutter?: number }) {
  const marks = Math.floor(pageWidth / RULER_PX_PER_INCH);
  return (
    <div className="mx-auto mb-3 flex h-7 w-[900px] max-w-full items-stretch rounded-sm border border-slate-200 bg-white shadow-sm">
      {leftGutter > 0 ? <div className="shrink-0 border-r border-slate-200" style={{ width: leftGutter }} /> : null}
      <div
        className="relative h-full"
        style={{
          width: pageWidth,
          backgroundImage: "repeating-linear-gradient(to right, rgba(100,116,139,0.2) 0, rgba(100,116,139,0.2) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(to right, rgba(71,85,105,0.4) 0, rgba(71,85,105,0.4) 1px, transparent 1px, transparent 96px)",
        }}
      >
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: marks }).map((_, index) => (
            <span key={index} className="absolute bottom-0.5 -translate-x-1/2 text-[10px] font-semibold text-slate-500" style={{ left: `${(index + 1) * RULER_PX_PER_INCH}px` }}>
              {index + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorVerticalRuler({ pageHeight }: { pageHeight: number }) {
  const marks = Math.floor(pageHeight / RULER_PX_PER_INCH);

  return (
    <div
      className="relative mt-1 w-7 shrink-0 rounded-sm border border-slate-200 bg-white shadow-sm"
      style={{ height: pageHeight }}
    >
      <div
        className="absolute inset-0"
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, rgba(100,116,139,0.2) 0, rgba(100,116,139,0.2) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(to bottom, rgba(71,85,105,0.4) 0, rgba(71,85,105,0.4) 1px, transparent 1px, transparent 96px)",
      }}
      />
      {Array.from({ length: marks }).map((_, index) => (
        <span key={index} className="absolute left-1 top-0 -translate-y-1/2 text-[10px] font-semibold text-slate-500" style={{ top: `${(index + 1) * RULER_PX_PER_INCH}px` }}>
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function InspectorCard({ title, tooltip, children }: { title: string; tooltip?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {tooltip ? <InfoTooltip label={`About ${title}`}>{tooltip}</InfoTooltip> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Button({ children, href, onClick, tone = "default", disabled = false }: { children: ReactNode; href?: string; onClick?: () => void; tone?: "default" | "primary"; disabled?: boolean }) {
  const className = ["inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", tone === "primary" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"].join(" ");
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={className}>{children}</button>;
}

function TopLink({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return <Link href={href} className={["inline-flex h-10 items-center rounded-md px-3 text-xs font-semibold", active ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "text-slate-700 hover:bg-slate-50"].join(" ")}>{label}</Link>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-80" />;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800">{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>;
}

function LabeledSelect({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal">
        {options.map((option) => <option key={option || "none"} value={option}>{labels[option] ?? (option ? option.replaceAll("_", " ") : "None")}</option>)}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <input type="number" min={0.25} max={2.5} step={0.25} value={value} onChange={(event) => onChange(Number(event.target.value) || 1)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal" />
    </label>
  );
}

function TableNumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Math.min(max, Math.max(min, Number.isFinite(parsed) ? Math.round(parsed) : min)));
        }}
        className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal"
      />
    </label>
  );
}

function SnippetButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50">{children}</button>;
}

function MiniPresetCard({ title, body, action }: { title: string; body: string; action?: () => void }) {
  const content = (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left">
      <p className="truncate text-xs font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{body}</p>
    </div>
  );
  if (!action) return content;
  return <button type="button" onClick={action} className="block w-full">{content}</button>;
}

function IconToggle({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className={["flex h-11 w-11 items-center justify-center rounded-md border text-lg", active ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700"].join(" ")}>{children}</button>;
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "orange" | "red" | "slate" }) {
  const normalized = label.toLowerCase();
  const explicit =
    normalized.includes("published") || normalized.includes("valid") || normalized.includes("known") || normalized.includes("good")
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : normalized.includes("draft")
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : normalized.includes("missing") || normalized.includes("unknown") || normalized.includes("suppressed")
          ? "border-red-200 bg-red-50 text-red-700"
          : null;
  const fallback = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "orange"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold leading-4 ${explicit ?? fallback}`}>{label}</span>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={["h-12 border-b-2 text-sm font-semibold", active ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"].join(" ")}>{children}</button>;
}

function Alert({ children, tone }: { children: ReactNode; tone: "amber" | "green" }) {
  return <div className={`mx-4 mt-4 rounded-md border px-4 py-3 text-sm xl:mx-6 ${tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{children}</div>;
}

function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref: string; actionLabel: string }) {
  return <div className="m-6 rounded-md border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-semibold">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">{body}</p><Button href={actionHref} tone="primary">{actionLabel}</Button></div>;
}

function WorkflowShortcutCard({ title, body, href, actionLabel }: { title: string; body: string; href: string; actionLabel: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <div className="mt-4">
        <Button href={href}>{actionLabel}</Button>
      </div>
    </div>
  );
}

function LoadingPage({ label }: { label: string }) {
  return <div className="flex min-h-[420px] items-center justify-center text-sm font-semibold text-slate-500">{label}</div>;
}

function LoadingGrid() {
  return <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 xl:p-6">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-md bg-slate-100" />)}</div>;
}

function LoadingRows() {
  return <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />)}</div>;
}

function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true"><path d="M16 29c-1.8-4.6-1.3-8.4 1.5-11.4C20 15 23.4 13.8 28 14c-.5 4.4-2.4 7.7-5.6 9.8-2 1.3-4.1 1.8-6.4 1.6V29Z" /><path d="M14.6 28.5c-4.2-1.8-7.1-4.5-8.5-8C4.8 17.2 5 13.6 6.7 9.6c3.8 1.9 6.5 4.5 7.9 7.9 1.4 3.3 1.4 7 0 11Z" /><path d="M15.8 16.5c-2.2-3.1-2.9-6.1-2-9C14.7 4.7 16.7 2.2 20 0c2 3.5 2.5 6.7 1.5 9.6-.9 2.8-2.8 5.1-5.7 6.9Z" /></svg>;
}

function LineIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    "Template Library": "M6 3h10l4 4v14H6V3Zm4 9h6m-6 4h6",
    "Generate Letters": "M4 7h16M4 12h10M4 17h16",
    "Print & Mail Queue": "M6 9V3h12v6M6 17H4v-6h16v6h-2M7 14h10v7H7v-7Z",
    Batches: "M5 19h14M8 16V9m4 7V5m4 11v-4",
    "Letters How To": "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm0 0A2.5 2.5 0 0 1 6.5 8H20M9 12h6m-6 4h4",
    Settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-12v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3",
  };
  return <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={paths[name] ?? paths["Template Library"]} /></svg>;
}

function BookIcon() {
  return <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm0 0A2.5 2.5 0 0 1 6.5 8H20M8 7v8l3-2 3 2V7" /></svg>;
}

function ChevronLeft() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" /></svg>;
}

function ChevronRight() {
  return <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>;
}

function CheckIcon() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function safeDownloadName(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "template";
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function templateRecoverySlot(templateId: string | null | undefined): string {
  return templateId?.trim() || "__new__";
}

function draftDiffers(a: TemplateDraft, b: TemplateDraft): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function markLetterHtmlAsAiAssisted(value: string): string {
  if (value.includes(LETTER_TEMPLATE_AI_ASSISTED_MARKER)) return value;
  return `<!-- ${LETTER_TEMPLATE_AI_ASSISTED_MARKER} -->${value}`;
}

function readRecoveryStorage(): Record<string, TemplateRecoverySnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LETTERS_TEMPLATE_RECOVERY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, TemplateRecoverySnapshot>;
  } catch {
    return {};
  }
}

function writeRecoveryStorage(next: Record<string, TemplateRecoverySnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LETTERS_TEMPLATE_RECOVERY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write failures in private mode or quota limits.
  }
}

function readTemplateRecoverySnapshot(templateId: string | null | undefined): TemplateRecoverySnapshot | null {
  const storage = readRecoveryStorage();
  const slot = templateRecoverySlot(templateId);
  return storage[slot] ?? null;
}

function writeTemplateRecoverySnapshot(templateId: string | null | undefined, draft: TemplateDraft, lastError: string | null): void {
  const slot = templateRecoverySlot(templateId);
  const storage = readRecoveryStorage();
  storage[slot] = {
    templateId: templateId ?? null,
    draft,
    lastError,
    updatedAt: new Date().toISOString(),
  };
  writeRecoveryStorage(storage);
}

function clearTemplateRecoverySnapshot(templateId: string | null | undefined): void {
  const slot = templateRecoverySlot(templateId);
  const storage = readRecoveryStorage();
  if (!(slot in storage)) return;
  delete storage[slot];
  writeRecoveryStorage(storage);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

function readTemporaryRecipientList(id: string): TemporaryRecipientList | null {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`oyama-letters:temporary-recipient-list:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TemporaryRecipientList>;
    const constituentIds = Array.isArray(parsed.constituentIds)
      ? Array.from(new Set(parsed.constituentIds.map((value) => String(value).trim()).filter(Boolean)))
      : [];
    if (constituentIds.length === 0) return null;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : `Temporary recipient list (${constituentIds.length})`,
      constituentIds,
      donationIds: Array.isArray(parsed.donationIds) ? parsed.donationIds.map((value) => String(value)).filter(Boolean) : [],
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function htmlToPlainTextClient(value: string): string {
  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.innerHTML = value;
    return (element.textContent ?? "").trim();
  }
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeClientFileName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "generated_letter";
}

function countWords(value: string): number {
  const plain = value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

function headerPresetToDraft(header: HeaderPreset | null): HeaderPresetDraft {
  if (!header) return EMPTY_HEADER_PRESET;
  return {
    name: header.name,
    logoAlignment: header.logoAlignment || "LEFT",
    showOrganizationName: Boolean(header.showOrganizationName),
    showTagline: Boolean(header.showTagline),
    showAddress: Boolean(header.showAddress),
    showPhone: Boolean(header.showPhone),
    showWebsite: Boolean(header.showWebsite),
    customHtml: header.customHtml ?? "",
    isDefault: Boolean(header.isDefault),
    isActive: Boolean(header.isActive),
  };
}

function footerPresetToDraft(footer: FooterPreset | null): FooterPresetDraft {
  if (!footer) return EMPTY_FOOTER_PRESET;
  return {
    name: footer.name,
    showOrganizationName: Boolean(footer.showOrganizationName),
    showAddress: Boolean(footer.showAddress),
    showPhone: Boolean(footer.showPhone),
    showEmail: Boolean(footer.showEmail),
    showWebsite: Boolean(footer.showWebsite),
    showTaxId: Boolean(footer.showTaxId),
    showPageNumber: Boolean(footer.showPageNumber),
    customText: footer.customText ?? "",
    customHtml: footer.customHtml ?? "",
    isDefault: Boolean(footer.isDefault),
    isActive: Boolean(footer.isActive),
  };
}

function ensureEditorSelection(editor: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) return;
  }
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

const CANONICAL_LETTER_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([^}]+?))?\s*\}\}/g;
const SIMPLE_LETTER_TOKEN_PATTERN = /(^|[^{])\{\s*([a-zA-Z][a-zA-Z0-9_]*)(?:\s*\|\s*([^}]+?))?\s*\}(?!\})/g;
const SLASH_LETTER_TOKEN_PATTERN = /(^|[\s([>])\/\/([a-zA-Z][a-zA-Z0-9_]*)(?![\w/])/g;

function extractTokens(value: string): string[] {
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;

  CANONICAL_LETTER_TOKEN_PATTERN.lastIndex = 0;
  while ((match = CANONICAL_LETTER_TOKEN_PATTERN.exec(value)) !== null) {
    const key = match[1]?.trim();
    if (key) tokens.add(`{{${key}}}`);
  }

  SIMPLE_LETTER_TOKEN_PATTERN.lastIndex = 0;
  while ((match = SIMPLE_LETTER_TOKEN_PATTERN.exec(value)) !== null) {
    const key = match[2]?.trim();
    if (key) tokens.add(`{${key}}`);
  }

  SLASH_LETTER_TOKEN_PATTERN.lastIndex = 0;
  while ((match = SLASH_LETTER_TOKEN_PATTERN.exec(value)) !== null) {
    const key = match[2]?.trim();
    if (key) tokens.add(`//${key}`);
  }

  return Array.from(tokens);
}

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    const key = trimmed.slice(2, -2).split("|")[0]?.trim().replace(/\s+/g, "") ?? "";
    return `{{${key}}}`;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const key = trimmed.slice(1, -1).split("|")[0]?.trim().replace(/\s+/g, "") ?? "";
    return `{${key}}`;
  }
  if (trimmed.startsWith("//")) return trimmed.replace(/\s+/g, "");
  return trimmed.replace(/\s+/g, "");
}

function decorateMergeTokens(html: string, registry: Set<string>): string {
  const renderBadge = (token: string): string => {
    const known = registry.has(normalizeToken(token));
    const className = known ? "merge-token-badge" : "merge-token-badge merge-token-badge-unknown";
    const label = known ? "Known merge field" : "Unknown merge field";
    return `<span class="${className}" title="${label}">${escapeHtml(token)}</span>`;
  };

  return html
    .replace(CANONICAL_LETTER_TOKEN_PATTERN, (match: string) => renderBadge(match))
    .replace(SIMPLE_LETTER_TOKEN_PATTERN, (match: string, prefix: string) => `${prefix}${renderBadge(match.slice(prefix.length))}`)
    .replace(SLASH_LETTER_TOKEN_PATTERN, (_match, prefix: string, key: string) => `${prefix}${renderBadge(`//${String(key || "").trim()}`)}`);
}

function extractLineForToken(html: string, token: string): string {
  const normalizedToken = normalizeToken(token);
  const plain = htmlToPlainTextClient(html)
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matching = plain.find((line) => extractTokens(line).some((candidate) => normalizeToken(candidate) === normalizedToken));
  return matching || token;
}

function tokenSource(token: string): string {
  const inner = token.replace(/[{}]/g, "").trim();
  return titleCase(inner.split(".")[0] || "unknown");
}

function titleFromId(id: string): string {
  return id.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function viewLabel(view: WorkspaceView): string {
  if (view === "library") return "Template Library";
  if (view === "builder") return "Canvas Builder";
  if (view === "publish") return "Publish Workspace";
  if (view === "generate") return "Generate Letters";
  if (view === "queue") return "Print & Mail Queue";
  if (view === "howto") return "Letters How To";
  return "Settings";
}

function titleCase(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pageSizeToMetrics(value: string): { width: number; height: number } {
  if (value.includes("Legal")) return { width: 816, height: 1344 };
  if (value.includes("A4")) return { width: 794, height: 1123 };
  return { width: 816, height: 1056 };
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function personName(row: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  entityKind?: string | null;
  type?: string | null;
  id?: string;
}): string {
  const name = getConstituentDisplayName(row);
  if (name !== "Unnamed Constituent" && name !== "Unnamed Organization") return name;
  return row.id || "Unknown";
}

function hasRecipientName(row: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  entityKind?: string | null;
  type?: string | null;
}): boolean {
  const name = getConstituentDisplayName(row);
  return name !== "Unnamed Constituent" && name !== "Unnamed Organization";
}

function recipientSearchText(
  row: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    organizationName?: string | null;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  },
  addressText?: string,
): string {
  return [
    personName(row),
    row.contactFirstName,
    row.contactLastName,
    row.email,
    row.addressLine1,
    row.city,
    row.state,
    row.zip,
    addressText,
  ].join(" ").toLowerCase();
}

function formatAddress(row: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; zip?: string | null }): string {
  return [row.addressLine1, row.addressLine2, [row.city, row.state, row.zip].filter(Boolean).join(", ").replace(", ", " ")].filter(Boolean).join(", ");
}

function hasAddress(row: { addressLine1?: string | null; city?: string | null; state?: string | null; zip?: string | null }): boolean {
  return Boolean(row.addressLine1?.trim() && row.city?.trim() && row.state?.trim() && row.zip?.trim());
}

function formatDonation(row: DonationLookup): string {
  const amount = Number(row.amount);
  const money = Number.isFinite(amount) ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" }) : String(row.amount);
  return `${money} - ${donationDateLabel(row)}`;
}

function donationDateLabel(row: DonationLookup): string {
  return row.dateLabel?.trim() || formatDonationDate(row.date);
}
