import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Circle, ExternalLink, Eye, Globe2, LoaderCircle, ReceiptText, Settings2 } from "lucide-react";
import type { EventPageBranding, EventPageDeploymentHistoryEntry, EventPagePaymentPolicy, EventPageStatus } from "@/app/components/events/page-builder/types";

interface PublishReadinessItem { label: string; passed: boolean }
interface EventPageBuilderTopBarProps {
  eventId: string; eventName: string; resolvedPageUrl: string; pageSlug: string; pageSlugDraft: string; saveUrlPending: boolean;
  urlFeedback: string | null; status: EventPageStatus; lastPublishedAt: string | null; paymentPolicy: EventPagePaymentPolicy;
  deploymentHistory: EventPageDeploymentHistoryEntry[]; autoSaveState: "idle" | "saving" | "saved" | "error";
  publishReadiness: PublishReadinessItem[]; branding?: EventPageBranding;
  onPaymentPolicyChange: (value: EventPagePaymentPolicy) => void; onPageSlugDraftChange: (value: string) => void;
  onSavePageSlug: () => void; onPreview: () => void; onPreviewRegistration: () => void; onPublishToggle: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not published";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not published";
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Canonical command deck for page identity, preview, configuration, and publishing. */
export default function EventPageBuilderTopBar(props: EventPageBuilderTopBarProps) {
  const publishReady = props.publishReadiness.every((item) => item.passed);
  const readinessCount = props.publishReadiness.filter((item) => item.passed).length;
  const saveState = props.autoSaveState === "saving"
    ? { label: "Saving", className: "text-amber-300", icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> }
    : props.autoSaveState === "error"
      ? { label: "Save failed", className: "text-red-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> }
      : { label: "All changes saved", className: "text-emerald-300", icon: <Check className="h-3.5 w-3.5" /> };

  return (
    <header className="relative z-20 shrink-0 border-b border-slate-700 bg-slate-950 text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex min-h-[68px] flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <Link href={`/events/${encodeURIComponent(props.eventId)}/overview`} className="grid h-9 w-9 shrink-0 place-items-center border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" aria-label="Back to event overview" title="Back to event overview">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-[180px] flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Public site</p>
            <span className="h-3 w-px bg-slate-700" aria-hidden />
            <h1 className="truncate text-sm font-semibold text-white">{props.eventName}</h1>
            <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${props.status === "Published" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{props.status}</span>
          </div>
          <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${saveState.className}`}>{saveState.icon}{saveState.label}<span className="text-slate-600">/</span><span className="text-slate-400">Last deploy: {formatTimestamp(props.lastPublishedAt)}</span></p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.status === "Published" ? <a href={props.resolvedPageUrl} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white sm:inline-flex"><ExternalLink className="h-3.5 w-3.5" />View live</a> : null}
          <button type="button" onClick={props.onPreviewRegistration} className="hidden h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white md:inline-flex"><ReceiptText className="h-3.5 w-3.5" />Test registration</button>
          <button type="button" onClick={props.onPreview} className="inline-flex h-9 items-center gap-2 border border-slate-600 bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700"><Eye className="h-3.5 w-3.5" />Full preview</button>
          <button type="button" onClick={props.onPublishToggle} disabled={props.status !== "Published" && !publishReady} title={props.status !== "Published" && !publishReady ? "Resolve the failed launch checks before publishing." : undefined} className="inline-flex h-9 items-center gap-2 bg-sky-500 px-4 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"><Globe2 className="h-3.5 w-3.5" />{props.status === "Published" ? "Unpublish" : "Publish site"}</button>
        </div>
      </div>

      <details className="group border-t border-slate-800 bg-slate-900/90">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 px-3 text-xs text-slate-300 hover:bg-slate-800/80 sm:px-4">
          <span className="flex min-w-0 items-center gap-2"><Settings2 className="h-3.5 w-3.5 text-sky-300" /><span className="font-semibold text-white">Site configuration</span><span className="hidden truncate font-mono text-[10px] text-slate-500 sm:inline">/{props.pageSlug}</span></span>
          <span className="flex shrink-0 items-center gap-2"><span className={publishReady ? "text-emerald-300" : "text-amber-300"}>{readinessCount}/{props.publishReadiness.length} launch checks</span><ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></span>
        </summary>
        <div className="grid gap-4 border-t border-slate-800 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <label htmlFor="event-page-slug" className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Public address</label>
            <div className="mt-1.5 flex min-w-0 items-stretch">
              <span className="hidden min-w-0 truncate border border-r-0 border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-500 lg:block">{props.resolvedPageUrl.replace(props.pageSlugDraft, "")}</span>
              <input id="event-page-slug" value={props.pageSlugDraft} onChange={(event) => props.onPageSlugDraftChange(event.target.value)} placeholder="event-page-slug" className="h-9 min-w-0 flex-1 border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-1 focus:ring-sky-400" />
              <button type="button" onClick={props.onSavePageSlug} disabled={props.saveUrlPending || !props.pageSlugDraft.trim() || props.pageSlugDraft.trim() === props.pageSlug} className="h-9 border border-l-0 border-slate-600 bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-600">{props.saveUrlPending ? "Saving…" : "Apply"}</button>
            </div>
          </div>
          <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Registration payment
            <select value={props.paymentPolicy} onChange={(event) => props.onPaymentPolicyChange(event.target.value as EventPagePaymentPolicy)} className="mt-1.5 h-9 w-full border border-slate-600 bg-slate-950 px-3 font-sans text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-sky-400">
              <option value="StripeCheckout">Stripe secure checkout</option><option value="OfflineFollowUp">Offline payment follow-up</option><option value="NoPaymentRequired">No payment required</option>
            </select>
          </label>
          <div className="xl:col-span-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Launch checks</p>
            <div className="mt-2 grid gap-px overflow-hidden border border-slate-700 bg-slate-700 sm:grid-cols-2 xl:grid-cols-5">
              {props.publishReadiness.map((item) => <div key={item.label} className="flex min-h-9 items-center gap-2 bg-slate-950 px-2.5 text-[11px] font-medium text-slate-300">{item.passed ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}<span className="min-w-0 truncate" title={item.label}>{item.label}</span></div>)}
            </div>
          </div>
          {props.urlFeedback ? <p className="border-l-2 border-sky-400 bg-sky-400/10 px-3 py-2 text-xs text-sky-100 xl:col-span-2">{props.urlFeedback}</p> : null}
          <p className="flex items-center gap-2 text-[10px] text-slate-500 xl:col-span-2"><span className="h-2 w-2" style={{ background: props.branding?.primaryColor || "#0f6cbd" }} aria-hidden />Brand system: {props.branding?.organizationName || "Organization defaults"} · {props.deploymentHistory.length} deployment record{props.deploymentHistory.length === 1 ? "" : "s"}</p>
        </div>
      </details>
    </header>
  );
}
