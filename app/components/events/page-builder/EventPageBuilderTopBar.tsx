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

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-950">Event Page Builder</span>
            <span className="text-slate-300">/</span>
            <span className="truncate text-slate-700">{eventName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              {autoSaveState === "saving" ? "Saving..." : autoSaveState === "error" ? "Save issue" : "Saved"}
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">{status}</span>
            <span>Last published: {formatTimestamp(lastPublishedAt)}</span>
            <span className={publishReady ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
              Readiness: {readinessCount}/{publishReadiness.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            View Page
          </button>
          <button
            type="button"
            onClick={onPublishToggle}
            disabled={status !== "Published" && !publishReady}
            title={status !== "Published" && !publishReady ? "Complete the publish readiness checklist before publishing." : undefined}
            className="inline-flex h-9 items-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/15 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {status === "Published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-emerald-500">▣</span>
          <input
            type="text"
            value={pageSlugDraft}
            onChange={(event) => onPageSlugDraftChange(event.target.value)}
            placeholder="gala2027"
            className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <span className="hidden truncate text-xs font-semibold text-slate-500 lg:block">{resolvedPageUrl}</span>
        </div>
          <button
            type="button"
            onClick={onSavePageSlug}
            disabled={saveUrlPending || pageSlugDraft.trim().length === 0 || pageSlugDraft.trim() === pageSlug}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveUrlPending ? "Saving..." : "Save Slug"}
          </button>
        {urlFeedback ? <p className="text-xs text-violet-700 md:w-56">{urlFeedback}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {publishReadiness.map((item) => (
          <span
            key={item.label}
            className={[
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              item.passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            {item.passed ? "Ready" : "Needed"}: {item.label}
          </span>
        ))}
      </div>
    </header>
  );
}
