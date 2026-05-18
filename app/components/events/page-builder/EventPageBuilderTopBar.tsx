import type { EventPageStatus } from "@/app/components/events/page-builder/types";

interface PublishReadinessItem {
  label: string;
  passed: boolean;
}

interface EventPageBuilderTopBarProps {
  eventName: string;
  resolvedPageUrl: string;
  pageSlug: string;
  pageSlugDraft: string;
  saveUrlPending: boolean;
  urlFeedback: string | null;
  status: EventPageStatus;
  lastPublishedAt: string | null;
  autoSaveState: "idle" | "saving" | "saved" | "error";
  publishReadiness: PublishReadinessItem[];
  onPageSlugDraftChange: (value: string) => void;
  onSavePageSlug: () => void;
  onPreview: () => void;
  onPublishToggle: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAutosaveIndicatorColor(autoSaveState: EventPageBuilderTopBarProps["autoSaveState"]): string {
  if (autoSaveState === "saving") return "bg-amber-400";
  if (autoSaveState === "error") return "bg-red-500";
  return "bg-emerald-500";
}

/** Command header for the event-scoped page builder workspace. */
export default function EventPageBuilderTopBar({
  eventName,
  resolvedPageUrl,
  pageSlug,
  pageSlugDraft,
  saveUrlPending,
  urlFeedback,
  status,
  lastPublishedAt,
  autoSaveState,
  publishReadiness,
  onPageSlugDraftChange,
  onSavePageSlug,
  onPreview,
  onPublishToggle,
}: EventPageBuilderTopBarProps) {
  const publishReady = publishReadiness.every((item) => item.passed);
  const readinessCount = publishReadiness.filter((item) => item.passed).length;
  const workflowWarningTitle = "Event Page Builder public workflow is partially wired";
  const workflowWarningDescription =
    "Published pages render at their public slug, registrations proxy through the app origin, attendees can be edited per seat, and completion returns check-in codes. Payment collection, deployment history, and QR camera scanning are still incomplete.";

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">EventSTUDIO / Page Builder</span>
        <span className="max-w-[30ch] truncate text-xs font-semibold text-slate-700">{eventName}</span>
        <span
          title={`${workflowWarningTitle} ${workflowWarningDescription}`}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
        >
          Partially Implemented
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          <span className={`h-1.5 w-1.5 rounded-full ${getAutosaveIndicatorColor(autoSaveState)}`} />
          {autoSaveState === "saving" ? "Saving" : autoSaveState === "error" ? "Save issue" : "Saved"}
        </span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{status}</span>
        <span className={publishReady ? "text-[10px] font-semibold text-emerald-600" : "text-[10px] font-semibold text-amber-600"}>
          Readiness {readinessCount}/{publishReadiness.length}
        </span>
        <span className="text-[10px] text-slate-500">Published {formatTimestamp(lastPublishedAt)}</span>
      </div>

      <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-emerald-500 shadow-sm">▣</span>
          <input
            type="text"
            value={pageSlugDraft}
            onChange={(event) => onPageSlugDraftChange(event.target.value)}
            placeholder="event-page-slug"
            className="h-7 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <span className="hidden max-w-[34rem] truncate text-[11px] text-slate-500 lg:block">{resolvedPageUrl}</span>
          <button
            type="button"
            onClick={onSavePageSlug}
            disabled={saveUrlPending || pageSlugDraft.trim().length === 0 || pageSlugDraft.trim() === pageSlug}
            className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-violet-300 bg-white px-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveUrlPending ? "Saving" : "Save"}
          </button>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          View Page
        </button>
        <button
          type="button"
          onClick={onPublishToggle}
          disabled={status !== "Published" && !publishReady}
          title={status !== "Published" && !publishReady ? "Complete the publish readiness checklist before publishing." : undefined}
          className="inline-flex h-8 items-center justify-center rounded-md bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {status === "Published" ? "Unpublish" : "Publish"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {publishReadiness.map((item) => (
          <span
            key={item.label}
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              item.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            {item.passed ? "✓" : "!"} {item.label}
          </span>
        ))}
      </div>

      {urlFeedback ? <p className="mt-2 rounded-md border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-800">{urlFeedback}</p> : null}
    </header>
  );
}
