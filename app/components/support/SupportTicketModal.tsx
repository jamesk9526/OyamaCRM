"use client";

import html2canvas from "html2canvas";
import { Camera, CheckCircle2, CircleHelp, LoaderCircle, MapPin, Send, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import { apiFetch } from "@/app/lib/auth-client";
import { getSupportTicketContext } from "@/app/lib/support-tickets/context";

type TicketType = "bug_report" | "feature_request" | "confusing_ui" | "data_issue" | "general_feedback";
type TicketPriority = "low" | "normal" | "high" | "urgent";

interface SupportTicketModalProps {
  open: boolean;
  moduleKey: TopBarModuleKey;
  pathname: string;
  onClose: () => void;
}

interface TicketResponse {
  ticket: { ticketNumber: string };
  notification: { status: "sent" | "failed" | "not_configured"; recipient: string | null; error: string | null };
}

const INITIAL_FORM = {
  type: "bug_report" as TicketType,
  priority: "normal" as TicketPriority,
  summary: "",
  whatTryingToDo: "",
  expectedResult: "",
  comments: "",
};

/** Renders the support request experience shared by the primary Donor CRM shell. */
export function SupportTicketModal({ open, moduleKey, pathname, onClose }: SupportTicketModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [captureState, setCaptureState] = useState<"capturing" | "ready" | "unavailable">("capturing");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<TicketResponse | null>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setForm(INITIAL_FORM);
    setScreenshotDataUrl(null);
    setCaptureState("capturing");
    setError(null);
    setSubmitted(null);

    async function captureActiveWorkArea() {
      try {
        const target = document.querySelector<HTMLElement>("main[data-crm-scroll-root='true']");
        if (!target) throw new Error("Active CRM work area was not found.");

        const canvas = await html2canvas(target, {
          backgroundColor: "#f8fafc",
          logging: false,
          scale: 1,
          useCORS: true,
          width: target.clientWidth,
          height: target.clientHeight,
          scrollY: -target.scrollTop,
        });
        const maxWidth = 1440;
        const scale = Math.min(1, maxWidth / Math.max(canvas.width, 1));
        const output = document.createElement("canvas");
        output.width = Math.max(1, Math.round(canvas.width * scale));
        output.height = Math.max(1, Math.round(canvas.height * scale));
        output.getContext("2d")?.drawImage(canvas, 0, 0, output.width, output.height);

        let dataUrl = output.toDataURL("image/jpeg", 0.78);
        if (dataUrl.length > 3_300_000) {
          dataUrl = output.toDataURL("image/jpeg", 0.6);
        }
        if (dataUrl.length > 3_300_000) {
          throw new Error("Screenshot is too large to attach.");
        }
        if (!active) return;
        setScreenshotDataUrl(dataUrl);
        setCaptureState("ready");
      } catch {
        if (active) setCaptureState("unavailable");
      }
    }

    void captureActiveWorkArea();
    return () => {
      active = false;
    };
  }, [moduleKey, open, pathname]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open, submitting]);

  if (!open) return null;

  const context = getSupportTicketContext({ moduleKey, pathname });
  const canSubmit = Boolean(form.summary.trim()) && !submitting;

  async function submit() {
    if (!canSubmit) {
      setError("Add a short summary so support knows where to begin.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch<TicketResponse>("/api/support-tickets", {
        method: "POST",
        body: JSON.stringify({ ...form, screenshotDataUrl: screenshotDataUrl ?? undefined, context }),
      });
      setSubmitted(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Support ticket could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center px-3 py-4 sm:p-6">
      <button type="button" aria-label="Close support ticket" className="absolute inset-0 bg-slate-950/55" onClick={onClose} disabled={submitting} />
      <section role="dialog" aria-modal="true" aria-labelledby="support-ticket-title" className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.34)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0f6cbd] text-white"><CircleHelp className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">OyamaCRM Support</p>
              <h2 id="support-ticket-title" className="mt-0.5 text-lg font-semibold text-slate-950">Report a problem or ask for help</h2>
              <p className="mt-1 text-sm text-slate-600">Your current page, browser details, and a screenshot are added automatically.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close support ticket" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5">
          {submitted ? (
            <div className="mx-auto max-w-xl py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h3 className="mt-3 text-lg font-semibold text-slate-950">Ticket {submitted.ticket.ticketNumber} created</h3>
              {submitted.notification.status === "sent" ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">Support was notified at {submitted.notification.recipient}. Your screenshot and page context are attached to the ticket.</p>
              ) : (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-6 text-amber-900">
                  <p className="font-semibold">Your request is saved in the support queue.</p>
                  <p>{submitted.notification.status === "not_configured" ? "No support recipient has been configured yet, so no email was sent." : `The notification email could not be sent: ${submitted.notification.error ?? "unknown delivery error"}`}</p>
                </div>
              )}
              <button type="button" onClick={onClose} className="mt-6 inline-flex items-center justify-center rounded-md bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115ea3]">Done</button>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">What do you need?
                    <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TicketType }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100">
                      <option value="bug_report">Something is not working</option>
                      <option value="confusing_ui">I need help using this page</option>
                      <option value="data_issue">I found a data issue</option>
                      <option value="feature_request">I have an improvement idea</option>
                      <option value="general_feedback">General support request</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">How urgent is it?
                    <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TicketPriority }))} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100">
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">Brief summary <span className="text-rose-600">*</span>
                  <input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} maxLength={300} placeholder="Example: I cannot save this donation" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">What were you trying to do?
                  <textarea value={form.whatTryingToDo} onChange={(event) => setForm((current) => ({ ...current, whatTryingToDo: event.target.value }))} rows={2} placeholder="Tell support the action you took just before the problem." className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">What did you expect to happen?
                  <textarea value={form.expectedResult} onChange={(event) => setForm((current) => ({ ...current, expectedResult: event.target.value }))} rows={2} placeholder="Describe the expected result, if you know it." className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Additional comments
                  <textarea value={form.comments} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} rows={4} placeholder="Include anything else that will help the support team reproduce or answer this." className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0f6cbd] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>

              <aside className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><MapPin className="h-4 w-4 text-[#0f6cbd]" />Current location</div>
                  <p className="mt-2 break-all text-xs leading-5 text-slate-600">{context.routePath}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{context.pageTitle}</p>
                </div>
                <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Camera className="h-4 w-4 text-[#0f6cbd]" />Page screenshot</span>{captureState === "capturing" ? <LoaderCircle className="h-4 w-4 animate-spin text-slate-500" /> : null}</div>
                  {screenshotDataUrl ? <Image src={screenshotDataUrl} alt="Current page screenshot attached to this support ticket" width={1440} height={900} unoptimized className="aspect-16/10 w-full object-cover object-top" /> : <div className="flex aspect-16/10 items-center justify-center px-4 text-center text-xs leading-5 text-slate-500">{captureState === "capturing" ? "Capturing the current work area..." : "A screenshot could not be captured for this page."}</div>}
                  {screenshotDataUrl ? <button type="button" onClick={() => setScreenshotDataUrl(null)} className="w-full border-t border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Remove screenshot</button> : null}
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />Avoid including passwords, API keys, or sensitive private information in your notes.</div>
              </aside>
            </div>
          )}
          {error ? <div role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}
        </div>

        {!submitted ? <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3"><p className="hidden text-xs text-slate-500 sm:block">Location and browser diagnostics are included automatically.</p><div className="ml-auto flex gap-2"><button type="button" onClick={onClose} disabled={submitting} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void submit()} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-md bg-[#0f6cbd] px-3 py-2 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? "Sending..." : "Send support ticket"}</button></div></footer> : null}
      </section>
    </div>
  );
}