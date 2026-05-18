import type { EventPageStatus } from "@/app/components/events/page-builder/types";

interface EventPageBuilderTopBarProps {
  eventName: string;
  resolvedPageUrl: string;
  pageSlug: string;
  pageSlugDraft: string;
  saveUrlPending: boolean;
  urlFeedback: string | null;
  status: EventPageStatus;
  lastPublishedAt: string | null;
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
  onPageSlugDraftChange,
  onSavePageSlug,
  onPreview,
  onPublishToggle,
}: EventPageBuilderTopBarProps) {
  return (
    <header className="rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Selected Event</p>
          <h1 className="truncate text-lg font-semibold text-slate-900">{eventName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
              {status}
            </span>
            <span>Last published: {formatTimestamp(lastPublishedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex h-9 items-center rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={onPublishToggle}
            className="inline-flex h-9 items-center rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {status === "Published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">Event page slug</p>
        <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="text"
            value={pageSlugDraft}
            onChange={(event) => onPageSlugDraftChange(event.target.value)}
            placeholder="gala2027"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={onSavePageSlug}
            disabled={saveUrlPending || pageSlugDraft.trim().length === 0 || pageSlugDraft.trim() === pageSlug}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveUrlPending ? "Saving..." : "Save Slug"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Full URL auto-generated from this instance domain:</p>
        <p className="mt-0.5 break-all text-xs font-semibold text-violet-700">{resolvedPageUrl}</p>
        {urlFeedback ? <p className="mt-1 text-xs text-violet-700">{urlFeedback}</p> : null}
      </div>
    </header>
  );
}
