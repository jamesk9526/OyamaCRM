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

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-violet-100 px-2.5 py-1 font-bold uppercase tracking-[0.14em] text-violet-700">EventSTUDIO</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-600">Page Builder</span>
          </div>
          <h1 className="mt-1 truncate text-lg font-semibold text-slate-950">{eventName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
              <span className={`h-2 w-2 rounded-full ${getAutosaveIndicatorColor(autoSaveState)}`} />
              {autoSaveState === "saving" ? "Saving..." : autoSaveState === "error" ? "Save issue" : "Saved"}
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">{status}</span>
            <span className={publishReady ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
              Readiness: {readinessCount}/{publishReadiness.length}
            </span>
            <span className="text-slate-400">Published: {formatTimestamp(lastPublishedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
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

      <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-500 shadow-sm">▣</span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:inline">Public URL</span>
          <input
            type="text"
            value={pageSlugDraft}
            onChange={(event) => onPageSlugDraftChange(event.target.value)}
            placeholder="gala2027"
            className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <span className="hidden max-w-[32rem] truncate rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm lg:block">{resolvedPageUrl}</span>
          <button
            type="button"
            onClick={onSavePageSlug}
            disabled={saveUrlPending || pageSlugDraft.trim().length === 0 || pageSlugDraft.trim() === pageSlug}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveUrlPending ? "Saving..." : "Save"}
          </button>
        </div>
        {urlFeedback ? <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800">{urlFeedback}</p> : null}
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
            <span className="mr-1">{item.passed ? "✓" : "!"}</span>
            {item.label}
          </span>
        ))}
      </div>
    </header>
  );
}
