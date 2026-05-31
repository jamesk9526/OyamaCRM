/**
 * Steward Paths V2 Path Library command center.
 * One-direction workflow: Library -> Builder -> Review/Publish -> Enrollments -> Activity -> Analytics.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContextualRibbon from "@/app/components/ui/crm/ribbon/ContextualRibbon";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardPathTemplate {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  triggerType: string;
  targetType: string;
  crmScope: string;
  updatedAt: string;
  createdAt: string;
  steps: Array<{ id: string; stepType: string; isActive: boolean }>;
  _count?: { enrollments: number };
  triggerConfig?: Record<string, unknown> | null;
}

interface StewardEnrollment {
  id: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED" | string;
  pathId: string;
  updatedAt: string;
  startedAt: string;
}

interface PathRunStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  lastRunAt: string | null;
}

type StatusFilter =
  | "ALL"
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "PUBLISHED"
  | "ACTIVE"
  | "PAUSED"
  | "ERRORED"
  | "ARCHIVED";

type OwnerFilter = "all" | "private" | "shared";
type SortMode = "updated" | "name" | "enrollments" | "errors";

type PathCategoryKey =
  | "new-donor-welcome"
  | "donation-follow-up"
  | "lapsed-donor-recovery"
  | "event-follow-up"
  | "major-donor-stewardship"
  | "monthly-donor-care"
  | "volunteer-follow-up"
  | "campaign-follow-up"
  | "custom";

type CategoryFilter = "all" | PathCategoryKey;

type StartMode = "scratch" | "template" | "duplicate" | "import";

type TemplatePreset = "none" | "donor-welcome" | "lapsed-reengagement" | "event-follow-up";

interface CreatePathDraft {
  mode: StartMode;
  name: string;
  purpose: string;
  category: PathCategoryKey;
  ownerLabel: string;
  startingTrigger: string;
  description: string;
  templatePreset: TemplatePreset;
  duplicateSourcePathId: string;
}

interface NewPathSeedStep {
  name: string;
  description: string;
  stepType: "DELAY" | "CREATE_TASK" | "GENERATE_LETTER" | "DRAFT_EMAIL" | "SEND_EMAIL" | "MANUAL_ACTION" | "INTERNAL_NOTE" | "STATUS_CHANGE" | "BRANCH_PLACEHOLDER";
  configJson?: Record<string, unknown>;
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ERRORED", label: "Errored" },
  { value: "ARCHIVED", label: "Archived" },
];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "new-donor-welcome", label: "New Donor Welcome" },
  { value: "donation-follow-up", label: "Donation Follow-Up" },
  { value: "lapsed-donor-recovery", label: "Lapsed Donor Recovery" },
  { value: "event-follow-up", label: "Event Follow-Up" },
  { value: "major-donor-stewardship", label: "Major Donor Stewardship" },
  { value: "monthly-donor-care", label: "Monthly Donor Care" },
  { value: "volunteer-follow-up", label: "Volunteer Follow-Up" },
  { value: "campaign-follow-up", label: "Campaign Follow-Up" },
  { value: "custom", label: "Custom" },
];

const TRIGGER_OPTIONS = [
  { value: "MANUAL", label: "Manual Enrollment" },
  { value: "DONATION_RECEIVED", label: "Gift Received" },
  { value: "FIRST_TIME_DONOR", label: "First-Time Donor" },
  { value: "DONOR_LAPSED", label: "Lapsed Donor" },
  { value: "EVENT_ATTENDED", label: "Event Attended" },
  { value: "TAG_ADDED", label: "Tag Added" },
  { value: "STATUS_CHANGED", label: "Status Changed" },
];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function percentage(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function readVisibility(item: StewardPathTemplate): "private" | "organization" | "admins" {
  const cfg = item.triggerConfig;
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return "private";
  const sharing = (cfg as Record<string, unknown>)._sharing;
  if (!sharing || typeof sharing !== "object" || Array.isArray(sharing)) return "private";
  const visibility = (sharing as Record<string, unknown>).visibility;
  if (visibility === "organization" || visibility === "admins") return visibility;
  return "private";
}

function readOwnerLabel(item: StewardPathTemplate): string {
  const cfg = item.triggerConfig;
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return "Private";
  const sharing = (cfg as Record<string, unknown>)._sharing;
  if (!sharing || typeof sharing !== "object" || Array.isArray(sharing)) return "Private";
  const payload = sharing as Record<string, unknown>;
  const ownerUserId = typeof payload.ownerUserId === "string" ? payload.ownerUserId : "";
  const visibility = readVisibility(item);
  if (ownerUserId) return `Owner ${ownerUserId.slice(0, 8)}`;
  return visibility === "private" ? "Private" : "Shared";
}

function derivePathCategory(path: StewardPathTemplate): PathCategoryKey {
  const haystack = `${path.name} ${path.description ?? ""} ${path.triggerType} ${path.targetType}`.toLowerCase();
  if (haystack.includes("welcome") || haystack.includes("first-time") || haystack.includes("first time")) return "new-donor-welcome";
  if (haystack.includes("lapsed") || haystack.includes("re-engage") || haystack.includes("reengage")) return "lapsed-donor-recovery";
  if (haystack.includes("event") || haystack.includes("attendee")) return "event-follow-up";
  if (haystack.includes("major")) return "major-donor-stewardship";
  if (haystack.includes("monthly") || haystack.includes("recurring")) return "monthly-donor-care";
  if (haystack.includes("volunteer")) return "volunteer-follow-up";
  if (haystack.includes("campaign")) return "campaign-follow-up";
  if (haystack.includes("donation") || haystack.includes("gift")) return "donation-follow-up";
  return "custom";
}

function categoryLabel(category: PathCategoryKey): string {
  const option = CATEGORY_OPTIONS.find((item) => item.value === category);
  return option?.label ?? "Custom";
}

function statusChipClass(statusFilter: StatusFilter): string {
  if (statusFilter === "ACTIVE" || statusFilter === "PUBLISHED") return "bg-emerald-100 text-emerald-800";
  if (statusFilter === "PAUSED" || statusFilter === "NEEDS_REVIEW") return "bg-amber-100 text-amber-800";
  if (statusFilter === "ERRORED") return "bg-rose-100 text-rose-800";
  if (statusFilter === "ARCHIVED") return "bg-slate-200 text-slate-700";
  if (statusFilter === "DRAFT") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(path: StewardPathTemplate, stats: PathRunStats): StatusFilter {
  if (path.status === "ARCHIVED") return "ARCHIVED";
  if (stats.failed > 0) return "ERRORED";
  if (path.status === "ACTIVE") return "ACTIVE";
  if (path.status === "PAUSED") return "PAUSED";
  if (path.status === "DRAFT") return "DRAFT";
  return "DRAFT";
}

function matchesStatusFilter(path: StewardPathTemplate, stats: PathRunStats, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "DRAFT") return path.status === "DRAFT";
  if (filter === "NEEDS_REVIEW") return path.status === "DRAFT" || path.status === "PAUSED";
  if (filter === "PUBLISHED") return path.status === "ACTIVE";
  if (filter === "ACTIVE") return path.status === "ACTIVE";
  if (filter === "PAUSED") return path.status === "PAUSED";
  if (filter === "ERRORED") return stats.failed > 0;
  return path.status === "ARCHIVED";
}

function defaultTargetTypeForCategory(category: PathCategoryKey): StewardPathTemplate["targetType"] {
  if (category === "event-follow-up") return "EVENT_ATTENDEE";
  if (category === "volunteer-follow-up") return "CONSTITUENT";
  return "DONOR";
}

function initialCreateDraft(): CreatePathDraft {
  return {
    mode: "scratch",
    name: "",
    purpose: "",
    category: "new-donor-welcome",
    ownerLabel: "",
    startingTrigger: "MANUAL",
    description: "",
    templatePreset: "donor-welcome",
    duplicateSourcePathId: "",
  };
}

function buildTemplateSeedSteps(preset: TemplatePreset): NewPathSeedStep[] {
  if (preset === "donor-welcome") {
    return [
      {
        name: "Wait 2 days",
        description: "Delay before first personalized outreach.",
        stepType: "DELAY",
        configJson: { amount: 2, unit: "days" },
      },
      {
        name: "Draft thank-you email",
        description: "Prepare a stewardship thank-you draft for review.",
        stepType: "DRAFT_EMAIL",
        configJson: {
          subjectTemplate: "Thank you for your first gift, {{firstName}}",
          bodyTemplate: "Hi {{firstName}},\n\nThank you for supporting our mission.",
        },
      },
      {
        name: "Create welcome call task",
        description: "Assign a welcome call follow-up task.",
        stepType: "CREATE_TASK",
        configJson: {
          titleTemplate: "Call donor to thank them for first gift",
          priority: "MEDIUM",
        },
      },
    ];
  }

  if (preset === "lapsed-reengagement") {
    return [
      {
        name: "Wait 7 days",
        description: "Hold before re-engagement outreach.",
        stepType: "DELAY",
        configJson: { amount: 7, unit: "days" },
      },
      {
        name: "Branch by engagement",
        description: "Route by donor engagement profile.",
        stepType: "BRANCH_PLACEHOLDER",
        configJson: { field: "engagementScore" },
      },
      {
        name: "Draft re-engagement email",
        description: "Prepare tailored re-engagement message.",
        stepType: "DRAFT_EMAIL",
        configJson: {
          subjectTemplate: "We miss you, {{firstName}}",
          bodyTemplate: "Hi {{firstName}},\n\nWe would love to reconnect.",
        },
      },
      {
        name: "Create major donor task",
        description: "Escalate follow-up for higher-value donors.",
        stepType: "CREATE_TASK",
        configJson: {
          titleTemplate: "Follow up with lapsed donor",
          priority: "HIGH",
        },
      },
    ];
  }

  if (preset === "event-follow-up") {
    return [
      {
        name: "Wait 1 day",
        description: "Allow post-event processing window.",
        stepType: "DELAY",
        configJson: { amount: 1, unit: "days" },
      },
      {
        name: "Draft post-event email",
        description: "Prepare event follow-up draft.",
        stepType: "DRAFT_EMAIL",
        configJson: {
          subjectTemplate: "Thanks for attending",
          bodyTemplate: "Thank you for joining us at the event.",
        },
      },
      {
        name: "Generate follow-up letter",
        description: "Prepare print follow-up for attendees.",
        stepType: "GENERATE_LETTER",
        configJson: { templateName: "Event Follow-up" },
      },
    ];
  }

  return [];
}

interface PathCardActionsMenuProps {
  path: StewardPathTemplate;
  stats: PathRunStats;
  busy: boolean;
  onPublish: () => void;
  onPause: () => void;
  onResume: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}

function PathCardActionsMenu({
  path,
  stats,
  busy,
  onPublish,
  onPause,
  onResume,
  onDuplicate,
  onArchive,
}: PathCardActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  const canPublish = path.status !== "ACTIVE" && path.status !== "ARCHIVED" && path.steps.length > 0;
  const canEnroll = path.status === "ACTIVE";
  const canResume = path.status === "PAUSED" && stats.failed === 0;
  const canPause = path.status === "ACTIVE";
  const canArchive = path.status !== "ARCHIVED";

  function runAction(handler: () => void) {
    if (busy) return;
    setOpen(false);
    handler();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${path.name}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5h.01M12 12h.01M12 19h.01" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-200/70" role="menu">
          <Link
            href={`/steward-paths/${encodeURIComponent(path.id)}/builder`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            Open Builder
          </Link>
          <Link
            href={`/steward-paths/${encodeURIComponent(path.id)}/review`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            Review and Validate
          </Link>

          <button
            type="button"
            onClick={() => runAction(onPublish)}
            disabled={busy || !canPublish}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            role="menuitem"
            title={
              canPublish
                ? "Publish path"
                : path.status === "ACTIVE"
                  ? "Path is already published and active."
                  : path.status === "ARCHIVED"
                    ? "Archived paths cannot be published."
                    : "Publishing requires at least one configured step."
            }
          >
            Publish Path
          </button>

          <Link
            href={canEnroll ? `/steward-paths/${encodeURIComponent(path.id)}/enrollments` : "#"}
            onClick={(event) => {
              if (!canEnroll) {
                event.preventDefault();
                return;
              }
              setOpen(false);
            }}
            className={`block rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              canEnroll
                ? "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                : "cursor-not-allowed text-slate-400"
            }`}
            role="menuitem"
            title={canEnroll ? "Manage enrollments" : "Enroll Donors is available after publish/activation."}
          >
            Enroll Donors
          </Link>

          {canPause ? (
            <button
              type="button"
              onClick={() => runAction(onPause)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              role="menuitem"
            >
              Pause Path
            </button>
          ) : null}

          {path.status === "PAUSED" ? (
            <button
              type="button"
              onClick={() => runAction(onResume)}
              disabled={busy || !canResume}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              role="menuitem"
              title={canResume ? "Resume path" : "Resume disabled: resolve failed enrollments first."}
            >
              Resume Path
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => runAction(onDuplicate)}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            role="menuitem"
          >
            Duplicate Path
          </button>

          <Link
            href={`/steward-paths/${encodeURIComponent(path.id)}/activity`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            View Activity
          </Link>
          <Link
            href={`/steward-paths/${encodeURIComponent(path.id)}/analytics`}
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            role="menuitem"
          >
            View Analytics
          </Link>

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => runAction(onArchive)}
            disabled={busy || !canArchive}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            role="menuitem"
            title={canArchive ? "Archive path" : "Path is already archived."}
          >
            Archive Path
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface StewardPathsWorkspaceV2PageProps {
  initialOpenCreate?: boolean;
}

export default function StewardPathsWorkspaceV2Page({
  initialOpenCreate = false,
}: StewardPathsWorkspaceV2PageProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [paths, setPaths] = useState<StewardPathTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<StewardEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPathId, setBusyPathId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");

  const [createOpen, setCreateOpen] = useState(initialOpenCreate);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<CreatePathDraft>(() => initialCreateDraft());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, enrollmentRows] = await Promise.all([
        apiFetch<StewardPathTemplate[]>("/api/steward-paths/templates"),
        apiFetch<StewardEnrollment[]>("/api/steward-paths/enrollments?limit=500").catch(() => []),
      ]);
      setPaths(Array.isArray(templateRows) ? templateRows : []);
      setEnrollments(Array.isArray(enrollmentRows) ? enrollmentRows : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Steward Paths data.");
      setPaths([]);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function syncCreateModalFromUrl() {
      const isOpen = new URLSearchParams(window.location.search).get("create") === "1";
      setCreateOpen(isOpen);
    }

    syncCreateModalFromUrl();
    window.addEventListener("popstate", syncCreateModalFromUrl);
    return () => {
      window.removeEventListener("popstate", syncCreateModalFromUrl);
    };
  }, [initialOpenCreate]);

  const pathStatsById = useMemo(() => {
    const map = new Map<string, PathRunStats>();
    for (const enrollment of enrollments) {
      const existing = map.get(enrollment.pathId) ?? {
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        lastRunAt: null,
      };
      existing.total += 1;
      if (enrollment.status === "ACTIVE") existing.active += 1;
      if (enrollment.status === "COMPLETED") existing.completed += 1;
      if (enrollment.status === "FAILED") existing.failed += 1;

      if (!existing.lastRunAt || new Date(enrollment.updatedAt).getTime() > new Date(existing.lastRunAt).getTime()) {
        existing.lastRunAt = enrollment.updatedAt;
      }

      map.set(enrollment.pathId, existing);
    }
    return map;
  }, [enrollments]);

  const visiblePaths = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    const filtered = paths.filter((path) => {
      const stats = pathStatsById.get(path.id) ?? { total: 0, active: 0, completed: 0, failed: 0, lastRunAt: null };
      const category = derivePathCategory(path);

      if (!matchesStatusFilter(path, stats, statusFilter)) return false;
      if (categoryFilter !== "all" && category !== categoryFilter) return false;

      if (ownerFilter !== "all") {
        const visibility = readVisibility(path);
        if (ownerFilter === "private" && visibility !== "private") return false;
        if (ownerFilter === "shared" && visibility === "private") return false;
      }

      if (!needle) return true;
      return path.name.toLowerCase().includes(needle)
        || (path.description ?? "").toLowerCase().includes(needle)
        || path.triggerType.toLowerCase().includes(needle)
        || path.targetType.toLowerCase().includes(needle)
        || categoryLabel(category).toLowerCase().includes(needle);
    });

    return filtered.sort((a, b) => {
      const aStats = pathStatsById.get(a.id) ?? { total: 0, active: 0, completed: 0, failed: 0, lastRunAt: null };
      const bStats = pathStatsById.get(b.id) ?? { total: 0, active: 0, completed: 0, failed: 0, lastRunAt: null };

      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "enrollments") return bStats.total - aStats.total;
      if (sortMode === "errors") return bStats.failed - aStats.failed;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [categoryFilter, ownerFilter, pathStatsById, paths, searchQuery, sortMode, statusFilter]);

  const totalEnrollments = useMemo(() => enrollments.length, [enrollments]);
  const activeEnrollments = useMemo(() => enrollments.filter((item) => item.status === "ACTIVE").length, [enrollments]);
  const completedEnrollments = useMemo(() => enrollments.filter((item) => item.status === "COMPLETED").length, [enrollments]);
  const erroredEnrollments = useMemo(() => enrollments.filter((item) => item.status === "FAILED").length, [enrollments]);

  const activeCount = useMemo(() => paths.filter((path) => path.status === "ACTIVE").length, [paths]);
  const draftCount = useMemo(() => paths.filter((path) => path.status === "DRAFT").length, [paths]);
  const pausedCount = useMemo(() => paths.filter((path) => path.status === "PAUSED").length, [paths]);
  const archivedCount = useMemo(() => paths.filter((path) => path.status === "ARCHIVED").length, [paths]);
  const reviewCount = useMemo(() => paths.filter((path) => path.status === "DRAFT" || path.status === "PAUSED").length, [paths]);

  const recentActivity = useMemo(() => {
    return [...paths]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);
  }, [paths]);

  const duplicateCandidates = useMemo(() => paths.filter((path) => path.status !== "ARCHIVED"), [paths]);

  const hasActiveFilters = searchQuery.trim().length > 0
    || statusFilter !== "ALL"
    || categoryFilter !== "all"
    || ownerFilter !== "all"
    || sortMode !== "updated";

  async function updatePathStatus(path: StewardPathTemplate, nextStatus: "ACTIVE" | "PAUSED"): Promise<void> {
    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(nextStatus === "ACTIVE" ? "Path published and activated." : "Path paused.");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update path status.");
    } finally {
      setBusyPathId(null);
    }
  }

  async function duplicatePath(path: StewardPathTemplate): Promise<void> {
    setBusyPathId(path.id);
    setError(null);
    try {
      const created = await apiFetch<StewardPathTemplate>(`/api/steward-paths/templates/${path.id}/duplicate`, { method: "POST" });
      setNotice("Path duplicated as a new draft.");
      await load();
      if (created?.id) {
        router.push(`/steward-paths/${encodeURIComponent(created.id)}/builder`);
      }
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Failed to duplicate path.");
    } finally {
      setBusyPathId(null);
    }
  }

  async function archivePath(path: StewardPathTemplate): Promise<void> {
    const confirmed = window.confirm(
      `Archive path "${path.name}"? Archived paths are hidden from active operations.`,
    );
    if (!confirmed) return;

    setBusyPathId(path.id);
    setError(null);
    try {
      await apiFetch(`/api/steward-paths/templates/${path.id}`, { method: "DELETE" });
      setNotice("Path archived.");
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive path.");
    } finally {
      setBusyPathId(null);
    }
  }

  function resetFilters(): void {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCategoryFilter("all");
    setOwnerFilter("all");
    setSortMode("updated");
  }

  function openCreateModal(): void {
    setCreateError(null);
    setCreateDraft(initialCreateDraft());
    setCreateOpen(true);
    if (!window.location.search.includes("create=1")) {
      router.replace("/steward-paths/library?create=1");
    }
  }

  function closeCreateModal(): void {
    setCreateOpen(false);
    setCreateError(null);
    if (window.location.search.includes("create=1")) {
      router.replace("/steward-paths/library");
    }
  }

  async function addSeedSteps(pathId: string, preset: TemplatePreset): Promise<void> {
    const seedSteps = buildTemplateSeedSteps(preset);
    if (seedSteps.length === 0) return;

    for (const [index, step] of seedSteps.entries()) {
      await apiFetch(`/api/steward-paths/templates/${pathId}/steps`, {
        method: "POST",
        body: JSON.stringify({
          name: step.name,
          description: step.description,
          stepType: step.stepType,
          configJson: step.configJson ?? {},
          orderIndex: index,
          isRequired: true,
          isActive: true,
        }),
      });
    }
  }

  async function submitCreatePath(): Promise<void> {
    if (createDraft.mode === "import") {
      closeCreateModal();
      router.push("/data-tools");
      return;
    }

    if (createDraft.mode === "duplicate") {
      if (!createDraft.duplicateSourcePathId) {
        setCreateError("Select a source path to duplicate.");
        return;
      }

      setCreateBusy(true);
      setCreateError(null);
      try {
        const created = await apiFetch<StewardPathTemplate>(`/api/steward-paths/templates/${createDraft.duplicateSourcePathId}/duplicate`, {
          method: "POST",
        });
        await load();
        closeCreateModal();
        if (created?.id) {
          router.push(`/steward-paths/${encodeURIComponent(created.id)}/builder`);
        }
      } catch (createPathError) {
        setCreateError(createPathError instanceof Error ? createPathError.message : "Failed to duplicate path.");
      } finally {
        setCreateBusy(false);
      }
      return;
    }

    if (!createDraft.name.trim()) {
      setCreateError("Path name is required.");
      return;
    }

    setCreateBusy(true);
    setCreateError(null);

    try {
      const created = await apiFetch<StewardPathTemplate>("/api/steward-paths/templates", {
        method: "POST",
        body: JSON.stringify({
          name: createDraft.name.trim(),
          description: createDraft.description.trim() || createDraft.purpose.trim() || null,
          status: "DRAFT",
          crmScope: "DONOR",
          targetType: defaultTargetTypeForCategory(createDraft.category),
          triggerType: createDraft.startingTrigger,
          triggerConfig: {
            category: createDraft.category,
            pathPurpose: createDraft.purpose,
            ownerLabel: createDraft.ownerLabel,
            _sharing: {
              visibility: "private",
              ownerUserId: null,
              allowRun: false,
              allowEdit: false,
            },
          },
        }),
      });

      if (createDraft.mode === "template" && created?.id) {
        await addSeedSteps(created.id, createDraft.templatePreset);
      }

      await load();
      closeCreateModal();
      if (created?.id) {
        router.push(`/steward-paths/${encodeURIComponent(created.id)}/builder`);
      }
    } catch (createPathError) {
      setCreateError(createPathError instanceof Error ? createPathError.message : "Failed to create path.");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f3f5f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1520px] space-y-5 lg:space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/70 px-5 py-5 shadow-sm md:px-6 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M4 19h16M5 17V7l7-3 7 3v10M9 11h6M9 15h6" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[30px] font-semibold tracking-tight text-slate-900">Path Library</h1>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {paths.length} paths
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Create or select a path, then move through build, review, publish, enrollment, activity, and analytics.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                </svg>
                Create Path
              </button>
              <Link
                href="/steward-paths/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Guided Start
              </Link>
              <Link
                href="/data-tools"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Import Path
              </Link>
            </div>
          </div>
        </header>

        <ContextualRibbon
          pathname={pathname}
          className="top-0 z-30"
          context={{
            flags: {
              pathStatusFilter: statusFilter,
              pathCategoryFilter: categoryFilter,
            },
          }}
          handlers={{
            "create-path": openCreateModal,
            "paths-use-template": () => {
              setCreateDraft((current) => ({ ...current, mode: "template" }));
              openCreateModal();
            },
            "paths-filter-status": () => {
              setStatusFilter(statusFilter === "ALL" ? "ACTIVE" : "ALL");
            },
            "paths-filter-category": () => {
              setCategoryFilter(categoryFilter === "all" ? "donation-follow-up" : "all");
            },
            "paths-library-view": () => router.push("/steward-paths/library"),
            "paths-activity-view": () => router.push("/steward-paths/activity"),
            "paths-analytics-view": () => router.push("/steward-paths/analytics"),
          }}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(260px,1.2fr)_170px_170px_150px_170px_auto]">
            <label className="relative block">
              <span className="sr-only">Search paths</span>
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, trigger, category, or description"
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value as OwnerFilter)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="all">Owner: All</option>
              <option value="private">Owner: Private</option>
              <option value="shared">Owner: Shared</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-10 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700"
            >
              <option value="updated">Sort: Last Updated</option>
              <option value="name">Sort: Name</option>
              <option value="enrollments">Sort: Most Enrolled</option>
              <option value="errors">Sort: Most Errors</option>
            </select>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : null}
              <Link
                href="/steward-paths/review"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Review Queue
              </Link>
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-500">Published currently maps to Active in the runtime engine; this filter remains visible for stage clarity.</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusFilter === item.value ? statusChipClass(item.value) : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 md:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Path Health Overview</h2>
              <p className="text-xs text-slate-500">Live status snapshot for your full library.</p>
            </div>
            <Link href="/steward-paths/analytics" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View Analytics</Link>
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 md:px-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">Total Paths</p><p className="mt-1 text-xl font-semibold text-slate-900">{paths.length}</p></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-emerald-700">Active</p><p className="mt-1 text-xl font-semibold text-emerald-800">{activeCount}</p></div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-blue-700">Draft</p><p className="mt-1 text-xl font-semibold text-blue-800">{draftCount}</p></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-amber-700">Needs Review</p><p className="mt-1 text-xl font-semibold text-amber-800">{reviewCount}</p></div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-violet-700">Paused</p><p className="mt-1 text-xl font-semibold text-violet-800">{pausedCount}</p></div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-rose-700">Errored</p><p className="mt-1 text-xl font-semibold text-rose-800">{erroredEnrollments}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">Archived</p><p className="mt-1 text-xl font-semibold text-slate-900">{archivedCount}</p></div>
          </div>
        </section>

        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading path library...</div>
        ) : paths.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M5 7h14M5 12h14M5 17h8" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No paths yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Create your first stewardship path to orchestrate donor journeys across email, tasks, and follow-up actions.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={openCreateModal} className="inline-flex h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
                Create First Path
              </button>
              <Link href="/data-tools" className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Import Existing Paths
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid gap-3">
            {visiblePaths.map((path) => {
              const stats = pathStatsById.get(path.id) ?? { total: 0, active: 0, completed: 0, failed: 0, lastRunAt: null };
              const category = derivePathCategory(path);
              const label = statusLabel(path, stats);

              const nextAction = (() => {
                if (path.status === "ARCHIVED") {
                  return { label: "Archived", href: `/steward-paths/${encodeURIComponent(path.id)}/activity`, reason: "Archived paths are read-only in this stage." };
                }
                if (path.status === "DRAFT") {
                  if (path.steps.length === 0) {
                    return { label: "Build Path", href: `/steward-paths/${encodeURIComponent(path.id)}/builder`, reason: "Add at least one action step before publish." };
                  }
                  return { label: "Review and Validate", href: `/steward-paths/${encodeURIComponent(path.id)}/review`, reason: "Run review before publishing." };
                }
                if (path.status === "PAUSED") {
                  if (stats.failed > 0) {
                    return { label: "Resolve Errors", href: `/steward-paths/${encodeURIComponent(path.id)}/activity`, reason: "Resume disabled until failed enrollments are resolved." };
                  }
                  return { label: "Resume Path", run: () => void updatePathStatus(path, "ACTIVE"), reason: "Path is paused and ready to resume." };
                }
                if (stats.total === 0) {
                  return { label: "Enroll Donors", href: `/steward-paths/${encodeURIComponent(path.id)}/enrollments`, reason: "Path is active but has no enrollments yet." };
                }
                return { label: "View Analytics", href: `/steward-paths/${encodeURIComponent(path.id)}/analytics`, reason: "Track performance of active enrollments." };
              })();

              return (
                <article key={path.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900">{path.name}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChipClass(label)}`}>{label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{categoryLabel(category)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{path.description || "No description yet."}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      {nextAction.href ? (
                        <Link
                          href={nextAction.href}
                          className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          title={nextAction.reason}
                        >
                          {nextAction.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={nextAction.run}
                          className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          title={nextAction.reason}
                        >
                          {nextAction.label}
                        </button>
                      )}

                      <PathCardActionsMenu
                        path={path}
                        stats={stats}
                        busy={busyPathId === path.id}
                        onPublish={() => void updatePathStatus(path, "ACTIVE")}
                        onPause={() => void updatePathStatus(path, "PAUSED")}
                        onResume={() => void updatePathStatus(path, "ACTIVE")}
                        onDuplicate={() => void duplicatePath(path)}
                        onArchive={() => void archivePath(path)}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Trigger</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{path.triggerType || "MANUAL"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Path Type</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{path.targetType}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Enrolled</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{stats.total}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-700">Active Donors</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">{stats.active}</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-blue-700">Completed</p>
                      <p className="mt-1 text-xs font-semibold text-blue-800">{stats.completed}</p>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-rose-700">Errored</p>
                      <p className="mt-1 text-xs font-semibold text-rose-800">{stats.failed}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Last Run</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{formatDate(stats.lastRunAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Owner</p>
                      <p className="mt-1 text-xs font-semibold text-slate-900">{readOwnerLabel(path)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Updated {formatDate(path.updatedAt)}</span>
                    <span>{nextAction.reason}</span>
                  </div>
                </article>
              );
            })}

            {visiblePaths.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                <p className="text-sm font-semibold text-slate-900">No paths match current filters</p>
                <p className="mt-1 text-sm text-slate-600">Adjust status, category, or owner filters to broaden results.</p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reset Filters
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        <section className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
              <Link href="/steward-paths/activity" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View All</Link>
            </div>

            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-600">
                  Activity will appear once templates are created or updated.
                </div>
              ) : recentActivity.map((path) => (
                <div key={path.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{path.name}</p>
                    <p className="text-xs text-slate-600">Updated {formatDate(path.updatedAt)}</p>
                  </div>
                  <Link href={`/steward-paths/${encodeURIComponent(path.id)}/activity`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open</Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Path Performance Snapshot</h3>
              <Link href="/steward-paths/analytics" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View Full Analytics</Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Enrolled</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{totalEnrollments}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Active Now</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">{activeEnrollments}</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-blue-700">Completed</p>
                <p className="mt-1 text-2xl font-semibold text-blue-800">{completedEnrollments}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Completion Rate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{percentage(totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0)}</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-rose-700">Error Rate</p>
                <p className="mt-1 text-2xl font-semibold text-rose-800">{percentage(totalEnrollments > 0 ? (erroredEnrollments / totalEnrollments) * 100 : 0)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            aria-label="Close create path dialog"
            onClick={closeCreateModal}
          />

          <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create New Path</h2>
                <p className="mt-1 text-sm text-slate-600">Choose how to start, then move directly into the builder.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                aria-label="Close create path dialog"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4 12 12M12 4 4 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {([
                { value: "scratch", label: "Start from Scratch" },
                { value: "template", label: "Use Template" },
                { value: "duplicate", label: "Duplicate Existing" },
                { value: "import", label: "Import Path JSON" },
              ] as Array<{ value: StartMode; label: string }>).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setCreateDraft((prev) => ({ ...prev, mode: mode.value }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${createDraft.mode === mode.value ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {createDraft.mode === "duplicate" ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Path</span>
                  <select
                    value={createDraft.duplicateSourcePathId}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, duplicateSourcePathId: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  >
                    <option value="">Select source path</option>
                    {duplicateCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500">Duplicate creates a new Draft copy and opens it in Builder.</p>
              </div>
            ) : createDraft.mode === "import" ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Import routes to Data Tools for controlled ingestion and validation.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path Name</span>
                  <input
                    type="text"
                    value={createDraft.name}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Example: New Donor Welcome Path"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path Purpose</span>
                  <input
                    type="text"
                    value={createDraft.purpose}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, purpose: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                    placeholder="Stewardship goal"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path Category</span>
                  <select
                    value={createDraft.category}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, category: event.target.value as PathCategoryKey }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  >
                    {CATEGORY_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</span>
                  <input
                    type="text"
                    value={createDraft.ownerLabel}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, ownerLabel: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                    placeholder="Team or person"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Starting Trigger</span>
                  <select
                    value={createDraft.startingTrigger}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, startingTrigger: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  >
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {createDraft.mode === "template" ? (
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template Starter</span>
                    <select
                      value={createDraft.templatePreset}
                      onChange={(event) => setCreateDraft((prev) => ({ ...prev, templatePreset: event.target.value as TemplatePreset }))}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                    >
                      <option value="donor-welcome">New Donor Welcome</option>
                      <option value="lapsed-reengagement">Lapsed Donor Recovery</option>
                      <option value="event-follow-up">Event Follow-Up</option>
                    </select>
                  </label>
                ) : null}

                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                  <textarea
                    value={createDraft.description}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    placeholder="Path overview and intent"
                  />
                </label>
              </div>
            )}

            {createError ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreatePath()}
                disabled={createBusy}
                className="inline-flex h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createBusy ? "Creating..." : createDraft.mode === "duplicate" ? "Duplicate Path" : createDraft.mode === "import" ? "Continue to Import" : "Create and Open Builder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
