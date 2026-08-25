import Link from "next/link";
import { Check, CircleAlert, CreditCard, Eye, Globe2, Save, Settings2 } from "lucide-react";
import type { EventPageBranding, EventPageDeploymentHistoryEntry, EventPagePaymentPolicy, EventPageStatus } from "@/app/components/events/page-builder/types";

interface PublishReadinessItem { label: string; passed: boolean; }
interface EventPageBuilderTopBarProps {
  eventName: string; resolvedPageUrl: string; pageSlug: string; pageSlugDraft: string; saveUrlPending: boolean;
  urlFeedback: string | null; status: EventPageStatus; lastPublishedAt: string | null; paymentPolicy: EventPagePaymentPolicy;
  deploymentHistory: EventPageDeploymentHistoryEntry[]; autoSaveState: "idle" | "saving" | "saved" | "error";
  publishReadiness: PublishReadinessItem[]; branding?: EventPageBranding;
  onPaymentPolicyChange: (value: EventPagePaymentPolicy) => void; onPageSlugDraftChange: (value: string) => void;
  onSavePageSlug: () => void; onPreview: () => void; onPreviewRegistration: () => void; onPublishToggle: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never published";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Never published" : `Published ${parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

/** Fluent command surface for page identity, preview, and guarded publishing. */
export default function EventPageBuilderTopBar(props: EventPageBuilderTopBarProps) {
  const publishReady = props.publishReadiness.every((item) => item.passed);
  const readinessCount = props.publishReadiness.filter((item) => item.passed).length;
  const saveLabel = props.autoSaveState === "saving" ? "Saving…" : props.autoSaveState === "error" ? "Save failed" : "Saved";

  return <header className="shrink-0 border-b border-[#d1d1d1] bg-white">
    <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h1 className="truncate text-sm font-semibold text-[#242424]">Event page · {props.eventName}</h1><span className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold ${props.status === "Published" ? "bg-[#dff6dd] text-[#0b6a0b]" : "bg-[#f3f2f1] text-[#616161]"}`}>{props.status}</span></div><p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#616161]"><Save className="h-3 w-3" />{saveLabel} · {formatTimestamp(props.lastPublishedAt)}</p></div>
      <div className="hidden items-center gap-2 border border-[#e1dfdd] bg-[#fafafa] px-2 py-1.5 md:flex">{props.branding?.logoSquareUrl || props.branding?.logoUrl ? <img src={props.branding.logoSquareUrl || props.branding.logoUrl} alt="Organization logo" className="h-6 w-6 object-contain" /> : <span className="h-4 w-4 rounded-full" style={{ background: props.branding?.primaryColor || "#0f6cbd" }} />}<span className="max-w-32 truncate text-xs font-semibold">{props.branding?.organizationName || "Global branding"}</span><Link href="/settings/branding" className="text-[11px] font-semibold text-[#0f6cbd] hover:underline">Edit brand</Link></div>
      <button type="button" onClick={props.onPreview} className="event-studio-secondary-button"><Eye className="h-4 w-4" />Preview event page</button>
      <button type="button" onClick={props.onPreviewRegistration} className="event-studio-secondary-button"><CreditCard className="h-4 w-4" />Preview registration</button>
      <button type="button" onClick={props.onPublishToggle} disabled={props.status !== "Published" && !publishReady} title={props.status !== "Published" && !publishReady ? "Complete the readiness checks before publishing." : undefined} className="event-studio-primary-button disabled:cursor-not-allowed disabled:bg-[#c8c6c4]"><Globe2 className="h-4 w-4" />{props.status === "Published" ? "Unpublish" : "Publish"}</button>
    </div>

    <details className="border-t border-[#edebe9] bg-[#fafafa] px-3 py-2 sm:px-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-[#424242]"><span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Page settings and readiness</span><span className={publishReady ? "text-[#107c10]" : "text-[#986f0b]"}>{readinessCount}/{props.publishReadiness.length} ready</span></summary>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div><label className="text-[11px] font-semibold text-[#616161]">Public URL</label><div className="mt-1 flex min-w-0 items-center gap-2"><span className="hidden truncate text-xs text-[#616161] lg:block">{props.resolvedPageUrl.replace(props.pageSlugDraft, "")}</span><input value={props.pageSlugDraft} onChange={(event) => props.onPageSlugDraftChange(event.target.value)} placeholder="event-page-slug" className="h-9 min-w-0 flex-1 border border-[#8a8886] bg-white px-2 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]" /><button type="button" onClick={props.onSavePageSlug} disabled={props.saveUrlPending || !props.pageSlugDraft.trim() || props.pageSlugDraft.trim() === props.pageSlug} className="event-studio-secondary-button disabled:opacity-50">{props.saveUrlPending ? "Saving…" : "Save URL"}</button></div></div>
        <label className="text-[11px] font-semibold text-[#616161]">Registration payment policy<select value={props.paymentPolicy} onChange={(event) => props.onPaymentPolicyChange(event.target.value as EventPagePaymentPolicy)} className="mt-1 h-9 w-full border border-[#8a8886] bg-white px-2 text-sm font-medium text-[#242424] outline-none focus:border-[#0f6cbd]" aria-label="Registration payment policy"><option value="StripeCheckout">Stripe secure checkout</option><option value="OfflineFollowUp">Offline payment follow-up</option><option value="NoPaymentRequired">No payment required</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{props.publishReadiness.map((item) => <span key={item.label} className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold ${item.passed ? "border-[#9fd89f] bg-[#dff6dd] text-[#0b6a0b]" : "border-[#e5c365] bg-[#fff4ce] text-[#835b00]"}`}>{item.passed ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}{item.label}</span>)}</div>
      {props.urlFeedback ? <p className="mt-2 border border-[#96c6eb] bg-[#eff6fc] px-3 py-2 text-xs text-[#0f548c]">{props.urlFeedback}</p> : null}
      <p className="mt-2 text-[11px] text-[#616161]">Production Ready · {props.deploymentHistory.length} deployment record{props.deploymentHistory.length === 1 ? "" : "s"} · Organization branding is inherited from Settings.</p>
    </details>
  </header>;
}
