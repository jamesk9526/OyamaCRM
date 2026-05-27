/** OyamaLetters production-center home, redesigned as a builder-style project manager. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type { GeneratedLetterSummary, LetterDashboardStats, LetterTemplateSummary } from "@/app/components/letters/types";

interface PrintableTemplate extends LetterTemplateSummary {
  printSubject?: string | null;
  printBody?: string | null;
}

type ProjectFilter = "all" | "draft" | "ready" | "generated" | "printed";

interface ProjectQueueDefinition {
  id: ProjectFilter;
  label: string;
  description: string;
  matchStatuses: string[];
}

const PROJECT_QUEUES: ProjectQueueDefinition[] = [
  { id: "all", label: "All projects", description: "Every letter project across the workspace.", matchStatuses: [] },
  { id: "draft", label: "Drafts", description: "Started but not generated yet.", matchStatuses: ["DRAFT", "PENDING"] },
  { id: "ready", label: "Ready to review", description: "Awaiting merge-field verification.", matchStatuses: ["READY", "NEEDS_REVIEW", "REVIEW"] },
  { id: "generated", label: "Generated", description: "PDFs generated and ready to print or mail.", matchStatuses: ["GENERATED", "QUEUED", "QUEUED_FOR_PRINT", "QUEUED_FOR_MAIL"] },
  { id: "printed", label: "Printed / Mailed", description: "Completed production runs.", matchStatuses: ["PRINTED", "MAILED", "SENT", "COMPLETED"] },
];

const QUICK_PROJECT_STARTERS = [
  { id: "thank-you", title: "Thank-You Letters", body: "Personal donor acknowledgments.", href: "/oyama-letters/generate?type=thank-you" },
  { id: "receipt", title: "Donation Receipts", body: "Single or batch tax receipts.", href: "/oyama-letters/generate?type=receipt" },
  { id: "labels", title: "Mailing Labels", body: "Address labels and envelopes.", href: "/oyama-letters/generate?type=labels" },
  { id: "board-packet", title: "Board Packet", body: "Reusable board-facing PDFs.", href: "/oyama-letters/generate?type=board-packet" },
  { id: "custom", title: "Custom Letter", body: "Blank printable or any template.", href: "/oyama-letters/generate?type=custom" },
] as const;

/** Formats optional ISO dates for compact document metadata. */
function formatDate(value?: string | null): string {
  if (!value) return "Not used yet";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Builder-style project manager for letter generation projects. */
export default function OyamaLettersHome() {
  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [templates, setTemplates] = useState<PrintableTemplate[]>([]);
  const [generated, setGenerated] = useState<GeneratedLetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<ProjectFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [insightsTab, setInsightsTab] = useState<"projects" | "insights" | "production" | "activity">("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, templatesResult, generatedResult] = await Promise.allSettled([
        apiFetch<LetterDashboardStats>("/api/letters/dashboard"),
        apiFetch<PrintableTemplate[]>("/api/letters/templates"),
        apiFetch<GeneratedLetterSummary[]>("/api/letters/generated?limit=50"),
      ]);

      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setTemplates(templatesResult.status === "fulfilled" ? templatesResult.value : []);
      setGenerated(generatedResult.status === "fulfilled" ? generatedResult.value : []);
      setLastRefreshed(new Date());
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

  const queueCounts = useMemo(() => {
    const counts: Record<ProjectFilter, number> = { all: generated.length, draft: 0, ready: 0, generated: 0, printed: 0 };
    for (const letter of generated) {
      for (const queue of PROJECT_QUEUES) {
        if (queue.id === "all") continue;
        if (queue.matchStatuses.includes(letter.status)) counts[queue.id] += 1;
      }
    }
    return counts;
  }, [generated]);

  const filteredProjects = useMemo(() => {
    const queue = PROJECT_QUEUES.find((entry) => entry.id === activeQueue) ?? PROJECT_QUEUES[0];
    const search = searchTerm.trim().toLowerCase();
    return generated.filter((letter) => {
      if (queue.id !== "all" && !queue.matchStatuses.includes(letter.status)) return false;
      if (!search) return true;
      const constituent = letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "";
      const templateName = letter.template?.name ?? "";
      return constituent.toLowerCase().includes(search) || templateName.toLowerCase().includes(search) || letter.status.toLowerCase().includes(search);
    });
  }, [activeQueue, generated, searchTerm]);

  const selectedProject = useMemo(
    () => filteredProjects.find((entry) => entry.id === selectedProjectId) ?? filteredProjects[0] ?? null,
    [filteredProjects, selectedProjectId]
  );

  const generatedThisMonth = stats?.generatedThisMonth ?? generated.length;
  const needsReview = stats?.needsReview ?? queueCounts.ready;
  const queuedForPrint = stats?.queuedForPrint ?? queueCounts.generated;
  const printedToday = stats?.printedToday ?? 0;
  const addressIssues = stats?.addressIssues ?? 0;
  const taxReceipts = stats?.taxReceiptsGenerated ?? 0;
  const emailDrafts = stats?.emailDrafts ?? 0;

  return (
    <div className="min-w-0 bg-[#f6f8fb]">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/92 px-3 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-slate-950">Donor CRM</Link>
          <span aria-hidden="true">/</span>
          <Link href="/communications" className="hover:text-slate-950">Communications</Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-950">Letters &amp; Printables</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 shadow-inner">
              <span className="text-xl font-bold">≡</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal text-slate-950">Letters Project Manager</h1>
              <p className="truncate text-sm text-slate-600">Track every letter, receipt, label, and packet project in one production workspace.</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
            <ToolbarLink href="/oyama-letters/generate" icon="◉" label="Open Builder" />
            <ToolbarLink href="/oyama-letters/generate" icon="▯" label="New Project" primary />
            <ToolbarLink href="/oyama-letters/templates" icon="◇" label="Templates" />
            <ToolbarLink href="/oyama-letters/templates/new" icon="✚" label="New Template" />
            <ToolbarButton icon="↻" label="Refresh" onClick={() => void load()} disabled={loading} />
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="More actions">⋮</button>
          </div>

          <div className="ml-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500 text-[10px] text-emerald-600">✓</span>
              {loading ? "Syncing projects" : "All projects synced"}
            </span>
            <span className="h-4 w-px bg-slate-200" />
            <StatusPill label={loading ? "Syncing" : error ? "Offline" : "Live"} tone={error ? "amber" : "emerald"} />
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">Retry</button>
        </div>
      ) : null}

      <div className="grid min-h-[calc(100dvh-9.25rem)] min-w-0 gap-3 p-3 xl:grid-cols-[292px_minmax(0,1fr)_348px]">
        {/* LEFT RAIL — project queues, quick starters, templates */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-auto rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm">
          <StepCard step="STEP 1" title="Project Queue" complete>
            <div className="space-y-1.5">
              {PROJECT_QUEUES.map((queue) => {
                const count = queueCounts[queue.id];
                const active = queue.id === activeQueue;
                return (
                  <button
                    key={queue.id}
                    type="button"
                    onClick={() => { setActiveQueue(queue.id); setSelectedProjectId(null); }}
                    className={[
                      "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition",
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{queue.label}</span>
                      <span className="mt-0.5 truncate text-[11px] font-normal text-slate-500">{queue.description}</span>
                    </span>
                    <span className={[
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                      active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600",
                    ].join(" ")}>{loading ? "–" : count}</span>
                  </button>
                );
              })}
            </div>
          </StepCard>

          <StepCard step="STEP 2" title="Start a Project" complete={false}>
            <div className="space-y-1.5">
              {QUICK_PROJECT_STARTERS.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-emerald-200 hover:bg-white hover:shadow-sm"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[11px] font-bold text-violet-700">▯</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-950 group-hover:text-emerald-700">{action.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{action.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          </StepCard>

          <StepCard step="STEP 3" title="Templates" complete={activeTemplates.length > 0}>
            {loading ? (
              <LoadingRows compact />
            ) : activeTemplates.length === 0 ? (
              <EmptyText text="No templates yet. Create one to start a project." />
            ) : (
              <div className="space-y-1.5">
                {activeTemplates.slice(0, 5).map((template) => (
                  <Link
                    key={template.id}
                    href={`/oyama-letters/templates/${template.id}`}
                    className="block rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-emerald-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-slate-950">{template.name}</span>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{template.status}</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{template.category.replaceAll("_", " ")}</p>
                  </Link>
                ))}
                <Link href="/oyama-letters/templates" className="block rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-center text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                  View all templates ({activeTemplates.length})
                </Link>
              </div>
            )}
          </StepCard>

          <StepCard step="STEP 4" title="Production Settings" complete>
            <div className="space-y-1.5 text-[11px] font-semibold text-slate-600">
              <Link href="/settings/branding/letter-presets" className="block rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">Letter Presets</Link>
              <Link href="/settings/branding/signatures" className="block rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">Signatures</Link>
              <Link href="/settings/branding" className="block rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">Organization Branding</Link>
            </div>
            <Link href="/settings/branding" className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-violet-400 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100">⚙ Advanced Settings</Link>
          </StepCard>
        </aside>

        {/* CENTER — project list / preview */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                {loading ? "Loading…" : `${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}`}
              </span>
              <span>in {PROJECT_QUEUES.find((entry) => entry.id === activeQueue)?.label.toLowerCase()}</span>
            </div>
            <label className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search projects, recipients, templates…"
                className="h-9 w-72 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-4">
            {loading ? (
              <LoadingRows />
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                title="No projects in this queue"
                body="Start a new generation project from the left rail to populate this queue with real CRM records."
                actionHref="/oyama-letters/generate"
                actionLabel="Open Builder"
              />
            ) : (
              filteredProjects.slice(0, 24).map((letter) => (
                <ProjectRow
                  key={letter.id}
                  letter={letter}
                  active={selectedProject?.id === letter.id}
                  onSelect={() => setSelectedProjectId(letter.id)}
                />
              ))
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500 text-[10px] text-emerald-600">✓</span>
              Projects synced with live CRM data
            </span>
            <span>{lastRefreshed ? `Last refreshed: ${lastRefreshed.toLocaleTimeString()}` : ""}</span>
          </footer>
        </section>

        {/* RIGHT RAIL — production status & focused project details */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-auto rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm">
          <RightTabs activeTab={insightsTab} onTabChange={setInsightsTab} searchTerm={searchTerm} onSearchChange={setSearchTerm} />

          {(insightsTab === "projects" || insightsTab === "insights") ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Templates" value={loading ? "–" : String(activeTemplates.length)} />
              <Metric label="Generated" value={loading ? "–" : String(generatedThisMonth)} accent="emerald" />
              <Metric label="Needs Review" value={loading ? "–" : String(needsReview)} accent={needsReview > 0 ? "amber" : "slate"} />
              <Metric label="Queued Print" value={loading ? "–" : String(queuedForPrint)} />
              <Metric label="Printed Today" value={loading ? "–" : String(printedToday)} />
              <Metric label="Address Issues" value={loading ? "–" : String(addressIssues)} accent={addressIssues > 0 ? "amber" : "slate"} />
              <Metric label="Tax Receipts" value={loading ? "–" : String(taxReceipts)} />
              <Metric label="Email Drafts" value={loading ? "–" : String(emailDrafts)} />
            </div>
          ) : null}

          {insightsTab === "projects" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Focused Project</p>
              {selectedProject ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-semibold text-slate-950">{selectedProject.template?.name ?? "Generated document"}</p>
                  <p className="text-xs text-slate-600">
                    {selectedProject.constituent
                      ? `${selectedProject.constituent.firstName} ${selectedProject.constituent.lastName}`
                      : "Batch or no constituent"}
                  </p>
                  <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p>Status</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{selectedProject.status}</p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p>Generated</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{formatDate(selectedProject.generatedAt)}</p>
                  </div>
                  <Link
                    href={`/oyama-letters/generate?templateId=${selectedProject.templateId}${selectedProject.constituentId ? `&constituentId=${selectedProject.constituentId}` : ""}`}
                    className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Open in Builder
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Select a project to see its merge status, recipient, and quick actions here.</p>
              )}
            </section>
          ) : null}

          {(insightsTab === "production" || insightsTab === "insights") ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Production Health</p>
              <div className="mt-2 space-y-1.5 text-xs text-slate-700">
                <HealthRow label="Batch Generation" value={stats?.batchGenerationStatus ?? (loading ? "Loading" : "Idle")} />
                <HealthRow label="PDF Export" value={stats?.pdfExportStatus ?? (loading ? "Loading" : "Idle")} />
                <HealthRow label="Mailed This Week" value={loading ? "–" : String(stats?.mailedThisWeek ?? 0)} />
                <HealthRow label="Queued For Mail" value={loading ? "–" : String(stats?.queuedForMail ?? 0)} />
              </div>
              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                Production reads real CRM templates, generated documents, constituents, donations, lists, and reports.
              </div>
            </section>
          ) : null}

          {insightsTab === "activity" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Activity</p>
                <Link href="/oyama-letters/generate?tab=activity" className="text-[11px] font-semibold text-emerald-700 hover:underline">Open activity</Link>
              </div>
              {loading ? (
                <LoadingRows compact />
              ) : generated.length === 0 ? (
                <EmptyText text="Generated PDFs and saved document history will appear here." />
              ) : (
                <div className="mt-2 space-y-1.5">
                  {generated.slice(0, 8).map((letter) => (
                    <button
                      type="button"
                      key={letter.id}
                      onClick={() => setSelectedProjectId(letter.id)}
                      className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-white"
                    >
                      <p className="truncate text-xs font-semibold text-slate-900">{letter.template?.name ?? "Generated document"}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "Batch"} · {letter.status}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(letter.generatedAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ToolbarLink({ href, label, icon, primary = false }: { href: string; label: string; icon: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold shadow-sm",
        primary ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
      title={label}
    >
      <span className="text-[13px] text-current opacity-75">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function ToolbarButton({ label, icon, onClick, disabled = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      title={label}
    >
      <span className="text-[13px] text-current opacity-75">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "emerald" | "amber" | "slate" }) {
  const className =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function StepCard({ step, title, complete, children }: { step: string; title: string; complete?: boolean; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{step}</span>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        </div>
        {complete ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span> : null}
      </div>
      {children}
    </section>
  );
}

function ProjectRow({ letter, active, onSelect }: { letter: GeneratedLetterSummary; active: boolean; onSelect: () => void }) {
  const constituent = letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "Batch project";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-stretch gap-3 rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md",
        active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-200",
      ].join(" ")}
    >
      <div className="h-20 w-16 shrink-0 rounded-md border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-2 shadow-inner">
        <div className="mb-1.5 h-2 w-8 rounded bg-violet-100" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-1 rounded bg-slate-200" />)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">{letter.template?.name ?? "Generated document"}</p>
          <ProjectStatusPill status={letter.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-600">{constituent}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>{(letter.category ?? "GENERAL").replaceAll("_", " ")}</span>
          <span>•</span>
          <span>Generated {formatDate(letter.generatedAt)}</span>
          {letter.mailedAt ? <><span>•</span><span>Mailed {formatDate(letter.mailedAt)}</span></> : null}
        </div>
      </div>
    </button>
  );
}

function ProjectStatusPill({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const tone: "emerald" | "amber" | "slate" =
    ["GENERATED", "PRINTED", "MAILED", "SENT", "COMPLETED"].includes(upper)
      ? "emerald"
      : ["NEEDS_REVIEW", "REVIEW", "FAILED", "RETURNED"].includes(upper)
        ? "amber"
        : "slate";
  return <StatusPill label={status} tone={tone} />;
}

function RightTabs({
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
}: {
  activeTab: "projects" | "insights" | "production" | "activity";
  onTabChange: (tab: "projects" | "insights" | "production" | "activity") => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold text-slate-600">
        <TabButton label="Projects" active={activeTab === "projects"} onClick={() => onTabChange("projects")} />
        <TabButton label="Insights" active={activeTab === "insights"} onClick={() => onTabChange("insights")} />
        <TabButton label="Production" active={activeTab === "production"} onClick={() => onTabChange("production")} />
        <TabButton label="Activity" active={activeTab === "activity"} onClick={() => onTabChange("activity")} />
      </div>
      <label className="relative mt-2 block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter projects, recipients, templates…"
          className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
    </div>
  );
}

function TabButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-md px-3 py-1.5 transition",
        active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, accent = "slate" }: { label: string; value: string; accent?: "slate" | "emerald" | "amber" }) {
  const tone =
    accent === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-900"
      : accent === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-950";
  return (
    <div className={`rounded-lg border px-3 py-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{value}</span>
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

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{text}</p>;
}

function LoadingRows({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
        <div key={index} className={compact ? "h-8 animate-pulse rounded-md bg-slate-100" : "h-20 animate-pulse rounded-lg bg-slate-100"} />
      ))}
    </div>
  );
}
