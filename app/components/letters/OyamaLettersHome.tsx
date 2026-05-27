/** OyamaLetters production-center home for document generation workflows. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";
import type { GeneratedLetterSummary, LetterDashboardStats, LetterTemplateSummary } from "@/app/components/letters/types";

interface PrintableTemplate extends LetterTemplateSummary {
  printSubject?: string | null;
  printBody?: string | null;
}

const QUICK_ACTIONS = [
  { title: "Generate Thank-You Letters", href: "/oyama-letters/generate?type=thank-you", body: "Choose real donors, validate gift fields, preview each letter, and generate a PDF." },
  { title: "Print Mailing Labels", href: "/oyama-letters/generate?type=labels", body: "Build labels from selected constituents, saved lists, reports, or filtered donor segments." },
  { title: "Create Donation Receipts", href: "/oyama-letters/generate?type=receipt", body: "Generate single or batch receipts from donation records with merge-field checks." },
  { title: "Build Board Packet", href: "/oyama-letters/generate?type=board-packet", body: "Prepare board-facing packets and custom PDFs from reusable templates." },
  { title: "Create Custom Letter", href: "/oyama-letters/generate?type=custom", body: "Start from a blank printable or pick any active template." },
] as const;

/** Formats optional ISO dates for compact document metadata. */
function formatDate(value?: string | null): string {
  if (!value) return "Not used yet";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** New guided launchpad that replaces the old project-manager-first letters home. */
export default function OyamaLettersHome() {
  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [templates, setTemplates] = useState<PrintableTemplate[]>([]);
  const [generated, setGenerated] = useState<GeneratedLetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, templatesResult, generatedResult] = await Promise.allSettled([
        apiFetch<LetterDashboardStats>("/api/letters/dashboard"),
        apiFetch<PrintableTemplate[]>("/api/letters/templates"),
        apiFetch<GeneratedLetterSummary[]>("/api/letters/generated?limit=12"),
      ]);

      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setTemplates(templatesResult.status === "fulfilled" ? templatesResult.value : []);
      setGenerated(generatedResult.status === "fulfilled" ? generatedResult.value : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Letters & Printables.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTemplates = useMemo(() => templates.filter((template) => template.status !== "ARCHIVED"), [templates]);
  const recentTemplates = activeTemplates.slice(0, 6);
  const generatedThisMonth = stats?.generatedThisMonth ?? generated.length;

  return (
    <WorkspaceRibbonFrame
      title="Letters & Printables"
      description="Document production studio for letters, receipts, labels, packets, and printable PDFs."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Communications", href: "/communications" },
        { label: "Letters & Printables", href: "/oyama-letters" },
      ]}
      statusLabel="Production center"
      metadata={`${activeTemplates.length} templates · ${generatedThisMonth} generated this month`}
      primaryAction={<WorkspaceRibbonButton label="Open Generate Center" href="/oyama-letters/generate" variant="primary" />}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Create">
            <WorkspaceRibbonButton label="Generate Center" href="/oyama-letters/generate" variant="primary" />
            <WorkspaceRibbonButton label="Thank-You" href="/oyama-letters/generate?type=thank-you" />
            <WorkspaceRibbonButton label="Receipts" href="/oyama-letters/generate?type=receipt" />
            <WorkspaceRibbonButton label="Labels" href="/oyama-letters/generate?type=labels" />
          </WorkspaceRibbonGroup>
          <WorkspaceRibbonGroup label="Library">
            <WorkspaceRibbonButton label="Templates" href="/oyama-letters/templates" />
            <WorkspaceRibbonButton label="New Template" href="/oyama-letters/templates/new" />
            <WorkspaceRibbonButton label="Generated History" href="/oyama-letters/generate?tab=activity" />
          </WorkspaceRibbonGroup>
          <WorkspaceRibbonGroup label="Setup">
            <WorkspaceRibbonButton label="Letter Presets" href="/settings/branding/letter-presets" />
            <WorkspaceRibbonButton label="Signatures" href="/settings/branding/signatures" />
            <WorkspaceRibbonButton label="Branding" href="/settings/branding" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <div className="min-w-0 space-y-5">
        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
            <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">Retry</button>
          </div>
        ) : null}

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Generate mode</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">What would you like to create?</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Pick the printable first, then Letters & Printables guides you through template, records, merge validation, document preview, PDF preview, and print or download.
                </p>
              </div>
              <Link href="/oyama-letters/generate" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                Start Generate Center
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.title} href={action.href} className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-white hover:shadow-sm">
                  <p className="text-sm font-semibold text-slate-950 group-hover:text-emerald-700">{action.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{action.body}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Production status</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatusMetric label="Templates" value={loading ? "-" : String(activeTemplates.length)} />
              <StatusMetric label="Generated" value={loading ? "-" : String(generatedThisMonth)} />
              <StatusMetric label="Needs Review" value={loading ? "-" : String(stats?.needsReview ?? 0)} />
              <StatusMetric label="Tax Receipts" value={loading ? "-" : String(stats?.taxReceiptsGenerated ?? 0)} />
            </div>
            <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Production UI uses real CRM templates, generated documents, constituents, donations, lists, and reports. Empty states appear when data is missing.
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Saved Templates" action={<Link href="/oyama-letters/templates" className="text-xs font-semibold text-emerald-700 hover:underline">View all</Link>}>
            {loading ? <LoadingRows /> : recentTemplates.length === 0 ? (
              <EmptyState title="No templates yet" body="Create or publish a template before generating printables." actionHref="/oyama-letters/templates/new" actionLabel="Create Template" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recentTemplates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Generated History" action={<Link href="/oyama-letters/generate?tab=activity" className="text-xs font-semibold text-emerald-700 hover:underline">Open activity</Link>}>
            {loading ? <LoadingRows /> : generated.length === 0 ? (
              <EmptyState title="No generated documents" body="Generated PDFs and saved document history will appear here." actionHref="/oyama-letters/generate" actionLabel="Generate PDF" />
            ) : (
              <div className="space-y-2">
                {generated.slice(0, 6).map((letter) => (
                  <GeneratedRow key={letter.id} letter={letter} />
                ))}
              </div>
            )}
          </Panel>
        </section>
      </div>
    </WorkspaceRibbonFrame>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TemplateCard({ template }: { template: PrintableTemplate }) {
  return (
    <Link href={`/oyama-letters/templates/${template.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{template.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{template.description || "Reusable printable template"}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{template.status}</span>
      </div>
      <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Type</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-800">{template.category.replaceAll("_", " ")}</p>
      </div>
      <p className="mt-2 text-xs text-slate-400">Last edited {formatDate(template.updatedAt)}</p>
    </Link>
  );
}

function GeneratedRow({ letter }: { letter: GeneratedLetterSummary }) {
  const constituent = letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "Batch or no constituent";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="truncate text-sm font-semibold text-slate-900">{letter.template?.name || "Generated document"}</p>
      <p className="mt-0.5 text-xs text-slate-500">{constituent} · {letter.status}</p>
      <p className="mt-1 text-[11px] text-slate-400">{formatDate(letter.generatedAt)}</p>
    </div>
  );
}

function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      <Link href={actionHref} className="mt-4 inline-flex rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
        {actionLabel}
      </Link>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
